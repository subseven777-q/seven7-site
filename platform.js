/* ============ Seven7 Plataforma — quantificação instantânea (home, pública) + Ferramentas (calculadoras) ============
   Quantificar: o visitante monta uma carteira (até 12 ativos, sem login) e a Edge Function 'quantify' devolve SÓ
   métricas derivadas (nunca preço bruto); o desenho é o mesmo quant.js da Minha mesa.
   Ferramentas: calculadoras 100% no navegador (tamanho de posição, VaR/ES, Kelly, drawdown, diversificação).
   Depende de app.js (window.S7App) e quant.js (window.S7Quant). */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const A = () => window.S7App || { lang: "pt", preview: false };
  const tx = (pt, en) => (A().lang === "en" ? en : pt);
  const loc = () => (A().lang === "en" ? "en-US" : "pt-BR");
  const nf = (v, d = 2) => (v == null || !isFinite(v) ? "—" : new Intl.NumberFormat(loc(), { minimumFractionDigits: d, maximumFractionDigits: d }).format(v));
  const DEV_URL = "http://127.0.0.1:8795/quantify";          // prévia localhost: servidor de teste do motor
  const QUANT_FN = "hyper-function";   // nome da Edge Function no Supabase (código: supabase/functions/quantify)
  const MAX_PUB = 12;
  const RF_OPTS = [
    { s: "RF:CDI", l: () => tx("Renda fixa · % do CDI", "Fixed income · % of CDI"), taxa: 100 },
    { s: "RF:IPCA", l: () => tx("Renda fixa · IPCA + taxa", "Fixed income · IPCA + rate"), taxa: 6 },
    { s: "RF:PRE", l: () => tx("Renda fixa · Pré (taxa ao ano)", "Fixed income · fixed rate p.a."), taxa: 13 },
    { s: "RF:SELIC", l: () => tx("Tesouro Selic · % da Selic", "Tesouro Selic · % of Selic"), taxa: 100 },
    { s: "RF:UST", l: () => tx("Renda fixa EUA · taxa ao ano", "US fixed income · rate p.a."), taxa: 4.5 },
  ];
  const EXEMPLO = [
    { s: "BOVA11", v: 20000 }, { s: "ITUB4", v: 10000 }, { s: "PETR4", v: 10000 }, { s: "HGLG11", v: 8000 },
    { s: "IVVB11", v: 12000 }, { s: "BTC", v: 4000 }, { s: "RF:CDI", v: 30000, taxa: 105 },
  ];
  let CAT = null;

  async function catalogo() {
    if (CAT) return CAT;
    try { CAT = await (await fetch("data/quant_catalog.json?d=" + new Date().toISOString().slice(0, 10))).json(); } catch (e) { CAT = []; }
    return CAT;
  }
  const CLS = { acao_br: ["Ação BR", "BR stock"], acao_us: ["Ação EUA", "US stock"], etf_us: ["ETF EUA", "US ETF"], etf_br: ["ETF BR", "BR ETF"],
    fii: ["FII", "REIT (FII)"], cripto: ["Cripto", "Crypto"] };

  // ---------------- QUANTIFICAR (home) ----------------
  function linha(p) {
    const rf = (p.s || "").startsWith("RF:");
    return `<div class="qq-row">
      <input class="qq-sym" list="qqCat" placeholder="${tx("Ativo (ex.: PETR4, AAPL, BTC)", "Asset (e.g. PETR4, AAPL, BTC)")}" value="${esc(rf ? "" : p.s || "")}" ${rf ? "hidden" : ""} maxlength="20" autocomplete="off" spellcheck="false">
      ${rf ? `<span class="qq-rf" data-s="${esc(p.s)}">${esc((RF_OPTS.find(o => o.s === p.s) || {}).l?.() || p.s)}</span>` : ""}
      ${rf ? `<label class="qq-taxa"><input type="number" step="0.1" min="0" value="${p.taxa ?? ""}"><span>${p.s === "RF:CDI" || p.s === "RF:SELIC" ? "%" : tx("% a.a.", "% p.a.")}</span></label>` : ""}
      <label class="qq-val"><span class="qq-cur"></span><input type="number" min="0" step="100" value="${p.v ?? ""}" placeholder="${tx("valor", "amount")}"></label>
      <button class="qq-del" title="${tx("Remover", "Remove")}" aria-label="${tx("Remover", "Remove")}">✕</button>
    </div>`;
  }
  function ler(host) {
    return $$(".qq-row", host).map(r => {
      const rf = $(".qq-rf", r), v = Number($(".qq-val input", r).value) || 0;
      if (rf) return { s: rf.dataset.s, v, taxa: Number($(".qq-taxa input", r).value) || 0 };
      return { s: $(".qq-sym", r).value.trim().toUpperCase(), v };
    }).filter(p => p.s && p.v > 0);
  }
  async function quantifyCall(base, pos) {
    const S = A();
    if (S.preview) {
      const r = await fetch(DEV_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ base, pos }) });
      return r.json();
    }
    let token = S.anon;
    try { const { data } = await S.sb.auth.getSession(); if (data?.session?.access_token) token = data.session.access_token; } catch (e) { /* sem sessão */ }
    const r = await fetch(`${S.url}/functions/v1/${QUANT_FN}`, {
      method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + token, apikey: S.anon }, body: JSON.stringify({ base, pos }),
    });
    return r.json();
  }
  async function renderQuick() {
    const host = $("#qqHost"); if (!host) return;
    const cat = await catalogo();
    let base = A().lang === "en" ? "USD" : "BRL";
    host.innerHTML = `<div class="qq-card">
      <div class="qq-head">
        <div><div class="qq-t">${tx("Sua carteira", "Your portfolio")}</div><div class="qq-s">${tx("Digite os ativos e quanto você tem em cada um. Sem cadastro.", "Type your assets and how much you hold in each. No sign-up.")}</div></div>
        <div class="seg qq-base">${["BRL", "USD"].map(c => `<button data-c="${c}" class="${c === base ? "on" : ""}">${c}</button>`).join("")}</div>
      </div>
      <div id="qqRows">${EXEMPLO.map(linha).join("")}</div>
      <datalist id="qqCat">${cat.map(c => `<option value="${esc(c.s)}">${esc((CLS[c.c] || ["", ""])[A().lang === "en" ? 1 : 0])}</option>`).join("")}</datalist>
      <div class="qq-tools">
        <button class="btn btn-ghost qq-add">+ ${tx("Ativo", "Asset")}</button>
        <select class="qq-addrf"><option value="">+ ${tx("Renda fixa…", "Fixed income…")}</option>${RF_OPTS.map(o => `<option value="${o.s}">${o.l()}</option>`).join("")}</select>
        <button class="btn btn-ghost qq-clear">${tx("Limpar", "Clear")}</button>
        <span class="qq-n"></span>
        <button class="btn btn-primary btn-lg qq-go">${tx("Quantificar", "Quantify")} →</button>
      </div>
      <div class="qq-note">${tx(`Catálogo: ${cat.length} ativos (ações BR/EUA, ETFs, FIIs, cripto) + renda fixa. Até ${MAX_PUB} posições sem login.`, `Catalog: ${cat.length} assets (BR/US stocks, ETFs, REITs, crypto) + fixed income. Up to ${MAX_PUB} positions without login.`)}</div>
    </div>
    <div id="qqOut"></div>`;
    const rows = $("#qqRows", host), out = $("#qqOut", host);
    const sync = () => {
      $$(".qq-cur", host).forEach(e => { e.textContent = base === "BRL" ? "R$" : "US$"; });
      const n = $$(".qq-row", host).length;
      $(".qq-n", host).textContent = `${n}/${MAX_PUB}`;
      $(".qq-add", host).disabled = $(".qq-addrf", host).disabled = n >= MAX_PUB;
    };
    host.addEventListener("click", e => { if (e.target.closest(".qq-del")) { e.target.closest(".qq-row").remove(); sync(); } });
    $$(".qq-base button", host).forEach(b => b.onclick = () => { base = b.dataset.c; $$(".qq-base button", host).forEach(x => x.classList.toggle("on", x === b)); sync(); });
    $(".qq-add", host).onclick = () => { rows.insertAdjacentHTML("beforeend", linha({})); sync(); $$(".qq-sym", rows).pop().focus(); };
    $(".qq-addrf", host).onchange = e => {
      const o = RF_OPTS.find(x => x.s === e.target.value); e.target.value = "";
      if (o) { rows.insertAdjacentHTML("beforeend", linha({ s: o.s, taxa: o.taxa })); sync(); }
    };
    $(".qq-clear", host).onclick = () => { rows.innerHTML = linha({}); out.innerHTML = ""; sync(); };
    $(".qq-go", host).onclick = async () => {
      const pos = ler(host);
      if (!pos.length) { out.innerHTML = `<div class="q-empty">${tx("Adicione pelo menos um ativo com valor.", "Add at least one asset with an amount.")}</div>`; return; }
      const go = $(".qq-go", host); go.disabled = true;
      out.innerHTML = `<div class="q-empty">${tx("Calculando 2 anos de risco…", "Crunching 2 years of risk…")}</div>`;
      try {
        const d = await quantifyCall(base, pos);
        if (d.error) throw new Error(d.error);
        const cta = A().user && A().user.id !== "preview"
          ? `<a class="btn btn-primary" href="members.html">${tx("Salvar na Minha mesa", "Save to My desk")} →</a>`
          : `<a class="btn btn-primary" href="register.html">${tx("Criar conta grátis", "Create free account")} →</a>`;
        out.innerHTML = `<div class="qq-cta"><div><b>${tx("Gostou? Salve a carteira e acompanhe todo dia.", "Like it? Save the portfolio and track it daily.")}</b>
          <small>${tx("Conta grátis: carteira salva, quantificação diária, Terminal e Ferramentas.", "Free account: saved portfolio, daily quant, Terminal and Tools.")}</small></div>${cta}</div><div id="qqQuant"></div>`;
        const draw = () => window.S7Quant.full($("#qqQuant", out), d, { lang: A().lang });
        if (window.S7Quant) draw(); else window.__s7QuantPending = draw;
        out.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (e) {
        const msg = String(e.message || e) === "rate_limit" ? tx("Muitas consultas seguidas. Espere alguns minutos — ou crie a conta grátis (sem limite).", "Too many requests. Wait a few minutes — or create a free account (no limit).")
          : tx("Não foi possível calcular agora. Tente de novo em instantes.", "Couldn't compute right now. Try again shortly.");
        out.innerHTML = `<div class="q-empty">${msg}</div>`;
      } finally { go.disabled = false; }
    };
    sync();
  }

  // ---------------- FERRAMENTAS ----------------
  const TOOLS = [
    {
      id: "pos", t: ["Tamanho da posição pelo risco", "Position size from risk"],
      d: ["Quanto comprar para que, se o stop for atingido, você perca só o risco escolhido.", "How much to buy so that hitting the stop costs only the risk you chose."],
      f: [["cap", ["Capital", "Capital"], 100000], ["risk", ["Risco por operação (%)", "Risk per trade (%)"], 1], ["ent", ["Entrada", "Entry"], 38.5], ["stop", ["Stop", "Stop"], 36.2]],
      calc: v => {
        const rU = Math.abs(v.ent - v.stop), perda = v.cap * v.risk / 100;
        if (!(rU > 0)) return null;
        const q = Math.floor(perda / rU), val = q * v.ent;
        return [[tx("Quantidade", "Quantity"), nf(q, 0)], [tx("Valor da posição", "Position value"), nf(val)], [tx("% do capital", "% of capital"), nf(val / v.cap * 100, 1) + "%"],
          [tx("Perda no stop", "Loss at stop"), nf(q * rU)], [tx("Distância do stop", "Stop distance"), nf(rU / v.ent * 100, 2) + "%"]];
      },
      fx: "q = ⌊ capital × risco% ÷ |entrada − stop| ⌋",
    },
    {
      id: "var", t: ["VaR e Expected Shortfall", "VaR and Expected Shortfall"],
      d: ["Perda que só é superada em (1−confiança) dos dias — e a média das perdas além dela (normal).", "Loss exceeded only on (1−confidence) of days — and the average loss beyond it (normal)."],
      f: [["val", ["Valor da carteira", "Portfolio value"], 100000], ["vol", ["Volatilidade anual (%)", "Annual volatility (%)"], 18], ["h", ["Horizonte (dias úteis)", "Horizon (trading days)"], 1], ["c", ["Confiança (%)", "Confidence (%)"], 99]],
      calc: v => {
        const p = Math.min(Math.max(v.c / 100, 0.5), 0.9999), z = qnorm(p), s = v.vol / 100 * Math.sqrt(v.h / 252);
        const es = Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI) / (1 - p);
        return [["z", nf(z, 3)], [tx("σ no horizonte", "σ over horizon"), nf(s * 100, 2) + "%"], ["VaR", nf(v.val * z * s) + ` (${nf(z * s * 100, 2)}%)`],
          ["ES", nf(v.val * es * s) + ` (${nf(es * s * 100, 2)}%)`]];
      },
      fx: "VaR = V·z_c·σ·√(h/252) · ES = V·σ√(h/252)·φ(z_c)/(1−c)",
    },
    {
      id: "kelly", t: ["Critério de Kelly", "Kelly criterion"],
      d: ["Fração do capital que maximiza o crescimento de longo prazo. Na prática use meio Kelly ou menos.", "Capital fraction that maximizes long-run growth. In practice use half-Kelly or less."],
      f: [["p", ["Taxa de acerto (%)", "Win rate (%)"], 55], ["b", ["Payoff (ganho médio ÷ perda média)", "Payoff (avg win ÷ avg loss)"], 1.5]],
      calc: v => {
        const p = v.p / 100, q = 1 - p, k = (v.b * p - q) / v.b;
        const g = f => p * Math.log(1 + f * v.b) + q * Math.log(1 - f);
        return [["f* (Kelly)", nf(k * 100, 1) + "%"], [tx("Meio Kelly", "Half-Kelly"), nf(k * 50, 1) + "%"],
          [tx("Expectativa por R", "Expectancy per R"), nf(p * v.b - q, 3) + " R"],
          [tx("Crescimento/aposta (½ Kelly)", "Growth/bet (½ Kelly)"), k > 0 ? nf(g(k / 2) * 100, 3) + "%" : "—"],
          [tx("Veredito", "Verdict"), k > 0 ? tx("tem vantagem", "has an edge") : tx("sem vantagem — não aposte", "no edge — don't bet")]];
      },
      fx: "f* = (b·p − q) / b",
    },
    {
      id: "dd", t: ["Recuperação de drawdown", "Drawdown recovery"],
      d: ["Quanto precisa subir para voltar ao topo — e quanto tempo leva no seu retorno esperado.", "How much it must rise to get back to the peak — and how long at your expected return."],
      f: [["dd", ["Queda (%)", "Drawdown (%)"], 30], ["r", ["Retorno esperado ao ano (%)", "Expected return p.a. (%)"], 12]],
      calc: v => {
        const d = Math.min(v.dd, 99.99) / 100, up = 1 / (1 - d) - 1, anos = v.r > 0 ? Math.log(1 / (1 - d)) / Math.log(1 + v.r / 100) : null;
        return [[tx("Alta necessária", "Required gain"), nf(up * 100, 1) + "%"], [tx("Tempo para recuperar", "Time to recover"), anos != null ? nf(anos, 1) + tx(" anos", " years") : "—"]];
      },
      fx: "alta = 1/(1−DD) − 1 · tempo = ln(1/(1−DD)) / ln(1+r)",
    },
    {
      id: "div", t: ["Diversificação de verdade", "Real diversification"],
      d: ["Com N ativos de mesmo peso, a volatilidade cai — mas só até o piso dado pela correlação média.", "With N equal-weight assets volatility falls — but only down to the floor set by average correlation."],
      f: [["n", ["Nº de ativos", "Number of assets"], 10], ["vol", ["Volatilidade média de cada (%)", "Average volatility each (%)"], 30], ["rho", ["Correlação média (−1 a 1)", "Average correlation (−1 to 1)"], 0.4]],
      calc: v => {
        const n = Math.max(1, Math.round(v.n)), rho = Math.min(Math.max(v.rho, -1 / (n - 1 || 1)), 1);
        const s = v.vol * Math.sqrt(1 / n + (1 - 1 / n) * rho), piso = v.vol * Math.sqrt(Math.max(rho, 0));
        const nEff = n / (1 + (n - 1) * rho);
        return [[tx("Vol. da carteira", "Portfolio vol"), nf(s, 1) + "%"], [tx("Piso (N → ∞)", "Floor (N → ∞)"), nf(piso, 1) + "%"],
          [tx("Redução de risco", "Risk reduction"), nf((1 - s / v.vol) * 100, 0) + "%"], [tx("Apostas independentes equivalentes", "Equivalent independent bets"), nf(nEff, 1)]];
      },
      fx: "σ_p = σ·√(1/N + (1−1/N)·ρ̄) · N_ef = N / (1 + (N−1)·ρ̄)",
    },
    {
      id: "sharpe", t: ["Sharpe é real? (PSR)", "Is the Sharpe real? (PSR)"],
      d: ["Probabilidade de o Sharpe verdadeiro ser maior que zero, dada a amostra, assimetria e curtose (Bailey & López de Prado).", "Probability the true Sharpe exceeds zero given sample size, skew and kurtosis (Bailey & López de Prado)."],
      f: [["sr", ["Sharpe anual observado", "Observed annual Sharpe"], 1.2], ["n", ["Nº de observações (dias)", "Observations (days)"], 504], ["sk", ["Assimetria", "Skewness"], -0.5], ["ku", ["Curtose", "Kurtosis"], 6]],
      calc: v => {
        const sr = v.sr / Math.sqrt(252), den = Math.sqrt(1 - v.sk * sr + (v.ku - 1) / 4 * sr * sr);
        const z = sr * Math.sqrt(v.n - 1) / den, psr = pnorm(z);
        const mintrl = 1 + (1 - v.sk * sr + (v.ku - 1) / 4 * sr * sr) * (1.645 / sr) ** 2;
        return [["PSR(0)", nf(psr * 100, 1) + "%"], [tx("Veredito (95%)", "Verdict (95%)"), psr >= 0.95 ? tx("significativo", "significant") : tx("ainda pode ser sorte", "could still be luck")],
          [tx("Histórico mínimo (MinTRL)", "Min track record (MinTRL)"), sr > 0 ? nf(mintrl, 0) + tx(" dias", " days") : "—"]];
      },
      fx: "PSR = Φ( SR·√(n−1) / √(1 − γ₃·SR + (γ₄−1)/4·SR²) )",
    },
  ];
  function pnorm(z) {                                       // Φ(z), Abramowitz-Stegun 26.2.17
    const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return z > 0 ? 1 - p : p;
  }
  function qnorm(p) {                                       // Φ⁻¹(p), Acklam
    const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
    const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
    const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
    const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
    const pl = 0.02425;
    if (p < pl) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    if (p > 1 - pl) { const q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    const q = p - 0.5, r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  function renderTools() {
    const host = $("#toolsHost"); if (!host) return;
    const en = A().lang === "en" ? 1 : 0;
    host.innerHTML = TOOLS.map(T => `<div class="tool-card" id="tool-${T.id}">
      <div class="tool-h">${T.t[en]}</div><p class="tool-d">${T.d[en]}</p>
      <div class="tool-f">${T.f.map(([k, l, v]) => `<label><span>${l[en]}</span><input type="number" step="any" data-k="${k}" value="${v}"></label>`).join("")}</div>
      <div class="tool-out"></div><div class="tool-fx">${esc(T.fx)}</div></div>`).join("");
    TOOLS.forEach(T => {
      const card = $("#tool-" + T.id, host);
      const run = () => {
        const v = {}; $$("input", card).forEach(i => { v[i.dataset.k] = Number(i.value); });
        const r = Object.values(v).every(isFinite) ? T.calc(v) : null;
        $(".tool-out", card).innerHTML = r ? r.map(([k, x]) => `<div class="tool-kv"><span>${k}</span><b>${x}</b></div>`).join("")
          : `<div class="tool-kv"><span>${tx("Confira os valores", "Check the inputs")}</span><b>—</b></div>`;
      };
      $$("input", card).forEach(i => i.addEventListener("input", run)); run();
    });
  }

  // ---------------- cartões da plataforma (home) ----------------
  const FEATS = [
    { i: "gauge", c: "var(--c-cyan)", h: "#quantificar", t: ["Saúde da carteira", "Portfolio health"],
      d: ["Nota de 0 a 100 e 5 semáforos: risco vs. índice, queda atual, concentração, diversificação e eficiência.", "0–100 score and 5 lights: risk vs. index, current drawdown, concentration, diversification and efficiency."] },
    { i: "pulse", c: "var(--c-violet)", h: "#quantificar", t: ["Risco de verdade", "Real risk"],
      d: ["Volatilidade, VaR 95%, Expected Shortfall 97,5%, β, drawdown e quem carrega o risco (contribuição marginal).", "Volatility, 95% VaR, 97.5% Expected Shortfall, β, drawdown and who carries the risk (marginal contribution)."] },
    { i: "layers", c: "var(--c-green)", h: "#quantificar", t: ["Otimização HRP + fronteira", "HRP + efficient frontier"],
      d: ["Hierarchical Risk Parity (López de Prado) com covariância Ledoit-Wolf, e onde você está na fronteira de Markowitz.", "Hierarchical Risk Parity (López de Prado) with Ledoit-Wolf covariance, and where you sit on the Markowitz frontier."] },
    { i: "desk", c: "var(--c-amber)", h: "terminal.html", t: ["Terminal Seven7", "Seven7 Terminal"],
      d: ["Notícias, macro (Selic, Focus, curva dos EUA), cotações, mapas de calor e a sua carteira — estilo terminal profissional.", "News, macro (Selic, Focus, US curve), quotes, heatmaps and your portfolio — pro-terminal style."] },
    { i: "target", c: "var(--c-rose)", h: "ferramentas.html", t: ["Ferramentas quant", "Quant tools"],
      d: ["Tamanho de posição pelo risco, VaR, Kelly, recuperação de drawdown, diversificação e Sharpe probabilístico.", "Position size from risk, VaR, Kelly, drawdown recovery, diversification and probabilistic Sharpe."] },
    { i: "wallet", c: "var(--c-cyan)", h: "members.html", t: ["Carteira salva, todo dia", "Saved portfolio, daily"],
      d: ["Com a conta grátis a carteira fica salva e é requantificada todo dia — em reais ou dólares.", "With a free account your portfolio is saved and re-quantified every day — in BRL or USD."] },
  ];
  function renderFeats() {
    const host = $("#platFeats"); if (!host) return;
    const en = A().lang === "en" ? 1 : 0, ic = A().ic || (() => "");
    host.innerHTML = FEATS.map(f => `<a class="home-card" href="${f.h}" style="--tone:${f.c}">
      <div class="hc-ic">${ic(f.i)}</div><div class="hc-title">${f.t[en]}</div><div class="hc-desc">${f.d[en]}</div></a>`).join("");
  }

  let LANG_QQ = null;
  function lang() {                                         // troca de idioma (app.js chama no render)
    renderFeats(); renderTools();
    if (LANG_QQ !== A().lang) { LANG_QQ = A().lang; renderQuick(); }
  }
  window.S7Platform = { renderQuick, renderTools, lang };
  if (window.S7App && document.readyState !== "loading") lang(); else document.addEventListener("DOMContentLoaded", lang);
})();
