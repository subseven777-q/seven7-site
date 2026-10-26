"""
coletor.py — dados do TERMINAL Seven7 (Minha mesa), coletados na NUVEM (GitHub Actions, a cada 15 min).

Só fontes gratuitas e abertas; nenhuma chave além da do Supabase:
  NOTÍCIAS  RSS: InfoMoney, Money Times, Exame, Valor (BR) · CNBC, MarketWatch (global) ·
            Fed, BCE, BCB (bancos centrais). Guarda só MANCHETE + fonte + link (o texto fica no site de origem).
            O coletor se identifica como "Seven7 Terminal"; fonte que bloquear esse acesso fica de fora.
  MACRO     BCB/SGS (Selic meta, CDI, PTAX, IPCA 12m e mês) · BCB/Focus (IPCA, Selic, PIB, câmbio: ano e ano+1) ·
            Tesouro dos EUA (curva diária 1M–30Y, hoje e véspera) · Fed de NY (EFFR e faixa-alvo).
Saída: tabela member_payloads do Supabase (chaves term_news e term_macro; leitura só de membros via RLS).

Uso:  python coletor.py            (envia ao Supabase; precisa da env SUPABASE_SERVICE_KEY)
      python coletor.py --local    (grava ../data/term_news.json e term_macro.json p/ a prévia local; gitignored)
Somente biblioteca padrão do Python (roda no GitHub Actions sem instalar nada).
"""
import argparse
import email.utils
import json
import os
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from html import unescape
from pathlib import Path

SUPABASE_URL = "https://ehqxuveyprrmjfcqmkhs.supabase.co"
UA = {"User-Agent": "Mozilla/5.0 (Seven7 Terminal; +https://seven7invest.com)"}
FEEDS = [  # (fonte, região, url)
    ("InfoMoney", "BR", "https://www.infomoney.com.br/feed/"),
    ("Money Times", "BR", "https://www.moneytimes.com.br/feed/"),
    ("Exame", "BR", "https://exame.com/feed/"),
    ("Valor", "BR", "https://valor.globo.com/rss/valor/"),
    ("CNBC", "GLOBAL", "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114"),
    ("MarketWatch", "GLOBAL", "https://feeds.content.dowjones.io/public/rss/mw_topstories"),
    ("Fed", "BC", "https://www.federalreserve.gov/feeds/press_all.xml"),
    ("BCE", "BC", "https://www.ecb.europa.eu/rss/press.html"),
    ("BCB", "BC", "https://www.bcb.gov.br/api/feed/sitebcb/sitefeeds/notasImprensa"),
]
MAX_HORAS, MAX_ITENS = 72, 250


def get(url, timeout=25, tentativas=3):
    """GET simples; APIs públicas (BCB) às vezes devolvem erro passageiro -> tenta de novo com espera curta."""
    import time
    for k in range(tentativas):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
                return r.read()
        except Exception:
            if k == tentativas - 1:
                raise
            time.sleep(2 * (k + 1))


def _txt(el, *names):
    for n in names:
        x = el.find(n)
        if x is not None:
            v = (x.text or x.get("href") or "").strip()
            if v:
                return v
    return ""


def _data(s):
    if not s:
        return None
    try:
        d = email.utils.parsedate_to_datetime(s)
    except (TypeError, ValueError):
        try:
            d = datetime.fromisoformat(s.replace("Z", "+00:00"))
        except ValueError:
            return None
    return (d if d.tzinfo else d.replace(tzinfo=timezone.utc)).astimezone(timezone.utc)


def noticias():
    itens, status = [], {}
    corte = datetime.now(timezone.utc) - timedelta(hours=MAX_HORAS)
    corte_bc = datetime.now(timezone.utc) - timedelta(days=14)
    A = "{http://www.w3.org/2005/Atom}"
    for fonte, reg, url in FEEDS:
        try:
            raiz = ET.fromstring(get(url))
            n = 0
            for it in list(raiz.iter("item")) + list(raiz.iter(A + "entry")):
                tit = unescape(re.sub(r"<[^>]+>", "", _txt(it, "title", A + "title")))
                link = _txt(it, "link", A + "link")
                if not link:
                    lk = it.find(A + "link")
                    link = lk.get("href", "") if lk is not None else ""
                d = _data(_txt(it, "pubDate", A + "updated", A + "published", "{http://purl.org/dc/elements/1.1/}date"))
                lim = corte_bc if reg == "BC" else corte          # bancos centrais publicam pouco: janela maior
                if not tit or not link.startswith("http") or (d and d < lim):
                    continue
                itens.append({"t": tit[:220], "u": link, "s": fonte, "r": reg,
                              "d": (d or datetime.now(timezone.utc)).isoformat(timespec="seconds")})
                n += 1
            status[fonte] = n
        except Exception as e:  # uma fonte fora do ar não derruba as outras
            status[fonte] = f"erro: {type(e).__name__}"
    vistos, out = set(), []
    for x in sorted(itens, key=lambda z: z["d"], reverse=True):
        k = re.sub(r"\W+", "", x["t"].lower())[:80]
        if k not in vistos:
            vistos.add(k); out.append(x)
    return {"asof": datetime.now(timezone.utc).isoformat(timespec="seconds"), "fontes": status, "itens": out[:MAX_ITENS]}


