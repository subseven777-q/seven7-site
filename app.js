/* ============ Seven7 — public renderer ============ */
/* Consome APENAS o payload público (metrics.json). Nenhum nível de sinal,
   preço de entrada/saída ou detalhe de método está presente nos dados. */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const fmtPct = v => (v == null ? "—" : (v > 0 ? "+" : "") + v.toFixed(Math.abs(v) >= 100 ? 0 : 1) + "%");
  const fmtNum = v => (v == null ? "—" : v.toLocaleString("pt-BR"));
  const money = (v, cur) => (v == null ? "—" : (v < 0 ? "-" : "") + (cur === "BRL" ? "R$" : "$") + Math.abs(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 }));
  const elh = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };

  let DATA = null;
  const boot = window.__DATA__ ? Promise.resolve(window.__DATA__) : fetch("data/metrics.json").then(r => r.json());
  boot.then(d => { DATA = d; render(); })
    .catch(e => { $("#heroStats").innerHTML = '<div class="hstat"><div class="v">—</div><div class="l">dados indisponíveis</div></div>'; console.error(e); });

  function render() {
    buildTicker(); buildHero(); buildTrust(); buildDisclaimer();
    initSection(["US", "BR", "GLOBAL"], "#bookTabs", renderTrack);
    initSection(["US", "BR"], "#quantTabsHost", renderMetrics, "#quant .section-head");
    renderHedge();
    initSection(["US", "BR"], "#radarTabs", renderRadar);
    initSection(["US", "BR"], "#replayTabs", renderReplay);
    renderPricing(); initBilling(); initTheme();
  }

  /* ---- hedge de cauda ---- */
  function renderHedge() {
    const h = DATA.hedge;
    if (!h) { const s = document.getElementById("hedge"); if (s) s.style.display = "none"; return; }
    const u = h.unhedged, hh = h.hedged;
    const hero = [
      { v: `−${h.dd_reduction}pp`, l: "redução do drawdown máximo", good: true },
      { v: `${u.worst_year}%<span class="arrow">→</span><b class="pos">${hh.worst_year}%</b>`, l: "pior ano (12 meses)" },
      { v: `${u.sharpe}<span class="arrow">→</span><b class="pos">${hh.sharpe}</b>`, l: "Sharpe (risco × retorno)" },
    ];
    const pct = v => (v > 0 ? "+" : "") + v.toFixed(1) + "%";
    const dd = v => "-" + Math.abs(v).toFixed(1) + "%";
    const rows = [
      ["Max drawdown", dd(u.max_dd), dd(hh.max_dd), hh.max_dd < u.max_dd],
      ["Pior ano", pct(u.worst_year), pct(hh.worst_year), hh.worst_year > u.worst_year],
      ["Sharpe", u.sharpe.toFixed(2), hh.sharpe.toFixed(2), hh.sharpe > u.sharpe],
      ["Volatilidade anual", u.ann_vol.toFixed(1) + "%", hh.ann_vol.toFixed(1) + "%", hh.ann_vol < u.ann_vol],
      ["CAGR", pct(u.cagr), pct(hh.cagr), hh.cagr > u.cagr],
    ];
    const body = rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td>
      <td class="col-h ${r[3] ? "hc-better" : ""}">${r[2]}</td></tr>`).join("");
    $("#hedgeHost").innerHTML = `
      <div class="hedge-head">${hero.map(t => `<div class="hedge-hero"><div class="v ${t.good ? "good" : ""}">${t.v}</div><div class="l">${t.l}</div></div>`).join("")}</div>
      <div class="hedge-wrap">
        <div class="hedge-table-card"><table class="hedge-table">
          <thead><tr><th>Métrica (${h.period.years} anos)</th><th>Sem hedge</th><th>Com hedge</th></tr></thead>
          <tbody>${body}</tbody></table></div>
        <div class="hedge-elite">
          <div class="he-lock">🔒</div>
          <div class="he-t">O ativo é exclusivo do Elite</div>
          <div class="he-s">${h.base_weight}% do capital em proteção sempre, elevado a ${h.stress_weight}% em estresse de mercado. Membros Elite recebem qual é o ativo e o sinal de quando alternar.</div>
          <a class="btn btn-primary" href="#pricing">Assinar Elite</a>
        </div>
      </div>
      <p class="hedge-note">Avaliado ao longo de ${h.period.years} anos — janela que inclui o estresse de 2022. Correlação com a carteira: ${h.corr_to_equity} (proteção real, não mais do mesmo).</p>`;
  }

  /* ---- planos ---- */
  const PLANS = [
    {
      tier: "BEGINNER", monthly: 50, disc: 0.10, featured: false,
      feats: [[true, "Sinais do mercado brasileiro (IBrX)"],
      [true, "As 7 Magníficas dos EUA — AAPL · MSFT · GOOGL · AMZN · NVDA · META · TSLA"],
      [true, "Desempenho e histórico de 10 anos"],
      [false, "Signal Radar completo (US + BR)"],
      [false, "Sinal de Hedge exclusivo"],
      [false, "Comunidade + vídeos semanais"]],
      cta: "Assinar Beginner",
    },
    {
      tier: "PRO", monthly: 149, disc: 0.15, featured: true, badge: "MAIS POPULAR",
      feats: [[true, "Todos os sinais — EUA (S&P 100) + Brasil (IBrX)"],
      [true, "Signal Radar completo + watchlist"],
      [true, "Métricas quantitativas completas"],
      [true, "Alertas em tempo real"],
      [false, "Sinal de Hedge exclusivo"],
      [false, "Comunidade + vídeos semanais"]],
      cta: "Assinar Pro",
    },
    {
      tier: "ELITE", monthly: 299, disc: 0.20, featured: false,
      cycleFeat: {
        annual: [true, "Estratégia completa revelada na assinatura", "hot"],
        monthly: [true, "Estratégia completa revelada após 6 meses de plano", "hot"],
      },
      feats: [[true, "Tudo do Pro"],
      [true, "Robô automatizado em MT5 — opera os sinais sozinho (bônus)"],
      [true, "Sinal de Hedge exclusivo — 15%→30% em ativo de proteção descorrelacionado, acionado em estresse de mercado"],
      [true, "Comunidade: vídeos semanais de mercado, expectativas e leitura"],
      [true, "Exportar histórico (CSV) + acesso à API"],
      [true, "Suporte prioritário"]],
      cta: "Assinar Elite",
    },
  ];
  let CYCLE = "monthly";
  function renderPricing() {
    $("#pricingGrid").innerHTML = PLANS.map(p => {
      const annualMo = Math.round(p.monthly * (1 - p.disc));
      const price = CYCLE === "annual" ? annualMo : p.monthly;
      const sub = CYCLE === "annual"
        ? `<span class="price-strike">R$${p.monthly}</span> cobrado R$${(annualMo * 12).toLocaleString("pt-BR")}/ano`
        : "Cancele quando quiser";
      const save = CYCLE === "annual" ? `<div class="price-save">−${Math.round(p.disc * 100)}%</div>` : "";
      let featList = p.feats.slice();
      if (p.cycleFeat) featList = [featList[0], p.cycleFeat[CYCLE], ...featList.slice(1)];
      const feats = featList.map(f => `<li class="${f[0] ? "" : "off"} ${f[2] || ""}">${f[1]}</li>`).join("");
      return `<div class="price-card ${p.featured ? "featured" : ""}">
        ${p.badge ? `<div class="price-badge">${p.badge}</div>` : ""}${save}
        <div class="price-tier">${p.tier}</div>
        <div class="price-amt">R$${price} <span>/ mês</span></div>
        <div class="price-sub">${sub}</div>
        <ul class="price-feats">${feats}</ul>
        <a class="btn ${p.featured ? "btn-primary" : "btn-ghost"} btn-block" href="#">${p.cta}</a>
      </div>`;
    }).join("");
  }
  function initBilling() {
    const t = $("#billingToggle"); if (!t) return;
    t.querySelectorAll(".bt-opt").forEach(b => b.onclick = () => {
      t.querySelectorAll(".bt-opt").forEach(x => x.classList.remove("on"));
      b.classList.add("on"); CYCLE = b.dataset.cycle; renderPricing();
    });
  }

  const labelOf = k => ({ US: "🇺🇸 EUA · S&P 100", BR: "🇧🇷 Brasil · IBrX", GLOBAL: "🌐 Global 50/50" }[k] || k);
  function initSection(keys, hostSel, fn, insertAfter) {
    let host = $(hostSel);
    if (!host && insertAfter) { host = elh("div", "book-tabs"); host.id = hostSel.slice(1); $(insertAfter).after(host); }
    host.innerHTML = "";
    keys.forEach((k, i) => {
      const b = elh("button", "book-tab" + (i === 0 ? " on" : ""), labelOf(k));
      b.onclick = () => { [...host.children].forEach(c => c.classList.remove("on")); b.classList.add("on"); fn(k); };
      host.appendChild(b);
    });
    fn(keys[0]);
  }

  /* ---- ticker (só tickers, sem níveis) ---- */
  function buildTicker() {
    const names = [];
    ["US", "BR"].forEach(r => (DATA.books[r]?.signals_summary?.sample || []).forEach(t => names.push(t)));
    const one = () => names.map(t =>
      `<span class="tick"><span class="tk">${t}</span><span class="badge buy">COMPRA</span><span class="badge active">AO VIVO</span></span>`).join("");
    $("#tickerTrack").innerHTML = one() + one();
  }

  /* ---- hero ---- */
  function buildHero() {
    const us = DATA.books.US;
    const nSym = Object.values(DATA.books).reduce((a, b) => a + b.n_symbols_traded, 0);
    const stats = [
      { v: us?.headline.sharpe ?? "—", l: "Sharpe (US, 10a)" },
      { v: fmtPct(us?.headline.cagr), l: "CAGR anual (US)" },
      { v: (us?.track_record.win_rate ?? "—") + "%", l: "win rate (US)" },
      { v: nSym, l: "ativos monitorados" },
      { v: "10a", l: "de dados reais" },
    ];
    $("#heroStats").innerHTML = stats.map(s => `<div class="hstat"><div class="v">${s.v}</div><div class="l">${s.l}</div></div>`).join("");
    $("#updated").innerHTML = `<span class="dot"></span> Dados atualizados até <b style="color:var(--ink-2);margin-left:4px">${DATA.data_through}</b>`;
  }

  /* ---- track: stat row + equity + drawdown ---- */
  function bookOrCombined(k) {
    if (k === "GLOBAL") return { headline: DATA.combined.headline, equity_curve: DATA.combined.equity_curve, currency: "", combined: true };
    return DATA.books[k];
  }
  function renderTrack(k) {
    const b = bookOrCombined(k), h = b.headline, cur = b.currency, tr = b.track_record;
    let cards;
    if (b.combined) {
      cards = [["CAGR", fmtPct(h.cagr), h.cagr >= 0 ? "pos" : "neg"], ["Sharpe", h.sharpe, ""],
      ["Max drawdown", "-" + Math.abs(h.max_dd) + "%", "neg"], ["Vol anual", h.ann_vol.toFixed(1) + "%", ""]];
    } else {
      cards = [["Win rate", tr.win_rate + "%", ""], ["Trades (10a)", fmtNum(tr.total_trades), ""],
      ["Retorno acumulado", fmtPct(tr.total_pnl_pct), tr.total_pnl_pct >= 0 ? "pos" : "neg"], ["Profit factor", tr.profit_factor ?? "—", ""]];
    }
    $("#statRow").innerHTML = cards.map(c => `<div class="stat"><div class="v ${c[2]}">${c[1]}</div><div class="l">${c[0]}</div></div>`).join("");

    const benchName = b.combined ? null : (k === "US" ? "índice (buy & hold)" : "índice BR (buy & hold)");
    $("#equitySub").textContent = `${h.total_return != null ? "Retorno total " + fmtPct(h.total_return) + " · " : ""}CAGR ${fmtPct(h.cagr)} · Sharpe ${h.sharpe} · MaxDD -${Math.abs(h.max_dd)}%`;
    $("#equityLegend").innerHTML = `<span class="lg"><span class="sw" style="background:var(--series)"></span>Seven7</span>` +
      (benchName ? `<span class="lg"><span class="sw dash"></span>${benchName}</span>` : "");
    lineChart($("#equityChart"), b.equity_curve, {
      keys: benchName ? ["e", "b"] : ["e"], colors: ["var(--series)", "var(--bench)"],
      labels: ["Seven7", benchName || ""], dash: [false, true], asPctGrowth: true,
    });

    let dd = b.drawdown_curve;
    if (!dd) { let pk = -Infinity; dd = b.equity_curve.map(p => { pk = Math.max(pk, p.e); return { d: p.d, e: p.e / pk - 1 }; }); }
    $("#ddSub").textContent = `Pior queda de pico a vale: ${(Math.min(...dd.map(p => p.e)) * 100).toFixed(1)}%`;
    areaChart($("#ddChart"), dd, { color: "var(--neg)" });
  }

  /* ---- métricas simples (sem método) ---- */
  function renderMetrics(k) {
    const b = DATA.books[k], h = b.headline, vp = b.validation_public, tr = b.track_record;
    const tiles = [
      { v: fmtPct(h.cagr), l: "CAGR (10 anos)", d: `Retorno total ${fmtPct(h.total_return)} no período.` },
      { v: h.sharpe, l: "Sharpe anualizado", d: `IC95% [${h.sharpe_ci[0]}, ${h.sharpe_ci[1]}]. ${vp.sharpe_significant ? "Estatisticamente significativo." : "Cautela: IC amplo."}` },
      { v: h.sortino, l: "Sortino", d: `Retorno por unidade de risco de queda. Calmar ${h.calmar}.` },
      { v: "-" + Math.abs(h.max_dd) + "%", l: "Max drawdown", d: `Pior janela de pico a vale em 10 anos.` },
      { v: tr.win_rate + "%", l: "Win rate", d: `${fmtNum(tr.total_trades)} operações · profit factor ${tr.profit_factor}.` },
      { v: h.ann_vol.toFixed(1) + "%", l: "Volatilidade anual", d: `Estável ao longo do histórico.` },
      { v: "top " + Math.max(1, Math.round(100 - vp.pf_percentile)) + "%", l: "vs. 10 mil aleatórias", d: `Melhor que ${vp.pf_percentile.toFixed(0)}% de estratégias aleatórias — não é sorte.` },
      { v: "-" + vp.mc_p95_dd + "%", l: "Cenário adverso (p95)", d: `Perda máxima esperada no pior 5% das simulações.` },
    ];
    $("#quantGrid").innerHTML = tiles.map(t => `<div class="qcard"><div class="qv">${t.v}</div><div class="ql">${t.l}</div><div class="qd">${t.d}</div></div>`).join("");
    heatmap($("#monthlyHeatmap"), b.monthly_returns);
  }

  /* ---- radar bloqueado (teaser de membros) ---- */
  function renderRadar(k) {
    const b = DATA.books[k], s = b.signals_summary;
    $("#radarAsOf").textContent = `Fechamento de ${DATA.data_through}. ${b.regime_on ? "Sistema operando." : "Sistema em modo defensivo (caixa) neste momento."}`;
    const host = $("#radarHost");
    const rows = (s.sample.length ? s.sample : []).slice(0, 8).map(t =>
      `<tr><td class="tk-cell">${t}</td><td><span class="dir-buy">▲ COMPRA</span></td>
       <td class="num"><span class="lockval">000.00</span></td><td class="num"><span class="lockval">000.00</span></td>
       <td class="num"><span class="lockval">000.00</span></td></tr>`).join("");
    host.innerHTML = `
      <div class="radar-summary">
        <div class="rs-pill"><div class="v pos">${s.active}</div><div class="l">sinais ativos</div></div>
        <div class="rs-pill"><div class="v">${s.total}</div><div class="l">ativos no radar</div></div>
        <div class="rs-pill"><div class="v">${s.waiting}</div><div class="l">aguardando gatilho</div></div>
      </div>
      <div class="locked-wrap">
        <table class="locked-table">
          <thead><tr><th>Ativo</th><th>Direção</th><th class="num">Entrada</th><th class="num">Stop</th><th class="num">Alvo</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="locked-cta">
          <div class="lk">🔒</div>
          <div class="lt">Os níveis de entrada, stop e alvo são exclusivos para assinantes.</div>
          <div class="ls">Veja onde entrar, onde proteger e onde realizar — em ${s.total} ativos, atualizado todo dia.</div>
          <a class="btn btn-primary" href="#pricing">Assinar e ver os sinais</a>
        </div>
      </div>`;
  }

  /* ---- replay: MÉDIA MENSAL (sem trades individuais nem pares) ---- */
  const MO_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  function moLabel(ym) { const [y, m] = ym.split("-"); return `${MO_PT[+m - 1]}/${y.slice(2)}`; }
  function renderReplay(k) {
    const rows = (DATA.books[k].monthly_results || []).slice().reverse();
    const maxAbs = Math.max(0.01, ...rows.map(r => Math.abs(r.avg_r)));
    const body = rows.map(r => {
      const pos = r.avg_r >= 0, w = Math.round(Math.abs(r.avg_r) / maxAbs * 90) + 6;
      return `<tr>
        <td class="mr-mo">${moLabel(r.month)}</td>
        <td class="num">${r.n_trades}</td>
        <td class="num">${r.win_rate.toFixed(0)}%</td>
        <td class="num"><span class="mr-r ${pos ? "pos" : "neg"}">${pos ? "+" : ""}${r.avg_r.toFixed(2)}R</span></td>
        <td><span class="mr-bar" style="width:${w}px;background:${pos ? "var(--pos)" : "var(--neg)"}"></span></td>
      </tr>`;
    }).join("");
    $("#replayHost").innerHTML = `<table class="mr-table">
      <thead><tr><th>Mês</th><th class="num">Operações</th><th class="num">Acerto</th><th class="num">Resultado médio</th><th>Tendência</th></tr></thead>
      <tbody>${body}</tbody></table>`;
  }

  /* ---- por que confiar ---- */
  function buildTrust() {
    $("#trustGrid").innerHTML = DATA.meta.trust.map(r => `<div class="rule"><div class="n">✓</div><p>${r}</p></div>`).join("");
  }
  function buildDisclaimer() { $("#disclaimer").textContent = DATA.disclaimer; }

  /* ================= SVG CHARTS ================= */
  const W = 1000, H = 340, PAD = { t: 16, r: 16, b: 26, l: 46 };
  const NS = "http://www.w3.org/2000/svg";
  const mk = (t, a) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); return e; };
  function svgEl(w, h) { const s = document.createElementNS(NS, "svg"); s.setAttribute("viewBox", `0 0 ${w} ${h}`); s.setAttribute("preserveAspectRatio", "none"); s.style.width = "100%"; s.style.height = h + "px"; return s; }
  function scaleXY(pts, keys) {
    let lo = Infinity, hi = -Infinity;
    pts.forEach(p => keys.forEach(k => { if (p[k] != null) { lo = Math.min(lo, p[k]); hi = Math.max(hi, p[k]); } }));
    if (lo === hi) { hi += 1; lo -= 1; }
    const pad = (hi - lo) * 0.06; lo -= pad; hi += pad;
    return { x: i => PAD.l + (i / (pts.length - 1)) * (W - PAD.l - PAD.r), y: v => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b), lo, hi };
  }
  function lineChart(host, pts, opt) {
    host.innerHTML = ""; if (!pts || pts.length < 2) return;
    const keys = opt.keys, { x, y, lo, hi } = scaleXY(pts, keys), svg = svgEl(W, H);
    const fmt = opt.asPctGrowth ? (v => ((v - 1) * 100).toFixed(0) + "%") : (v => v.toFixed(2));
    for (let i = 0; i <= 5; i++) { const v = lo + (hi - lo) * i / 5; svg.appendChild(mk("line", { x1: PAD.l, x2: W - PAD.r, y1: y(v), y2: y(v), class: "gridline" })); const tx = mk("text", { x: PAD.l - 8, y: y(v) + 4, class: "axis-label", "text-anchor": "end" }); tx.textContent = fmt(v); svg.appendChild(tx); }
    const step = Math.max(1, Math.floor(pts.length / 6));
    for (let i = 0; i < pts.length; i += step) { const tx = mk("text", { x: x(i), y: H - 6, class: "axis-label", "text-anchor": "middle" }); tx.textContent = pts[i].d.slice(0, 4); svg.appendChild(tx); }
    keys.forEach((k, ki) => {
      let d = ""; pts.forEach((p, i) => { if (p[k] == null) return; d += (d ? "L" : "M") + x(i).toFixed(1) + " " + y(p[k]).toFixed(1); });
      const path = mk("path", { d, fill: "none", stroke: opt.colors[ki], "stroke-width": ki === 0 ? 2.2 : 1.6, "stroke-linejoin": "round", "vector-effect": "non-scaling-stroke" });
      if (opt.dash && opt.dash[ki]) path.setAttribute("stroke-dasharray", "5 4");
      svg.appendChild(path);
    });
    const cross = mk("line", { class: "crosshair", y1: PAD.t, y2: H - PAD.b, x1: 0, x2: 0, opacity: 0 });
    const dot0 = mk("circle", { r: 3.5, fill: opt.colors[0], opacity: 0 });
    const hit = mk("rect", { x: 0, y: 0, width: W, height: H, fill: "transparent" });
    svg.appendChild(cross); svg.appendChild(dot0); svg.appendChild(hit);
    const tip = $("#tooltip");
    hit.addEventListener("pointermove", ev => {
      const r = svg.getBoundingClientRect(), px = (ev.clientX - r.left) / r.width * W;
      let i = Math.round((px - PAD.l) / (W - PAD.l - PAD.r) * (pts.length - 1)); i = Math.max(0, Math.min(pts.length - 1, i));
      const p = pts[i];
      cross.setAttribute("x1", x(i)); cross.setAttribute("x2", x(i)); cross.setAttribute("opacity", 1);
      dot0.setAttribute("cx", x(i)); dot0.setAttribute("cy", y(p[keys[0]])); dot0.setAttribute("opacity", 1);
      let rows = `<div class="tt-d">${p.d}</div>`;
      keys.forEach((k, ki) => { if (p[k] == null) return; rows += `<div class="tt-row"><span class="k">${opt.labels[ki]}</span><span class="val" style="color:${opt.colors[ki]}">${fmtPct((p[k] - 1) * 100)}</span></div>`; });
      tip.innerHTML = rows; tip.hidden = false;
      tip.style.left = Math.min(ev.clientX + 14, window.innerWidth - 160) + "px"; tip.style.top = (ev.clientY - 10) + "px";
    });
    hit.addEventListener("pointerleave", () => { tip.hidden = true; cross.setAttribute("opacity", 0); dot0.setAttribute("opacity", 0); });
    host.appendChild(svg);
  }
  function areaChart(host, pts, opt) {
    host.innerHTML = ""; if (!pts || pts.length < 2) return;
    const h2 = 200, minV = Math.min(...pts.map(p => p.e), -0.001);
    const yD = v => PAD.t + (1 - (v - minV) / (0 - minV)) * (h2 - PAD.t - PAD.b);
    const xD = i => PAD.l + (i / (pts.length - 1)) * (W - PAD.l - PAD.r), svg = svgEl(W, h2);
    [0, .25, .5, .75, 1].forEach(f => { const v = minV * f; svg.appendChild(mk("line", { x1: PAD.l, x2: W - PAD.r, y1: yD(v), y2: yD(v), class: "gridline" })); const tx = mk("text", { x: PAD.l - 8, y: yD(v) + 4, class: "axis-label", "text-anchor": "end" }); tx.textContent = (v * 100).toFixed(0) + "%"; svg.appendChild(tx); });
    let d = "M" + xD(0) + " " + yD(0); pts.forEach((p, i) => d += "L" + xD(i).toFixed(1) + " " + yD(p.e).toFixed(1)); d += "L" + xD(pts.length - 1) + " " + yD(0) + "Z";
    svg.appendChild(mk("path", { d, fill: opt.color, "fill-opacity": .18, stroke: opt.color, "stroke-width": 1.6, "vector-effect": "non-scaling-stroke" }));
    const step = Math.max(1, Math.floor(pts.length / 6));
    for (let i = 0; i < pts.length; i += step) { const tx = mk("text", { x: xD(i), y: h2 - 6, class: "axis-label", "text-anchor": "middle" }); tx.textContent = pts[i].d.slice(0, 4); svg.appendChild(tx); }
    host.appendChild(svg);
  }
  function heatmap(host, mr) {
    host.innerHTML = "";
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"], scale = 12;
    const table = elh("table", "heat-table");
    let head = "<tr><th></th>" + months.map(m => `<th>${m}</th>`).join("") + `<th class="heat-ytd">Ano</th></tr>`, rows = "";
    mr.years.forEach((yr, ri) => {
      let tds = `<td class="yr">${yr}</td>`;
      mr.table[ri].forEach((v, mi) => {
        if (v == null) { tds += `<td><div class="heat-cell empty">·</div></td>`; return; }
        const mag = Math.min(1, Math.abs(v) / scale) * 78 + 8, base = v >= 0 ? "var(--heat-pos)" : "var(--heat-neg)";
        tds += `<td><div class="heat-cell" style="background:color-mix(in srgb, ${base} ${mag.toFixed(0)}%, var(--heat-mid))" title="${months[mi]} ${yr}: ${v}%">${v.toFixed(0)}</div></td>`;
      });
      const yt = mr.ytd[ri], ym = Math.min(1, Math.abs(yt) / (scale * 2.5)) * 78 + 8;
      tds += `<td class="heat-ytd"><div class="heat-cell" style="background:color-mix(in srgb, ${yt >= 0 ? "var(--heat-pos)" : "var(--heat-neg)"} ${ym.toFixed(0)}%, var(--heat-mid))">${yt >= 0 ? "+" : ""}${yt.toFixed(0)}</div></td>`;
      rows += `<tr>${tds}</tr>`;
    });
    table.innerHTML = head + rows; host.appendChild(table);
  }

  /* ---- theme ---- */
  function initTheme() {
    $("#themeToggle").onclick = () => {
      const cur = document.documentElement.getAttribute("data-theme");
      document.documentElement.setAttribute("data-theme", cur === "dark" ? "light" : "dark");
      document.querySelectorAll(".book-tabs").forEach(h => { const on = h.querySelector(".on"); if (on) on.click(); });
    };
  }
})();
