/* ============ Seven7 Terminal — mesa quant no estilo Bloomberg ============
   Funções por CÓDIGO digitadas na barra de comando ("PETR4 GP", "TOP", "ECO BR"), 4 painéis, layouts prontos.
   Fontes: widgets do TradingView (licenciados para incorporar; dados com atraso) + coletor Seven7 na nuvem
   (member_payloads: term_news, term_macro) + intraday público (data/intraday_*.json) + sinais/portfólio do
   Supabase (RLS por plano). app.js faz o portão de membros e chama S7Terminal.boot(api). */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let API = null, ROOT = null, NEWS = null, MACRO = null, INTRA = {}, SIGS = null, PF = null;
  const LS = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
               set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* sem storage: segue sem salvar */ } } };
  const PT = () => !API || API.lang !== "en";
  const tx = (pt, en) => (PT() ? pt : en);
  const loc = () => (PT() ? "pt-BR" : "en-US");
  const nf = (v, d = 2) => (v == null || !isFinite(v) ? "—" : new Intl.NumberFormat(loc(), { minimumFractionDigits: d, maximumFractionDigits: d }).format(v));
  const pct = (v, d = 2) => (v == null || !isFinite(v) ? "—" : (v > 0 ? "+" : "") + nf(v, d) + "%");
  const cls = v => (v > 0 ? "up" : v < 0 ? "dn" : "");

  // ---------------- símbolos ----------------
  // símbolos conferidos nos widgets em 26/10/2026 (TVC:VIX/DXY/US10Y, índices TVC da Ásia/Europa e futuros CBOT/ICE/
  // COMEX/NYMEX NÃO são liberados para widgets → CFDs equivalentes da Capital.com/OANDA, que são)
  const ALIAS = {
    IBOV: "BMFBOVESPA:IBOV", SMLL: "BMFBOVESPA:SMLL", IFIX: "BMFBOVESPA:IFIX", WIN: "BMFBOVESPA:WIN1!", DOL: "BMFBOVESPA:DOL1!",
    DI: "BMFBOVESPA:DI1F2027", BOI: "BMFBOVESPA:BGI1!", SPX: "FOREXCOM:SPXUSD", ES: "FOREXCOM:SPXUSD", NDX: "FOREXCOM:NSXUSD",
    NQ: "FOREXCOM:NSXUSD", DJI: "FOREXCOM:DJI", DXY: "CAPITALCOM:DXY", VIX: "CAPITALCOM:VIX", USDBRL: "FX_IDC:USDBRL",
    BRL: "FX_IDC:USDBRL", DOLAR: "FX_IDC:USDBRL", EURUSD: "FX:EURUSD", OIL: "TVC:USOIL", WTI: "TVC:USOIL", BRENT: "TVC:UKOIL",
    GOLD: "TVC:GOLD", OURO: "TVC:GOLD", SILVER: "TVC:SILVER", COPPER: "CAPITALCOM:COPPER", NATGAS: "CAPITALCOM:NATURALGAS",
    BTC: "BITSTAMP:BTCUSD", ETH: "BITSTAMP:ETHUSD", DAX: "XETR:DAX", UKX: "CAPITALCOM:UK100", NKY: "CAPITALCOM:J225",
    HSI: "CAPITALCOM:HK50", SX5E: "CAPITALCOM:EU50", A50: "CAPITALCOM:CN50",
  };
  const isB3 = s => /^[A-Z]{4}\d{1,2}F?$/.test(s);
  const tvSym = s => { s = (s || "").toUpperCase(); return ALIAS[s] || (s.includes(":") ? s : isB3(s) ? "BMFBOVESPA:" + s : s); };

  // ---------------- widgets do TradingView ----------------
  const TVJS = "https://s3.tradingview.com/external-embedding/embed-widget-";
  function tv(host, name, cfg) {
    host.innerHTML = "";
    const box = document.createElement("div"); box.className = "tradingview-widget-container term-tv";
    const w = document.createElement("div"); w.className = "tradingview-widget-container__widget"; box.appendChild(w);
    const s = document.createElement("script"); s.src = TVJS + name + ".js"; s.async = true; s.type = "text/javascript";
    s.textContent = JSON.stringify(Object.assign({ colorTheme: "dark", isTransparent: true, locale: PT() ? "br" : "en" }, cfg));
    box.appendChild(s); host.appendChild(box);
    const cr = document.createElement("div"); cr.className = "term-credit";
    cr.innerHTML = `<a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank">${tx("Gráficos e dados: TradingView (com atraso)", "Charts & data: TradingView (delayed)")}</a>`;
    host.appendChild(cr);
  }
  const quotes = (host, groups) => tv(host, "market-quotes", { width: "100%", height: "100%", showSymbolLogo: true,
    symbolsGroups: groups.map(([name, syms]) => ({ name, symbols: syms.map(([s, d]) => ({ name: s, displayName: d })) })) });

  // ---------------- dados Seven7 ----------------
  async function loadFeeds(force) {
    if (!API) return;
    if (force || !NEWS) { const n = await API.payload("term_news"); if (n !== undefined) NEWS = n; }
    if (force || !MACRO) { const m = await API.payload("term_macro"); if (m !== undefined) MACRO = m; }
    for (const m of ["us", "br"]) {
      try { const r = await fetch(`data/intraday_${m}.json?t=${Math.floor(Date.now() / 60000)}`); INTRA[m] = r.ok ? await r.json() : null; }
      catch (e) { INTRA[m] = null; }
    }
  }
  const ago = iso => {
    if (!iso) return "—";
    const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (m < 60) return tx(`há ${m} min`, `${m} min ago`);
    if (m < 1440) return tx(`há ${Math.round(m / 60)} h`, `${Math.round(m / 60)} h ago`);
    return new Date(iso).toLocaleDateString(loc(), { day: "2-digit", month: "2-digit" });
  };
  const missing = what => `<div class="term-empty">${tx(`${what} ainda indisponível. O coletor na nuvem atualiza a cada 15 min.`,
    `${what} not available yet. The cloud collector refreshes every 15 min.`)}</div>`;

  // ---------------- funções ----------------
  function newsFn(region) {
    return (host, arg) => {
      const regs = { ALL: tx("Todas", "All"), BR: tx("Brasil", "Brazil"), GLOBAL: "Global", BC: tx("Bancos centrais", "Central banks") };
      let reg = region, q = (arg || "").toLowerCase();
      const paint = () => {
        if (!NEWS || !NEWS.itens) { host.innerHTML = missing(tx("O feed de notícias", "The news feed")); return; }
        const its = NEWS.itens.filter(x => (reg === "ALL" || x.r === reg) && (!q || x.t.toLowerCase().includes(q) || x.s.toLowerCase().includes(q)));
        host.innerHTML = `<div class="term-tools">${Object.entries(regs).map(([k, v]) => `<button class="term-chip ${k === reg ? "on" : ""}" data-r="${k}">${v}</button>`).join("")}
          <input class="term-search" placeholder="${tx("filtrar…", "filter…")}" value="${esc(q)}"><span class="term-asof">${its.length} · ${ago(NEWS.asof)}</span></div>
          <ol class="term-news">${its.slice(0, 120).map(x => `<li><span class="tn-t">${new Date(x.d).toLocaleTimeString(loc(), { hour: "2-digit", minute: "2-digit" })}</span>
            <span class="tn-s tn-${x.r}">${esc(x.s)}</span><a href="${esc(x.u)}" target="_blank" rel="noopener noreferrer">${esc(x.t)}</a></li>`).join("")}</ol>`;
        host.querySelectorAll(".term-chip").forEach(b => b.onclick = () => { reg = b.dataset.r; paint(); });
        const si = host.querySelector(".term-search");
        si.oninput = () => { q = si.value.toLowerCase(); const p = si.selectionStart; paint(); const n = host.querySelector(".term-search"); n.focus(); n.setSelectionRange(p, p); };
      };
      paint();
    };
  }
  // CN de ação da B3: o TradingView quase não tem notícias de B3 nos widgets → filtra as manchetes do feed Seven7
  const NOMES = { PETR: "petrobras", VALE: "vale ",ITUB: "itaú|itau", BBDC: "bradesco", BBAS: "banco do brasil|bbas", ABEV: "ambev",
    B3SA: "b3 ", WEGE: "weg", RENT: "localiza", SUZB: "suzano", PRIO: "prio", AXIA: "eletrobras|axia", ELET: "eletrobras|axia",
    MGLU: "magazine luiza|magalu", LREN: "renner", RADL: "raia", GGBR: "gerdau", GOAU: "gerdau", CSNA: "csn", USIM: "usiminas",
    EMBJ: "embraer", EMBR: "embraer", JBSS: "jbs", MBRF: "brf|marfrig", SBSP: "sabesp", CMIG: "cemig", HAPV: "hapvida",
    RDOR: "rede d'or|rede d’or", BPAC: "btg", ITSA: "itaúsa|itausa", VIVT: "vivo|telefônica", TIMS: "tim ", CSAN: "cosan",
    RAIL: "rumo", VBBR: "vibra", UGPA: "ultrapar", ENEV: "eneva", EQTL: "equatorial", KLBN: "klabin", CYRE: "cyrela", MRVE: "mrv",
    AZUL: "azul", GOLL: "gol ", CVCB: "cvc", IRBR: "irb", BRAP: "bradespar", TOTS: "totvs", SANB: "santander", ASAI: "assaí|assai",
    PCAR: "pão de açúcar|gpa", MULT: "multiplan", ALOS: "allos", HYPE: "hypera", FLRY: "fleury", COGN: "cogna", YDUQ: "yduqs" };
  function cnB3(host, a) {
    const root = a.slice(0, 4);                          // nome da empresa (se conhecido) + tickers da família (PETR3, PETR4…)
    const re = new RegExp(`(${NOMES[root] ? NOMES[root] + "|" : ""}\\b${root}\\d{1,2}\\b)`, "i");
    if (!NEWS || !NEWS.itens) { host.innerHTML = missing(tx("O feed de notícias", "The news feed")); return; }
    const its = NEWS.itens.filter(x => re.test(x.t));
    host.innerHTML = `<div class="term-tools"><span class="term-asof">${tx("Manchetes do feed Seven7 que citam", "Seven7 feed headlines mentioning")} ${esc(a)} · ${its.length} · ${ago(NEWS.asof)}</span></div>
      <ol class="term-news">${its.length ? its.map(x => `<li><span class="tn-t">${new Date(x.d).toLocaleDateString(loc(), { day: "2-digit", month: "2-digit" })}</span>
        <span class="tn-s tn-${x.r}">${esc(x.s)}</span><a href="${esc(x.u)}" target="_blank" rel="noopener noreferrer">${esc(x.t)}</a></li>`).join("")
        : `<li class="term-empty">${tx("Nenhuma manchete recente cita este ativo (o feed guarda 72 h).", "No recent headline mentions this asset (the feed keeps 72 h).")}</li>`}</ol>`;
  }
  function btmm(host) {
    if (!MACRO || !MACRO.br) { host.innerHTML = missing(tx("O monitor de juros", "The rates monitor")); return; }
    const b = MACRO.br, u = MACRO.us || {}, c = (u.curva || {}).hoje || {}, f = b.focus || {}, y = new Date().getFullYear();
    const tile = (l, v, s, k = "") => `<div class="term-tile ${k}"><div class="tt-l">${l}</div><div class="tt-v">${v}</div><div class="tt-s">${s || ""}</div></div>`;
    const sp = c["10Y"] != null && c["2Y"] != null ? (c["10Y"] - c["2Y"]) * 100 : null;
    const fr = (k, l, d = 2) => { const x = f[k] || {}; return `<tr><td>${l}</td><td class="num">${nf(x[y], d)}</td><td class="num">${nf(x[y + 1], d)}</td></tr>`; };
    host.innerHTML = `<div class="term-scroll"><div class="term-tiles">
      ${tile("Selic meta", nf((b.selic_meta || {}).valor) + "%", (b.selic_meta || {}).data)}
      ${tile("CDI", nf((b.cdi || {}).valor) + "%", (b.cdi || {}).data)}
      ${tile("IPCA 12m", nf((b.ipca_12m || {}).valor) + "%", (b.ipca_12m || {}).data)}
      ${tile(tx("IPCA mês", "IPCA m/m"), nf((b.ipca_mes || {}).valor) + "%", (b.ipca_mes || {}).data)}
      ${tile("PTAX", "R$ " + nf((b.ptax || {}).valor, 4), (b.ptax || {}).data)}
      ${tile("Fed funds (EFFR)", nf((u.effr || {}).valor) + "%", u.effr ? `${tx("alvo", "target")} ${nf(u.effr.alvo[0])}–${nf(u.effr.alvo[1])}%` : "")}
      ${tile("UST 2Y", nf(c["2Y"]) + "%", (u.curva || {}).data)}
      ${tile("UST 10Y", nf(c["10Y"]) + "%", (u.curva || {}).data)}
      ${tile("2s10s", sp == null ? "—" : nf(sp, 0) + " bp", tx("inclinação EUA", "US slope"), sp < 0 ? "dn" : "up")}
      </div>
      <div class="term-sub">${tx("Focus — mediana do mercado", "Focus survey — market median")} · ${esc((f.ipca || {}).data || "")}</div>
      <table class="term-table"><thead><tr><th></th><th class="num">${y}</th><th class="num">${y + 1}</th></tr></thead><tbody>
      ${fr("ipca", "IPCA (%)")}${fr("selic", "Selic (%)")}${fr("pib", tx("PIB (%)", "GDP (%)"))}${fr("cambio", tx("Câmbio (R$/US$)", "FX (R$/US$)"))}</tbody></table>
      <div class="term-foot">${tx("Fontes: BCB (SGS e Focus), Tesouro dos EUA, Fed de NY", "Sources: BCB (SGS & Focus), US Treasury, NY Fed")} · ${ago(MACRO.asof)}</div></div>`;
  }
  function gc(host) {
    const cv = MACRO && MACRO.us && MACRO.us.curva;
    if (!cv) { host.innerHTML = missing(tx("A curva de juros", "The yield curve")); return; }
    const ten = [["1M", 1 / 12], ["2M", 2 / 12], ["3M", .25], ["6M", .5], ["1Y", 1], ["2Y", 2], ["3Y", 3], ["5Y", 5], ["7Y", 7], ["10Y", 10], ["20Y", 20], ["30Y", 30]]
      .filter(([k]) => cv.hoje[k] != null);
    const xs = ten.map(([, y]) => Math.log(y * 12 + 1)), vals = ten.flatMap(([k]) => [cv.hoje[k], cv.ant[k]]).filter(v => v != null);
    const lo = Math.min(...vals) - 0.1, hi = Math.max(...vals) + 0.1, W = 600, H = 220, P = 34;
    const X = x => P + (x - xs[0]) / (xs[xs.length - 1] - xs[0]) * (W - 2 * P), Y = v => H - P - (v - lo) / (hi - lo) * (H - 2 * P);
    const line = key => ten.map(([k], i) => `${i ? "L" : "M"}${X(xs[i]).toFixed(1)},${Y(cv[key][k]).toFixed(1)}`).join("");
    host.innerHTML = `<div class="term-scroll"><svg class="term-curve" viewBox="0 0 ${W} ${H}" role="img" aria-label="UST curve">
      ${[lo, (lo + hi) / 2, hi].map(v => `<line x1="${P}" x2="${W - P}" y1="${Y(v)}" y2="${Y(v)}" class="g"/><text x="4" y="${Y(v) + 4}">${nf(v)}</text>`).join("")}
      <path d="${line("ant")}" class="ant"/><path d="${line("hoje")}" class="hoje"/>
      ${ten.map(([k], i) => `<circle cx="${X(xs[i])}" cy="${Y(cv.hoje[k])}" r="3"/><text x="${X(xs[i])}" y="${H - 10}" text-anchor="middle">${k}</text>`).join("")}</svg>
      <div class="term-legend"><span class="hoje">${esc(cv.data)}</span><span class="ant">${esc(cv.data_ant)}</span></div>
      <table class="term-table"><thead><tr><th>${tx("Prazo", "Tenor")}</th>${ten.map(([k]) => `<th class="num">${k}</th>`).join("")}</tr></thead><tbody>
      <tr><td>%</td>${ten.map(([k]) => `<td class="num">${nf(cv.hoje[k])}</td>`).join("")}</tr>
      <tr><td>Δ bp</td>${ten.map(([k]) => { const d = (cv.hoje[k] - cv.ant[k]) * 100; return `<td class="num ${cls(d)}">${nf(d, 0)}</td>`; }).join("")}</tr></tbody></table>
      <div class="term-foot">${tx("Curva dos Treasuries (Tesouro dos EUA). Juros futuros do Brasil: use", "US Treasury curve. For Brazil rates use")} <b>GP DI1F2027</b></div></div>`;
  }
  function most(host, arg) {
    const m = (arg || "").toUpperCase() === "US" ? "us" : (arg || "").toUpperCase() === "BR" ? "br" : null;
    const blocks = (m ? [m] : ["br", "us"]).map(k => {
      const d = INTRA[k];
      if (!d || !d.quotes) return `<div class="term-empty">${k.toUpperCase()}: ${tx("sem cotações intraday agora", "no intraday quotes now")}</div>`;
      const arr = Object.entries(d.quotes).filter(([, v]) => v.chg_pct != null).sort((a, b) => b[1].chg_pct - a[1].chg_pct);
      const row = ([tk, v]) => `<tr><td><a class="term-tk" data-go="${tk} GP">${tk}</a></td><td class="num">${nf(v.last)}</td><td class="num ${cls(v.chg_pct)}">${pct(v.chg_pct)}</td></tr>`;
      const tb = (h, rows) => `<table class="term-table"><thead><tr><th>${h}</th><th class="num">${tx("Preço", "Last")}</th><th class="num">${tx("Dia", "Day")}</th></tr></thead><tbody>${rows.map(row).join("")}</tbody></table>`;
      return `<div class="term-sub">${k === "br" ? tx("Brasil · universo IBrX", "Brazil · IBrX universe") : tx("EUA · universo S&P 100", "US · S&P 100 universe")} · ${esc(d.asof_local || d.asof_ny || "")} · ${d.delay_min ? tx(`atraso ${d.delay_min} min`, `${d.delay_min}-min delay`) : tx("tempo real", "real-time")}</div>
        <div class="term-2col">${tb(tx("Maiores altas", "Top gainers"), arr.slice(0, 8))}${tb(tx("Maiores quedas", "Top losers"), arr.slice(-8).reverse())}</div>`;
    }).join("");
    host.innerHTML = `<div class="term-scroll">${blocks}<div class="term-foot">${tx("Bolsa inteira:", "Whole exchange:")} <a class="term-tk" data-go="MOV BR">MOV BR</a> · <a class="term-tk" data-go="MOV US">MOV US</a></div></div>`;
  }
  async function sig(host, arg) {
    if (!API.sb || API.preview) { host.innerHTML = `<div class="term-empty">${tx("Os sinais aparecem com login de membro (fora da prévia local).", "Signals show with a member login (not in local preview).")}</div>`; return; }
    if (!SIGS) { const { data } = await API.sb.from("signals").select("ticker,market,state,price,entry,stop,tp,updated_at"); SIGS = (data || []).filter(s => !s.ticker.startsWith("__")); }
    const mk = (arg || "").toUpperCase();
    const rows = SIGS.filter(s => s.state !== "FLAT" && (!mk || s.market === mk))
      .map(s => ({ ...s, d: s.entry && s.price ? (s.entry / s.price - 1) * 100 : null })).sort((a, b) => Math.abs(a.d ?? 99) - Math.abs(b.d ?? 99));
    host.innerHTML = `<div class="term-tools">${["", "US", "BR"].map(k => `<button class="term-chip ${k === mk ? "on" : ""}" data-go="SIG ${k}">${k || tx("Todos", "All")}</button>`).join("")}
      <span class="term-asof">${rows.length} · ${tx("mais perto da entrada primeiro", "closest to entry first")}</span></div>
      <div class="term-scroll"><table class="term-table"><thead><tr><th>${tx("Ativo", "Asset")}</th><th>${tx("Estado", "State")}</th><th class="num">${tx("Preço", "Price")}</th>
      <th class="num">${tx("Entrada", "Entry")}</th><th class="num">${tx("Até entrada", "To entry")}</th><th class="num">Stop</th><th class="num">${tx("Alvo", "Target")}</th></tr></thead><tbody>
      ${rows.map(s => `<tr><td><a class="term-tk" data-go="${s.ticker} GP">${esc(s.ticker)}</a> <small>${s.market}</small></td>
        <td><span class="term-st ${s.state === "ACTIVE" ? "up" : ""}">${s.state === "ACTIVE" ? tx("ATIVO", "ACTIVE") : tx("MONIT.", "WATCH")}</span></td>
        <td class="num">${nf(s.price)}</td><td class="num">${nf(s.entry)}</td><td class="num ${cls(s.d)}">${pct(s.d, 1)}</td>
        <td class="num dn">${nf(s.stop)}</td><td class="num up">${nf(s.tp)}</td></tr>`).join("")}</tbody></table></div>`;
  }
  async function port(host) {
    if (!API.sb || API.preview) { host.innerHTML = `<div class="term-empty">${tx("Seu portfólio aparece com login de membro.", "Your portfolio shows with a member login.")}</div>`; return; }
    const [st, po] = await Promise.all([
      API.sb.from("portfolio_stats").select("data").eq("user_id", API.user.id).maybeSingle(),
      API.sb.from("portfolio_positions").select("ticker,market,status,entry,current_price,ret_pct,alloc_pct").eq("user_id", API.user.id)]);
    const d = (st.data && st.data.data) || {}, pos = (po.data || []).filter(p => p.status === "open");
    host.innerHTML = `<div class="term-scroll"><div class="term-tiles">
      <div class="term-tile"><div class="tt-l">${tx("Valor", "Value")}</div><div class="tt-v">${nf(d.value)}</div><div class="tt-s">${tx("depósito", "deposit")} ${nf(d.deposit)}</div></div>
      <div class="term-tile ${cls(d.total_return)}"><div class="tt-l">${tx("Retorno", "Return")}</div><div class="tt-v">${pct(d.total_return)}</div><div class="tt-s">${d.intraday_at ? ago(d.intraday_at) : ""}</div></div>
      <div class="term-tile"><div class="tt-l">S&amp;P 500 / Ibovespa</div><div class="tt-v">${pct(d.spy_return, 1)} / ${pct(d.bova_return, 1)}</div><div class="tt-s">${tx("mesma janela", "same window")}</div></div>
      <div class="term-tile"><div class="tt-l">${tx("Posições abertas", "Open positions")}</div><div class="tt-v">${pos.length}</div><div class="tt-s">MaxDD ${pct(d.max_dd != null ? -Math.abs(d.max_dd) : null, 1)}</div></div></div>
      <table class="term-table"><thead><tr><th>${tx("Ativo", "Asset")}</th><th class="num">${tx("Peso", "Weight")}</th><th class="num">${tx("Entrada", "Entry")}</th><th class="num">${tx("Atual", "Last")}</th><th class="num">P&amp;L</th></tr></thead><tbody>
      ${pos.sort((a, b) => (b.ret_pct || 0) - (a.ret_pct || 0)).map(p => `<tr><td><a class="term-tk" data-go="${p.ticker} GP">${esc(p.ticker)}</a> <small>${p.market}</small></td>
        <td class="num">${nf(p.alloc_pct, 1)}%</td><td class="num">${nf(p.entry)}</td><td class="num">${nf(p.current_price)}</td><td class="num ${cls(p.ret_pct)}">${pct(p.ret_pct)}</td></tr>`).join("")}</tbody></table>
      <div class="term-foot"><a href="members.html#portfolio">${tx("Abrir o portfólio completo", "Open full portfolio")} →</a></div></div>`;
  }
  const FN = {
    HELP: { g: 0, n: ["Ajuda — lista de funções", "Help — function list"], run: h => help(h) },
    WEI: { g: 1, n: ["Bolsas do mundo", "World equity indices"], run: h => quotes(h, [
      [tx("Américas", "Americas"), [["BMFBOVESPA:IBOV", "Ibovespa"], ["BMFBOVESPA:SMLL", "Small Caps"], ["BMFBOVESPA:WIN1!", tx("Mini-índice", "Ibov mini fut.")], ["FOREXCOM:SPXUSD", "S&P 500"], ["FOREXCOM:NSXUSD", "Nasdaq 100"], ["FOREXCOM:DJI", "Dow Jones"], ["CAPITALCOM:VIX", "VIX"]]],
      [tx("Europa", "Europe"), [["CAPITALCOM:EU50", "Euro Stoxx 50"], ["XETR:DAX", "DAX"], ["CAPITALCOM:UK100", "FTSE 100"], ["EURONEXT:PX1", "CAC 40"]]],
      [tx("Ásia-Pacífico", "Asia-Pacific"), [["CAPITALCOM:J225", "Nikkei 225"], ["CAPITALCOM:HK50", "Hang Seng"], ["SSE:000001", "Shanghai"], ["CAPITALCOM:CN50", "China A50"], ["PEPPERSTONE:AUS200", "ASX 200"]]]]) },
    FX: { g: 1, n: ["Câmbio — matriz de cruzamentos", "FX cross rates"], run: h => tv(h, "forex-cross-rates", { width: "100%", height: "100%", currencies: ["USD", "BRL", "EUR", "GBP", "JPY", "CHF", "CNY", "MXN"] }) },
    CMDTY: { g: 1, n: ["Commodities", "Commodities"], run: h => quotes(h, [
      [tx("Energia", "Energy"), [["TVC:USOIL", "WTI"], ["TVC:UKOIL", "Brent"], ["CAPITALCOM:NATURALGAS", tx("Gás natural", "Natural gas")]]],
      [tx("Metais", "Metals"), [["TVC:GOLD", tx("Ouro", "Gold")], ["TVC:SILVER", tx("Prata", "Silver")], ["CAPITALCOM:COPPER", tx("Cobre", "Copper")]]],
      [tx("Agrícolas", "Agriculture"), [["OANDA:SOYBNUSD", tx("Soja", "Soybeans")], ["OANDA:CORNUSD", tx("Milho", "Corn")], ["OANDA:WHEATUSD", tx("Trigo", "Wheat")], ["CAPITALCOM:COFFEEARABICA", tx("Café", "Coffee")], ["OANDA:SUGARUSD", tx("Açúcar", "Sugar")], ["BMFBOVESPA:BGI1!", tx("Boi gordo B3", "Live cattle B3")]]],
      [tx("Juros e câmbio B3", "B3 rates & FX"), [["BMFBOVESPA:DI1F2027", "DI jan/27"], ["BMFBOVESPA:DOL1!", tx("Mini-dólar", "USD/BRL mini fut.")], ["CAPITALCOM:DXY", "DXY"]]]]) },
    CRYPTO: { g: 1, n: ["Cripto", "Crypto"], run: h => quotes(h, [["Cripto", [["BITSTAMP:BTCUSD", "Bitcoin"], ["BITSTAMP:ETHUSD", "Ethereum"], ["BINANCE:SOLUSDT", "Solana"], ["BINANCE:XRPUSDT", "XRP"], ["BINANCE:BNBUSDT", "BNB"]]]]) },
    MOST: { g: 1, a: "BR|US", n: ["Maiores altas e quedas (universo Seven7)", "Top movers (Seven7 universe)"], run: most },
    MOV: { g: 1, a: "BR|US", n: ["Destaques da bolsa inteira", "Whole-exchange movers"], run: (h, a) => tv(h, "hotlists", { width: "100%", height: "100%", exchange: (a || "").toUpperCase() === "US" ? "US" : "BMFBOVESPA", dateRange: "12M", showChart: true, showSymbolLogo: true }) },
    HMAP: { g: 1, a: "BR|US", n: ["Mapa de calor por setor", "Sector heat map"], run: (h, a) => tv(h, "stock-heatmap", { width: "100%", height: "100%", dataSource: (a || "").toUpperCase() === "BR" ? "IBOV" : "SPX500", grouping: "sector", blockSize: "market_cap_basic", blockColor: "change", hasTopBar: true, isZoomEnabled: true, hasSymbolTooltip: true }) },
    EQS: { g: 1, a: "BR|US", n: ["Screener de ações", "Equity screener"], run: (h, a) => tv(h, "screener", { width: "100%", height: "100%", market: (a || "").toUpperCase() === "US" ? "america" : "brazil", defaultColumn: "overview", defaultScreen: "most_capitalized", showToolbar: true }) },
    TOP: { g: 2, n: ["Notícias — principais", "Top news"], run: newsFn("ALL") },
    BRN: { g: 2, n: ["Notícias do Brasil", "Brazil news"], run: newsFn("BR") },
    WN: { g: 2, n: ["Notícias globais", "World news"], run: newsFn("GLOBAL") },
    CB: { g: 2, n: ["Bancos centrais (Fed, BCE, BCB)", "Central banks (Fed, ECB, BCB)"], run: newsFn("BC") },
    ECO: { g: 2, a: "BR|US|EU|CN", n: ["Calendário econômico", "Economic calendar"], run: (h, a) => tv(h, "events", { width: "100%", height: "100%", importanceFilter: "0,1",
      countryFilter: a ? a.toLowerCase().split(/[ ,]+/).map(x => x === "eu" ? "eu" : x).join(",") : "br,us,eu,cn,gb,jp,de" }) },
    BTMM: { g: 3, n: ["Monitor de juros e macro (Selic, Focus, Fed, Treasuries)", "Rates & macro monitor"], run: btmm },
    GC: { g: 3, n: ["Curva de juros dos EUA", "US yield curve"], run: gc },
    GP: { g: 4, t: 1, n: ["Gráfico", "Price chart"], run: (h, a) => tv(h, "advanced-chart", { autosize: true, symbol: tvSym(a || "IBOV"), interval: "D", timezone: "America/Sao_Paulo",
      theme: "dark", backgroundColor: "#0a0c0f", gridColor: "rgba(255,255,255,0.05)", style: "1", allow_symbol_change: true, hide_volume: false, withdateranges: true, studies: ["STD;SMA"] }) },
    Q: { g: 4, t: 1, n: ["Cotação", "Quote"], run: (h, a) => tv(h, "symbol-info", { width: "100%", symbol: tvSym(a || "IBOV") }) },
    DES: { g: 4, t: 1, n: ["Descrição da empresa", "Company description"], run: (h, a) => {
      h.innerHTML = '<div class="term-stack"><div class="ts-a"></div><div class="ts-b"></div></div>';
      tv(h.querySelector(".ts-a"), "symbol-info", { width: "100%", symbol: tvSym(a) });
      tv(h.querySelector(".ts-b"), "symbol-profile", { width: "100%", height: "100%", symbol: tvSym(a) }); } },
    FA: { g: 4, t: 1, n: ["Fundamentos e balanços", "Financial analysis"], run: (h, a) => tv(h, "financials", { width: "100%", height: "100%", symbol: tvSym(a), displayMode: "regular" }) },
    TA: { g: 4, t: 1, n: ["Análise técnica (resumo)", "Technical summary"], run: (h, a) => tv(h, "technical-analysis", { width: "100%", height: "100%", symbol: tvSym(a), interval: "1D", showIntervalTabs: true }) },
    CN: { g: 4, t: 1, n: ["Notícias do ativo", "Company news"], run: (h, a) => (isB3(a) ? cnB3(h, a)
      : tv(h, "timeline", { width: "100%", height: "100%", feedMode: "symbol", symbol: tvSym(a), displayMode: "regular" })) },
    SIG: { g: 5, a: "BR|US", n: ["Sinais Seven7 do seu plano", "Your Seven7 signals"], run: sig },
    PORT: { g: 5, n: ["Seu portfólio", "Your portfolio"], run: port },
  };
  const GROUPS = [["Geral", "General"], ["Mercados", "Markets"], ["Notícias e agenda", "News & calendar"], ["Juros e macro", "Rates & macro"], ["Ativo (digite o código antes)", "Security (type the ticker first)"], ["Seven7", "Seven7"]];
  function help(host) {
    host.innerHTML = `<div class="term-scroll"><p class="term-hint">${tx("Digite na barra de comando: <b>PETR4 GP</b>, <b>AAPL FA</b>, <b>TOP</b>, <b>ECO BR</b>. Um ativo sozinho abre o gráfico. Atalhos: <b>/</b> foca a barra · <b>Alt+1…4</b> escolhe o painel · <b>Esc</b> sai.",
      "Type in the command bar: <b>PETR4 GP</b>, <b>AAPL FA</b>, <b>TOP</b>, <b>ECO BR</b>. A ticker alone opens the chart. Keys: <b>/</b> command bar · <b>Alt+1…4</b> pick panel · <b>Esc</b> leave.")}</p>
      ${GROUPS.map((g, gi) => `<div class="term-sub">${tx(g[0], g[1])}</div><table class="term-table term-help"><tbody>${Object.entries(FN).filter(([, f]) => f.g === gi)
        .map(([k, f]) => `<tr><td><a class="term-tk" data-go="${f.t ? "PETR4 " : ""}${k}">${k}</a></td><td>${tx(f.n[0], f.n[1])}</td><td class="term-dim">${f.t ? tx("&lt;ativo&gt; ", "&lt;ticker&gt; ") + k : k + (f.a ? " [" + f.a + "]" : "")}</td></tr>`).join("")}</tbody></table>`).join("")}
      <p class="term-foot">${tx("Limitações: cotações com atraso (B3 15 min; EUA conforme a fonte), notícias como manchete + link para o veículo, sem chat nem envio de ordens. Bolsa inteira e balanços vêm do TradingView.",
        "Limits: delayed quotes (B3 15 min; US per source), news as headline + link to the outlet, no chat or order entry. Whole-exchange data and financials come from TradingView.")}</p></div>`;
  }

  // ---------------- painéis, comando, layouts ----------------
  const LAYOUTS = {
    MERCADOS: [["WEI"], ["TOP"], ["ECO"], ["GP", "IBOV"]],
    ATIVO: [["GP", "PETR4"], ["DES", "PETR4"], ["FA", "PETR4"], ["CN", "PETR4"]],
    MACRO: [["BTMM"], ["ECO"], ["GC"], ["FX"]],
    SEVEN7: [["SIG"], ["MOST"], ["PORT"], ["BRN"]],
  };
  let PANELS = null, FOCUS = 0;
  const OWN = ["TOP", "BRN", "WN", "CB", "BTMM", "GC", "MOST", "SIG", "PORT", "HELP"];   // painéis com dados Seven7
  const ownPanel = ([fn, a]) => OWN.includes(fn) || (fn === "CN" && isB3((a || "").toUpperCase()));
  function save() { LS.set("s7-term", JSON.stringify({ p: PANELS, f: FOCUS })); }
  function shell() {
    ROOT.innerHTML = `<div class="term-top">
        <div class="term-brand">S7<span>TERMINAL</span></div>
        <form class="term-cmd" autocomplete="off"><span class="term-prompt">&gt;</span>
          <input id="termCmd" list="termFns" spellcheck="false" placeholder="${tx("PETR4 GP · TOP · ECO BR · HELP", "PETR4 GP · TOP · ECO BR · HELP")}" aria-label="${tx("Comando", "Command")}">
          <button type="submit">GO</button><datalist id="termFns">${Object.keys(FN).map(k => `<option value="${k}">`).join("")}</datalist></form>
        <div class="term-clocks" id="termClocks"></div></div>
      <div class="term-tape" id="termTape"></div>
      <div class="term-keys">${["HELP", "WEI", "TOP", "ECO", "BTMM", "MOST", "HMAP BR", "EQS", "FX", "CMDTY", "SIG", "PORT"].map(k => `<button data-go="${k}">${k}</button>`).join("")}
        <span class="term-sep"></span>${Object.keys(LAYOUTS).map(k => `<button class="term-lay" data-lay="${k}">${k}</button>`).join("")}</div>
      <div class="term-status" id="termStatus"></div>
      <div class="term-grid" id="termGrid">${[0, 1, 2, 3].map(i => `<section class="term-panel" data-i="${i}">
        <header><span class="tp-n">${i + 1}</span><span class="tp-code"></span><span class="tp-title"></span>
        <button class="tp-max" title="${tx("Maximizar", "Maximize")}" aria-label="${tx("Maximizar", "Maximize")}">⤢</button></header><div class="tp-body"></div></section>`).join("")}</div>`;
    tv($("#termTape"), "ticker-tape", { symbols: [["BMFBOVESPA:IBOV", "Ibovespa"], ["FOREXCOM:SPXUSD", "S&P 500"], ["FOREXCOM:NSXUSD", "Nasdaq"], ["FX_IDC:USDBRL", "USD/BRL"], ["CAPITALCOM:DXY", "DXY"],
      ["BMFBOVESPA:DI1F2027", "DI jan/27"], ["TVC:UKOIL", "Brent"], ["TVC:GOLD", tx("Ouro", "Gold")], ["BITSTAMP:BTCUSD", "BTC"], ["CAPITALCOM:VIX", "VIX"]].map(([proName, title]) => ({ proName, title })),
      showSymbolLogo: true, displayMode: "adaptive" });
    const form = ROOT.querySelector(".term-cmd"), inp = $("#termCmd");
    form.onsubmit = e => { e.preventDefault(); run(inp.value); inp.value = ""; };
    ROOT.addEventListener("click", e => {
      const go = e.target.closest("[data-go]");
      if (go) {                                          // ativo clicado num painel abre no PRÓXIMO painel; filtros ficam no mesmo
        e.preventDefault(); const p = go.closest(".term-panel");
        run(go.dataset.go, p ? (go.classList.contains("term-tk") ? (+p.dataset.i + 1) % 4 : +p.dataset.i) : null); return;
      }
      const lay = e.target.closest("[data-lay]"); if (lay) { PANELS = LAYOUTS[lay.dataset.lay].map(x => x.slice()); FOCUS = 0; paintAll(); save(); return; }
      const mx = e.target.closest(".tp-max"); if (mx) { const p = mx.closest(".term-panel"); ROOT.querySelector("#termGrid").classList.toggle("max"); p.classList.toggle("max"); paint(+p.dataset.i); return; }
      const pn = e.target.closest(".term-panel"); if (pn) setFocus(+pn.dataset.i);
    });
    document.addEventListener("keydown", e => {
      if (!ROOT || ROOT.hidden) return;
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || "");
      if (e.key === "/" && !typing) { e.preventDefault(); inp.focus(); }
      else if (e.key === "Escape") { inp.blur(); const g = $("#termGrid"); if (g.classList.contains("max")) { g.classList.remove("max"); ROOT.querySelectorAll(".term-panel.max").forEach(p => p.classList.remove("max")); paintAll(); } }
      else if (e.altKey && /^[1-4]$/.test(e.key)) { e.preventDefault(); setFocus(+e.key - 1); }
    });
    clocks(); setInterval(clocks, 1000);
  }
  function clocks() {
    const el = $("#termClocks"); if (!el) return;
    const now = new Date();
    const z = (tz, l, open) => { const t = now.toLocaleTimeString("pt-BR", { timeZone: tz, hour: "2-digit", minute: "2-digit" }); return `<span class="${open ? "open" : ""}"><b>${l}</b> ${t}</span>`; };
    const hm = tz => { const p = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false }).formatToParts(now);
      const g = k => (p.find(x => x.type === k) || {}).value; return { wd: g("weekday"), m: +g("hour") * 60 + +g("minute") }; };
    const b3 = hm("America/Sao_Paulo"), ny = hm("America/New_York"), wk = d => !["Sat", "Sun"].includes(d.wd);
    el.innerHTML = z("America/Sao_Paulo", "SP", wk(b3) && b3.m >= 600 && b3.m < 1075) + z("America/New_York", "NY", wk(ny) && ny.m >= 570 && ny.m < 960)
      + z("Europe/London", "LDN", false) + z("Asia/Tokyo", "TYO", false);
  }
  function setFocus(i) { FOCUS = i; ROOT.querySelectorAll(".term-panel").forEach(p => p.classList.toggle("focus", +p.dataset.i === i)); save(); }
  function status(msg, err) { const s = $("#termStatus"); if (s) { s.textContent = msg || ""; s.className = "term-status" + (err ? " err" : ""); } }
  function run(cmd, target) {
    const tok = String(cmd || "").trim().toUpperCase().split(/\s+/).filter(Boolean);
    if (!tok.length) return;
    let i = target != null ? target : FOCUS;
    if (/^[1-4]$/.test(tok[0])) { i = +tok.shift() - 1; }
    if (tok[0] === "?" || tok[0] === "AJUDA") tok[0] = "HELP";
    let fn = tok.find(x => FN[x]), rest = tok.filter(x => x !== fn);
    if (!fn) {                                           // só o ativo: reusa a função de ativo do painel ou abre o gráfico
      const cur = PANELS[i][0]; fn = FN[cur] && FN[cur].t ? cur : "GP";
    }
    if (FN[fn].t && !rest.length) rest = [PANELS[i][1] || "IBOV"];
    PANELS[i] = [fn, rest.join(" ")];
    setFocus(i); paint(i); save(); status(`${i + 1} ▸ ${fn}${rest.length ? " " + rest.join(" ") : ""}`);
  }
  function paint(i) {
    const p = ROOT.querySelector(`.term-panel[data-i="${i}"]`); if (!p) return;
    const [fn, arg] = PANELS[i], f = FN[fn] || FN.HELP;
    p.querySelector(".tp-code").textContent = fn; p.querySelector(".tp-title").textContent = tx(f.n[0], f.n[1]) + (arg ? " · " + arg : "");
    const body = p.querySelector(".tp-body");
    try { const r = f.run(body, arg || ""); if (r && r.catch) r.catch(e => { body.innerHTML = `<div class="term-empty">${esc(e.message || e)}</div>`; }); }
    catch (e) { body.innerHTML = `<div class="term-empty">${esc(e.message || e)}</div>`; }
  }
  const paintAll = () => { [0, 1, 2, 3].forEach(paint); setFocus(FOCUS); };

  window.S7Terminal = {
    async boot(api) {
      const first = !API; API = api; ROOT = $("#termRoot"); if (!ROOT) return;
      if (first) {
        let st = null; try { st = JSON.parse(LS.get("s7-term") || "null"); } catch (e) { st = null; }
        PANELS = st && Array.isArray(st.p) && st.p.length === 4 ? st.p : LAYOUTS.MERCADOS.map(x => x.slice());
        FOCUS = st && st.f >= 0 && st.f < 4 ? st.f : 0;
        shell();
        await loadFeeds(true); paintAll();
        setInterval(async () => {                         // feeds próprios: a cada 5 min repinta só o que é Seven7
          await loadFeeds(true); SIGS = null;
          PANELS.forEach((p, i) => { if (ownPanel(p) && p[0] !== "PORT") paint(i); });
        }, 5 * 60 * 1000);
      } else {                                            // login/sessão mudou: só os painéis com dados Seven7 (não recria widgets)
        await loadFeeds(true); SIGS = null;
        PANELS.forEach((p, i) => { if (ownPanel(p)) paint(i); });
      }
    },
  };
  if (window.__S7_TERM_API) { const a = window.__S7_TERM_API; delete window.__S7_TERM_API; window.S7Terminal.boot(a); }
})();