def sgs(cod):
    j = json.loads(get(f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.{cod}/dados/ultimos/1?formato=json"))
    return {"valor": float(j[-1]["valor"]), "data": j[-1]["data"]}


def focus(indicador):
    ano = datetime.now().year
    q = urllib.parse.quote(f"Indicador eq '{indicador}' and baseCalculo eq 0")
    url = ("https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais"
           f"?$top=40&$filter={q}&$orderby=Data%20desc&$format=json&$select=Data,DataReferencia,Mediana")
    rows = json.loads(get(url))["value"]
    if not rows:
        return None
    ult = rows[0]["Data"]
    vals = {r["DataReferencia"]: r["Mediana"] for r in rows if r["Data"] == ult}
    return {"data": ult, str(ano): vals.get(str(ano)), str(ano + 1): vals.get(str(ano + 1))}


def curva_ust():
    NS = {"a": "http://www.w3.org/2005/Atom", "m": "http://schemas.microsoft.com/ado/2007/08/dataservices/metadata",
          "d": "http://schemas.microsoft.com/ado/2007/08/dataservices"}
    cols = [("1M", "BC_1MONTH"), ("2M", "BC_2MONTH"), ("3M", "BC_3MONTH"), ("6M", "BC_6MONTH"), ("1Y", "BC_1YEAR"),
            ("2Y", "BC_2YEAR"), ("3Y", "BC_3YEAR"), ("5Y", "BC_5YEAR"), ("7Y", "BC_7YEAR"), ("10Y", "BC_10YEAR"),
            ("20Y", "BC_20YEAR"), ("30Y", "BC_30YEAR")]
    dias = []
    hoje = datetime.now(timezone.utc)
    for mes in (hoje, hoje.replace(day=1) - timedelta(days=1)):
        url = ("https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml"
               f"?data=daily_treasury_yield_curve&field_tdr_date_value_month={mes:%Y%m}")
        raiz = ET.fromstring(get(url, 40))
        for p in raiz.iter("{%s}properties" % NS["m"]):
            dt = p.find("d:NEW_DATE", NS)
            if dt is None:
                continue
            dias.append((dt.text[:10], {k: float(p.find(f"d:{c}", NS).text) for k, c in cols
                                        if p.find(f"d:{c}", NS) is not None and p.find(f"d:{c}", NS).text}))
        if len(dias) >= 2:
            break
    dias.sort()
    return {"data": dias[-1][0], "hoje": dias[-1][1], "data_ant": dias[-2][0], "ant": dias[-2][1]} if len(dias) >= 2 else None


def macro():
    out, erros = {"asof": datetime.now(timezone.utc).isoformat(timespec="seconds"), "br": {}, "us": {}}, {}
    for k, cod in (("selic_meta", 432), ("cdi", 4389), ("ptax", 1), ("ipca_12m", 13522), ("ipca_mes", 433)):
        try:
            out["br"][k] = sgs(cod)
        except Exception as e:
            erros[k] = type(e).__name__
    out["br"]["focus"] = {}
    for k, ind in (("ipca", "IPCA"), ("selic", "Selic"), ("pib", "PIB Total"), ("cambio", "Câmbio")):
        try:
            out["br"]["focus"][k] = focus(ind)
        except Exception as e:
            erros["focus_" + k] = type(e).__name__
    try:
        out["us"]["curva"] = curva_ust()
    except Exception as e:
        erros["curva_ust"] = type(e).__name__
    try:
        r = json.loads(get("https://markets.newyorkfed.org/api/rates/unsecured/effr/last/1.json"))["refRates"][0]
        out["us"]["effr"] = {"valor": r["percentRate"], "data": r["effectiveDate"],
                             "alvo": [r.get("targetRateFrom"), r.get("targetRateTo")]}
    except Exception as e:
        erros["effr"] = type(e).__name__
    out["erros"] = erros
    return out


def envia(chaves: dict):
    key = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()
    if not key:
        raise SystemExit("SUPABASE_SERVICE_KEY ausente (configure o secret no GitHub).")
    agora = datetime.now(timezone.utc).isoformat(timespec="seconds")
    rows = [{"key": k, "payload": v, "updated_at": agora} for k, v in chaves.items()]
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/member_payloads?on_conflict=key", method="POST",
                                 data=json.dumps(rows).encode("utf-8"),
                                 headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json",
                                          "Prefer": "resolution=merge-duplicates,return=minimal"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.status


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--local", action="store_true"); a = ap.parse_args()
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    n, m = noticias(), macro()
    print(f"notícias: {len(n['itens'])} | fontes: {n['fontes']}")
    print(f"macro: erros {m['erros'] or 'nenhum'} | Selic {m['br'].get('selic_meta')} | UST10Y "
          f"{(m['us'].get('curva') or {}).get('hoje', {}).get('10Y')}")
    if a.local:
        d = Path(__file__).resolve().parents[1] / "data"
        (d / "term_news.json").write_text(json.dumps(n, ensure_ascii=False), encoding="utf-8")
        (d / "term_macro.json").write_text(json.dumps(m, ensure_ascii=False), encoding="utf-8")
        print("gravado em data/term_*.json (prévia local)")
    else:
        print("Supabase:", envia({"term_news": n, "term_macro": m}))


if __name__ == "__main__":
    main()
