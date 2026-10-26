/* ============ Seven7 Quant — painéis de análise do portfólio (Minha mesa + Terminal) ============
   Lê o JSON de portfolio_analytics.py (portfolio_stats.data.analytics) e desenha: saúde (nota + semáforos +
   diagnóstico), risco por ativo, drawdown, fronteira eficiente, sugestão HRP, correlação e "como calculamos".
   Sem dependências; SVG próprio. Uso: S7Quant.full(host, A, {lang}) ou as peças (health, risk, dd, frontier, hrp, corr). */
(function () {
  "use strict";
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let L = "pt";
  const tx = (pt, en) => (L === "en" ? en : pt);
  const loc = () => (L === "en" ? "en-US" : "pt-BR");
  const nf = (v, d = 1) => (v == null || !isFinite(v) ? "—" : new Intl.NumberFormat(loc(), { minimumFractionDigits: d, maximumFractionDigits: d }).format(v));
  const pc = (v, d = 1) => (v == null || !isFinite(v) ? "—" : nf(v * 100, d) + "%");
  const sp = (v, d = 1) => (v == null || !isFinite(v) ? "—" : (v > 0 ? "+" : "") + pc(v, d));
  let CUR = "USD";
  const money = v => (v == null || !isFinite(v) ? "—" : (CUR === "BRL" ? "R$ " : "US$ ") + new Intl.NumberFormat(loc(), { maximumFractionDigits: 0 }).format(v));
  const LUZ = ["red", "amber", "green"];
  const set = (A, o) => { L = (o && o.lang) || "pt"; CUR = (A && A.base) || "USD"; };

  function empty(host, A) {
    if (!A) { host.innerHTML = `<div class="q-empty">${tx("A análise do seu portfólio é calculada todo dia às 19:00. Adicione posições e volte depois do próximo ciclo.", "Your portfolio analysis runs daily at 19:00. Add positions and check back after the next run.")}</div>`; return true; }
    if (A.vazio) { host.innerHTML = `<div class="q-empty">${tx("Ainda não há posições abertas com histórico suficiente para a análise.", "No open positions with enough history to analyze yet.")}${warns(A)}</div>`; return true; }
    return false;
  }
  const warns = A => (A.avisos && A.avisos.length ? `<ul class="q-warn">${A.avisos.map(x => `<li>⚠ ${esc(x)}</li>`).join("")}</ul>` : "");

  // ---------------- saúde: nota + semáforos + diagnóstico ----------------
  function health(host, A, o) {
    set(A, o); if (empty(host, A)) return;
    const m = A.metricas || {}, cor = A.nota >= 75 ? "green" : A.nota >= 50 ? "amber" : "red";
    const T = {
      risco: [tx("Risco", "Risk"), x => tx(`Oscila ${pc(x.valor)} ao ano${x.ref ? ` · ${esc(m.bench)} ${pc(x.ref)}` : ""}`, `Moves ${pc(x.valor)} a year${x.ref ? ` · ${esc(m.bench)} ${pc(x.ref)}` : ""}`),
        [tx("acima do mercado", "above the market"), tx("parecido com o mercado", "similar to the market"), tx("abaixo do mercado", "below the market")]],
      queda: [tx("Queda atual", "Current drawdown"), x => tx(`${pc(x.valor)} do pico · pior em 2 anos ${pc(x.ref)}`, `${pc(x.valor)} from peak · worst in 2y ${pc(x.ref)}`),
        [tx("queda forte", "deep drawdown"), tx("em correção", "correcting"), tx("perto do topo", "near the high")]],
      concentracao: [tx("Concentração", "Concentration"), x => tx(`${esc(x.ativo)} = ${pc(x.valor, 0)} do risco`, `${esc(x.ativo)} = ${pc(x.valor, 0)} of risk`),
        [tx("um ativo domina", "one asset dominates"), tx("atenção", "watch"), tx("risco bem distribuído", "risk well spread")]],
      diversificacao: [tx("Diversificação", "Diversification"), x => tx(`${nf(x.valor)} apostas independentes em ${x.n} ativos`, `${nf(x.valor)} independent bets across ${x.n} assets`),
        [tx("pouca", "low"), tx("razoável", "fair"), tx("boa", "good")]],
      eficiencia: [tx("Eficiência", "Efficiency"), x => tx(`vol ${pc(x.valor)} · HRP ${pc(x.ref)}`, `vol ${pc(x.valor)} · HRP ${pc(x.ref)}`),
        [tx("dá para reduzir bem o risco", "risk can drop a lot"), tx("dá para melhorar", "room to improve"), tx("perto do eficiente", "near efficient")]],
    };
    const dxt = d => ({
      concentra: tx(`<b>${esc(d.ativo)}</b> é ${pc(d.w, 0)} do valor, mas <b>${pc(d.rc, 0)} do risco</b> do portfólio.`, `<b>${esc(d.ativo)}</b> is ${pc(d.w, 0)} of value but <b>${pc(d.rc, 0)} of risk</b>.`),
      vs_bench: tx(`Seu portfólio oscila <b>${pc(d.sig)}</b> ao ano; o ${esc(d.bench)}, ${pc(d.sig_b)}.`, `Your portfolio moves <b>${pc(d.sig)}</b> a year; the ${esc(d.bench)}, ${pc(d.sig_b)}.`),
      em_queda: tx(`Está <b>${pc(d.dd)}</b> abaixo do pico há ${d.dias} pregões.`, `It is <b>${pc(d.dd)}</b> below its peak for ${d.dias} sessions.`),
      hrp_ganho: tx(`Rebalanceando pelo <b>HRP</b>, a volatilidade cairia de ${pc(d.vol)} para <b>${pc(d.vol_hrp)}</b> e a pior queda de ${pc(d.dd)} para ${pc(d.dd_hrp)}.`,
        `Rebalancing by <b>HRP</b> would cut volatility from ${pc(d.vol)} to <b>${pc(d.vol_hrp)}</b> and the worst drawdown from ${pc(d.dd)} to ${pc(d.dd_hrp)}.`),
      livre: tx(`${pc(d.pct, 0)} do valor está em posições livres (sem sinal Seven7).`, `${pc(d.pct, 0)} of value is in free positions (no Seven7 signal).`),
      cambio: tx(`${pc(d.pct, 0)} do valor está em ${d.ccy} — o câmbio faz parte do seu risco.`, `${pc(d.pct, 0)} of value is in ${d.ccy} — FX is part of your risk.`),
    }[d.t] || "");
    host.innerHTML = `<div class="q-health">
      <div class="q-score q-${cor}"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="50" class="q-ring-bg"/>
        <circle cx="60" cy="60" r="50" class="q-ring" style="stroke-dasharray:${(A.nota / 100 * 314).toFixed(1)} 314"/></svg>
        <div class="q-score-v">${A.nota}<small>/100</small></div><div class="q-score-l">${tx("saúde do portfólio", "portfolio health")}</div></div>
      <div class="q-lights">${(A.luzes || []).map(x => { const t = T[x.k]; return t ? `<div class="q-light q-${LUZ[x.nivel]}">
        <span class="q-dot"></span><div><b>${t[0]}</b> <span class="q-tag">${t[2][x.nivel]}</span><small>${t[1](x)}</small></div></div>` : ""; }).join("")}</div>
      </div>
      ${A.dx && A.dx.length ? `<ul class="q-dx">${A.dx.map(d => `<li>${dxt(d)}</li>`).join("")}</ul>` : ""}
      <div class="q-meta">${tx("Valor analisado", "Value analyzed")} <b>${money(A.valor_total)}</b> · ${A.n_pos} ${tx("ativos", "assets")} · ${tx("moeda", "currency")} ${A.base}
        · ${tx("janela", "window")} ${m.janela || "—"} ${tx("pregões", "sessions")} · ${tx("atualizado", "updated")} ${new Date(A.asof).toLocaleString(loc(), { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</div>${warns(A)}`;
  }

  // ---------------- métricas ----------------
  function metrics(host, A, o) {
    set(A, o); if (empty(host, A)) return;
    const m = A.metricas;
    const it = [[tx("Volatilidade anual", "Annual volatility"), pc(m.vol), `${esc(m.bench)} ${pc(m.vol_bench)}`], [tx("Retorno anual (2a)", "Annual return (2y)"), sp(m.ret_ann), tx("com os pesos de hoje", "at today's weights")],
      [tx("Pior queda (2a)", "Max drawdown (2y)"), pc(m.max_dd), tx(`atual ${pc(m.dd_atual)}`, `now ${pc(m.dd_atual)}`)], ["VaR 95% (1 dia)", pc(m.var95, 2), tx("perda em 1 de cada 20 dias", "loss on 1 in 20 days")],
      ["ES 97,5% (1 dia)", pc(m.es975, 2), tx("média dos piores 2,5% dos dias", "avg of worst 2.5% days")], ["Beta", nf(m.beta, 2), tx(`vs ${m.bench}`, `vs ${m.bench}`)],
      [tx("Apostas efetivas", "Effective bets"), nf(m.enb), "1 / Σ RC²"], [tx("Correlação média", "Avg correlation"), nf(m.corr_media, 2), tx("entre os ativos", "between assets")]];
    host.innerHTML = `<div class="q-metrics">${it.map(([l, v, s]) => `<div class="q-m"><div class="q-ml">${l}</div><div class="q-mv">${v}</div><div class="q-ms">${s}</div></div>`).join("")}</div>`;
  }

  // ---------------- risco por ativo: peso vs contribuição ao risco ----------------
  function risk(host, A, o) {
    set(A, o); if (empty(host, A)) return;
    const as = (A.assets || []).slice(0, 18), mx = Math.max(...as.map(a => Math.max(a.w, a.rc)), 0.01);
    host.innerHTML = `<div class="q-legend"><span class="q-sw w"></span>${tx("peso no valor", "weight")}<span class="q-sw r"></span>${tx("parte do risco", "share of risk")}</div>
      <div class="q-risk">${as.map(a => `<div class="q-rrow ${a.rc > 1.5 * a.w && a.rc > 0.1 ? "hot" : ""}">
        <div class="q-rl"><b>${esc(a.label)}</b><small>${esc(a.cls)}${a.livre ? " · " + tx("livre", "free") : ""}</small></div>
        <div class="q-rbars"><span class="q-bw" style="width:${(a.w / mx * 100).toFixed(1)}%"></span><span class="q-br" style="width:${(Math.max(a.rc, 0) / mx * 100).toFixed(1)}%"></span></div>
        <div class="q-rv">${pc(a.w, 0)} / <b>${pc(a.rc, 0)}</b></div><div class="q-rx">σ ${pc(a.vol, 0)} · DD ${pc(a.max_dd, 0)}</div></div>`).join("")}</div>
      ${(A.assets || []).length > 18 ? `<div class="q-note">+${A.assets.length - 18} ${tx("ativos com menos risco", "lower-risk assets")}</div>` : ""}`;
  }

  // ---------------- drawdown (curva do portfólio de hoje nos últimos 2 anos) ----------------
  function dd(host, A, o) {
    set(A, o); if (empty(host, A)) return;
    const c = A.curva || []; if (c.length < 3) { host.innerHTML = ""; return; }
    const W = 640, H1 = 150, H2 = 90, P = 30, n = c.length;
    const X = i => P + i / (n - 1) * (W - P - 6);
    const vmin = Math.min(...c.map(x => x.v)), vmax = Math.max(...c.map(x => x.v)), dmin = Math.min(...c.map(x => x.dd), -0.01);
    const Y1 = v => 8 + (vmax - v) / (vmax - vmin || 1) * (H1 - 16), Y2 = d => H1 + 8 + (d / dmin) * (H2 - 16);
    const lineV = c.map((x, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y1(x.v).toFixed(1)}`).join("");
    const area = `M${X(0)},${H1 + 8}` + c.map((x, i) => `L${X(i).toFixed(1)},${Y2(x.dd).toFixed(1)}`).join("") + `L${X(n - 1)},${H1 + 8}Z`;
    const mi = c.reduce((b, x, i) => (x.dd < c[b].dd ? i : b), 0);
    host.innerHTML = `<svg class="q-dd" viewBox="0 0 ${W} ${H1 + H2}" role="img" aria-label="drawdown">
      <text x="2" y="14">${tx("valor (base 1)", "value (base 1)")}</text><path d="${lineV}" class="q-eq"/>
      <line x1="${P}" x2="${W - 6}" y1="${H1 + 8}" y2="${H1 + 8}" class="q-ax"/><path d="${area}" class="q-uw"/>
      <text x="2" y="${H1 + 22}">${tx("queda", "drawdown")}</text><text x="${X(mi)}" y="${Y2(c[mi].dd) + 12}" text-anchor="middle" class="q-min">${pc(c[mi].dd)}</text>
      <text x="${P}" y="${H1 + H2 - 2}">${esc(c[0].d)}</text><text x="${W - 6}" y="${H1 + H2 - 2}" text-anchor="end">${esc(c[n - 1].d)}</text></svg>
      <div class="q-note">${tx("Como o portfólio de HOJE (mesmos pesos) teria se comportado nos últimos 2 anos.", "How TODAY's portfolio (same weights) would have behaved over the last 2 years.")}</div>`;
  }

  // ---------------- fronteira eficiente ----------------
  function frontier(host, A, o) {
    set(A, o); if (empty(host, A)) return;
    const F = A.fronteira || {}; const pts = F.pts || [];
    if (pts.length < 2) { host.innerHTML = `<div class="q-empty">${tx("A fronteira precisa de pelo menos 2 ativos.", "The frontier needs at least 2 assets.")}</div>`; return; }
    // zoom na região que importa (os 4 pontos-chave), não no ativo mais volátil
    const key = [F.atual, F.hrp, F.minvar, F.maxsharpe].filter(Boolean);
    const vmax = Math.max(...key.map(p => p.vol)) * 2.4;
    const vis = p => p.vol <= vmax;
    const inView = [...pts.map(p => ({ vol: p[0], ret: p[1] })), ...(F.ativos || []), ...key].filter(vis);
    const rmin = Math.min(...inView.map(p => p.ret)), rmax = Math.max(...inView.map(p => p.ret));
    const W = 640, H = 300, P = 44, X = v => P + v / vmax * (W - P - 10), Y = r => 12 + (rmax - r) / (rmax - rmin || 1) * (H - P - 12);
    const curve = pts.filter(p => p[0] <= vmax).map((p, i) => `${i ? "L" : "M"}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join("");
    // rótulos em posições fixas diferentes para não se sobreporem quando os pontos ficam próximos
    const OFF = { you: [12, -10, "start"], hrp: [12, 16, "start"], mv: [-12, 16, "end"], ms: [-12, -10, "end"] };
    const big = (p, cls, l) => { const [dx, dy, an] = OFF[cls]; return `<g class="q-pt ${cls}"><circle cx="${X(p.vol)}" cy="${Y(p.ret)}" r="7"/>
      <text x="${X(p.vol) + dx}" y="${Y(p.ret) + dy}" text-anchor="${an}">${l}</text></g>`; };
    const fora = (F.ativos || []).filter(a => !vis(a)).length;
    const ticks = [0, .25, .5, .75, 1].map(f => f * vmax);
    host.innerHTML = `<svg class="q-front" viewBox="0 0 ${W} ${H}" role="img" aria-label="efficient frontier">
      ${ticks.map(v => `<line x1="${X(v)}" x2="${X(v)}" y1="12" y2="${H - P}" class="q-grid"/><text x="${X(v)}" y="${H - P + 16}" text-anchor="middle">${pc(v, 0)}</text>`).join("")}
      <text x="${W / 2}" y="${H - 6}" text-anchor="middle">${tx("risco (volatilidade anual)", "risk (annual volatility)")}</text>
      <text x="12" y="${H / 2}" transform="rotate(-90 12 ${H / 2})" text-anchor="middle">${tx("retorno esperado", "expected return")}</text>
      ${(F.ativos || []).filter(vis).map(a => `<circle cx="${X(a.vol)}" cy="${Y(a.ret)}" r="3" class="q-asset"><title>${esc(a.label)}: σ ${pc(a.vol)} · μ ${pc(a.ret)}</title></circle>`).join("")}
      <path d="${curve}" class="q-fcurve"/>
      ${big(F.minvar, "mv", tx("mín. variância", "min variance"))}${big(F.maxsharpe, "ms", tx("máx. Sharpe", "max Sharpe"))}
      ${big(F.hrp, "hrp", "HRP")}${big(F.atual, "you", tx("VOCÊ", "YOU"))}</svg>
      <div class="q-legend q-fleg"><span class="q-sw" style="background:#ff4d5e"></span>${tx("você hoje", "you today")} ${pc(F.atual.vol)}
        <span class="q-sw" style="background:var(--pos)"></span>HRP ${pc(F.hrp.vol)}<span class="q-sw" style="background:#9b8cff"></span>${tx("mín. variância", "min variance")} ${pc(F.minvar.vol)}
        <span class="q-sw" style="background:var(--warn)"></span>${tx("máx. Sharpe", "max Sharpe")} ${pc(F.maxsharpe.vol)}${fora ? ` · ${fora} ${tx("ativos mais voláteis fora da tela", "more volatile assets off-chart")}` : ""}</div>
      <div class="q-note">${tx("Curva = melhores combinações dos seus ativos (só compra). Os retornos esperados são estimativas ruidosas e foram encolhidos para a média: use a fronteira para ver <b>onde você está</b>, não como previsão. A sugestão de alocação é o HRP, que não depende de prever retorno.",
        "Curve = best long-only mixes of your assets. Expected returns are noisy estimates shrunk toward the mean: use it to see <b>where you stand</b>, not as a forecast. The allocation suggestion is HRP, which needs no return forecast.")}</div>`;
  }

  // ---------------- sugestão HRP ----------------
  function hrpView(host, A, o) {
    set(A, o); if (empty(host, A)) return;
    const H = A.hrp || {}, a = H.atual || {}, h = H.hrp || {};
    const rows = (A.assets || []).slice().sort((x, y) => Math.abs(y.delta_hrp) - Math.abs(x.delta_hrp)).slice(0, 15);
    const cmp = (l, x, y, inv) => `<tr><td>${l}</td><td class="num">${x}</td><td class="num"><b>${y}</b></td></tr>`;
    host.innerHTML = `<table class="q-tbl q-cmp"><thead><tr><th></th><th class="num">${tx("Hoje", "Today")}</th><th class="num">HRP</th></tr></thead><tbody>
      ${cmp(tx("Volatilidade", "Volatility"), pc(a.vol), pc(h.vol))}${cmp(tx("Pior queda (2a)", "Max drawdown"), pc(a.max_dd), pc(h.max_dd))}
      ${cmp("ES 97,5%", pc(a.es975, 2), pc(h.es975, 2))}${cmp(tx("Apostas efetivas", "Effective bets"), nf(a.enb), nf(h.enb))}</tbody></table>
      <table class="q-tbl"><thead><tr><th>${tx("Ativo", "Asset")}</th><th class="num">${tx("Hoje", "Today")}</th><th class="num">HRP</th><th class="num">${tx("Ajuste", "Change")}</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td><b>${esc(r.label)}</b>${r.sinal ? ` <small class="q-sig">${tx("sinal Seven7", "Seven7 signal")}</small>` : ""}</td><td class="num">${pc(r.w)}</td><td class="num">${pc(r.w_hrp)}</td>
        <td class="num ${r.delta_hrp > 0 ? "pos" : "neg"}">${r.delta_hrp > 0 ? tx("+ comprar ", "+ buy ") : tx("− vender ", "− sell ")}${money(Math.abs(r.delta_hrp))}</td></tr>`).join("")}</tbody></table>
      ${h.vol > a.vol * 1.03 ? `<div class="q-alert">${tx(`<b>Atenção:</b> aqui o HRP <b>aumentaria</b> a volatilidade (${pc(a.vol)} → ${pc(h.vol)}). Ele espalha o risco entre mais apostas (${nf(a.enb)} → ${nf(h.enb)}), mas seu portfólio de hoje já é menos volátil — normalmente porque um ativo de baixa volatilidade e baixa correlação (como o hedge) pesa muito. Se a sua prioridade é oscilar menos, mantenha; se é não depender de poucos ativos, siga o HRP.`,
        `<b>Note:</b> here HRP would <b>raise</b> volatility (${pc(a.vol)} → ${pc(h.vol)}). It spreads risk across more bets (${nf(a.enb)} → ${nf(h.enb)}), but today's portfolio is already less volatile — usually because a low-vol, low-correlation asset (like the hedge) weighs a lot. If your priority is lower swings, keep it; if it is not depending on few assets, follow HRP.`)}</div>` : ""}
      <div class="q-note">${tx("HRP (López de Prado): agrupa ativos parecidos e divide o risco entre os grupos — não usa previsão de retorno, por isso é estável. Posições com sinal Seven7 já têm tamanho pela regra de risco da estratégia; o HRP olha o portfólio inteiro. É uma sugestão, não uma recomendação individual.",
        "HRP (López de Prado): clusters similar assets and splits risk across clusters — no return forecast, hence stable. Seven7-signal positions are already sized by the strategy's risk rule; HRP looks at the whole portfolio. A suggestion, not individual advice.")}</div>`;
  }

  // ---------------- correlação ----------------
  function corr(host, A, o) {
    set(A, o); if (empty(host, A)) return;
    const C = A.corr || {}, lb = C.labels || [], M = C.m || [];
    if (lb.length < 2) { host.innerHTML = ""; return; }
    const col = v => v >= 0 ? `rgba(255,77,94,${Math.min(1, v).toFixed(2)})` : `rgba(38,208,124,${Math.min(1, -v).toFixed(2)})`;
    host.innerHTML = `<div class="q-corr" style="grid-template-columns:90px repeat(${lb.length},minmax(18px,1fr))">
      <span></span>${lb.map(l => `<span class="q-ch">${esc(l)}</span>`).join("")}
      ${M.map((r, i) => `<span class="q-cl">${esc(lb[i])}</span>${r.map((v, j) => `<span class="q-cc" style="background:${col(v)}" title="${esc(lb[i])} × ${esc(lb[j])}: ${nf(v, 2)}"></span>`).join("")}`).join("")}</div>
      <div class="q-note">${tx("Vermelho = andam juntos (diversificam pouco) · verde = andam em direções opostas (protegem).", "Red = move together (little diversification) · green = move oppositely (hedge).")}</div>`;
  }

  function formulas(host) {
    host.innerHTML = `<details class="q-form"><summary>${tx("Como calculamos (fórmulas)", "How we calculate (formulas)")}</summary><ul>
      <li><b>${tx("Retornos", "Returns")}</b>: ${tx("diários, na moeda do portfólio (câmbio pela PTAX/BCB), últimos 504 pregões, pesos de hoje.", "daily, in portfolio currency (FX by BCB PTAX), last 504 sessions, today's weights.")}</li>
      <li><b>${tx("Volatilidade", "Volatility")}</b>: σ = σ<sub>d</sub>·√252</li>
      <li><b>Drawdown</b>: DD<sub>t</sub> = V<sub>t</sub> / max<sub>s≤t</sub> V<sub>s</sub> − 1</li>
      <li><b>VaR 95% / ES 97,5%</b>: ${tx("históricos de 1 dia — quantil de 5% e média abaixo do quantil de 2,5%", "1-day historical — 5% quantile and mean below the 2.5% quantile")}</li>
      <li><b>${tx("Covariância", "Covariance")}</b>: Σ = δ·m·I + (1−δ)·S ${tx("(Ledoit-Wolf, δ ótimo)", "(Ledoit-Wolf, optimal δ)")}</li>
      <li><b>${tx("Contribuição ao risco", "Risk contribution")}</b>: RC<sub>i</sub> = w<sub>i</sub>(Σw)<sub>i</sub> / (wᵀΣw) · ${tx("apostas efetivas", "effective bets")} = 1/ΣRC<sub>i</sub>²</li>
      <li><b>Beta</b>: β = cov(r<sub>p</sub>, r<sub>b</sub>) / var(r<sub>b</sub>)</li>
      <li><b>${tx("Fronteira", "Frontier")}</b>: min wᵀΣw ${tx("sujeito a", "s.t.")} wᵀμ = alvo, Σw = 1, w ≥ 0 · μ ${tx("encolhido 50% para a média", "shrunk 50% to the mean")}</li>
      <li><b>HRP</b>: ${tx("distância", "distance")} d = √(½(1−ρ)) → ${tx("árvore (single linkage) → ordem quase-diagonal → bissecção recursiva com variância inversa", "tree (single linkage) → quasi-diagonal order → recursive bisection by inverse variance")}</li>
      <li><b>${tx("Renda fixa", "Fixed income")}</b>: ${tx("acúmulo pelo indexador (CDI/Selic/IPCA do BCB) ou taxa pré — sem marcação a mercado (o risco de juros de títulos longos não aparece).", "accrual by index (BCB CDI/Selic/IPCA) or fixed rate — no mark-to-market (long-bond rate risk not shown).")}</li></ul></details>`;
  }

  function full(host, A, o) {
    set(A, o);
    if (empty(host, A)) return;
    host.innerHTML = `<div class="q-card"><div class="q-h">${tx("Saúde do portfólio", "Portfolio health")}</div><div id="qHealth"></div></div>
      <div class="q-card"><div class="q-h">${tx("Números de risco", "Risk numbers")}</div><div id="qMetrics"></div></div>
      <div class="q-2col"><div class="q-card"><div class="q-h">${tx("Quem carrega o risco", "Who carries the risk")}</div><div id="qRisk"></div></div>
        <div class="q-card"><div class="q-h">${tx("Fronteira eficiente — onde você está", "Efficient frontier — where you stand")}</div><div id="qFront"></div></div></div>
      <div class="q-2col"><div class="q-card"><div class="q-h">${tx("Drawdown", "Drawdown")}</div><div id="qDD"></div></div>
        <div class="q-card"><div class="q-h">${tx("Otimização sugerida (HRP)", "Suggested optimization (HRP)")}</div><div id="qHRP"></div></div></div>
      <div class="q-card"><div class="q-h">${tx("Correlação entre os ativos", "Correlation between assets")}</div><div id="qCorr"></div></div><div id="qForm"></div>`;
    const g = id => host.querySelector("#" + id);
    health(g("qHealth"), A, o); metrics(g("qMetrics"), A, o); risk(g("qRisk"), A, o); frontier(g("qFront"), A, o);
    dd(g("qDD"), A, o); hrpView(g("qHRP"), A, o); corr(g("qCorr"), A, o); formulas(g("qForm"));
  }

  window.S7Quant = { full, health, metrics, risk, dd, frontier, hrp: hrpView, corr, formulas };
  if (window.__s7QuantPending) { const f = window.__s7QuantPending; delete window.__s7QuantPending; f(); }
})();
