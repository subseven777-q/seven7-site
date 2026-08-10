/* ============ Seven7 — multi-page app (bilingual EN/PT) ============ */
/* Static multi-page site. Shared nav/footer are injected here so they live in
   ONE place. Each page renders only the sections whose containers exist.
   Public data only (metrics.json): no signal levels, no method, no ETF name. */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const elh = (tag, c, h) => { const e = document.createElement(tag); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };

  // Supabase (chaves PÚBLICAS — seguras no cliente; a segurança vem das regras RLS)
  const SUPABASE_URL = "https://ehqxuveyprrmjfcqmkhs.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVocXh1dmV5cHJybWpmY3Fta2hzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1ODcwNDgsImV4cCI6MjEwMTE2MzA0OH0.KB2mXvqiFgc7SgKDLQU4uvplC-UGcFgE9SaauCQDAhU";
  let sb = null, USER = null, PROFILE = null;
  const isMember = () => PROFILE && PROFILE.status === "active";

  let LANG = localStorage.getItem("seven7-lang") || "en";
  const locale = () => (LANG === "en" ? "en-US" : "pt-BR");
  const MONTHS = { en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], pt: ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"] };
  const nf = (v, d = 1) => new Intl.NumberFormat(locale(), { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
  const fmtPct = v => (v == null ? "—" : (v > 0 ? "+" : "") + nf(v, Math.abs(v) >= 100 ? 0 : 1) + "%");
  const fmtNum = v => (v == null ? "—" : new Intl.NumberFormat(locale()).format(v));
  const interp = (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => (o[k] != null ? o[k] : ""));
  const t = k => (T[k] && T[k][LANG] != null ? T[k][LANG] : k);

  /* Preencha quando o Stripe estiver pronto: links de checkout hospedado.
     Ex.: STRIPE_LINKS.PRO.monthly = "https://buy.stripe.com/xxxx". Vazio => vai ao registro. */
  const STRIPE_LINKS = {
    BEGINNER: { monthly: "https://buy.stripe.com/bJeaEZfcDfWL3Lw3jC8Ra05", annual: "https://buy.stripe.com/4gM3cxe8z5i795Q8DW8Ra02" },
    PRO:      { monthly: "https://buy.stripe.com/14A3cxfcD11R0zk3jC8Ra04", annual: "https://buy.stripe.com/00waEZc0rdODbdYf2k8Ra01" },
    ELITE:    { monthly: "https://buy.stripe.com/5kQ00l6G75i7bdY7zS8Ra03", annual: "https://buy.stripe.com/6oU3cxaWndOD95Q4nG8Ra00" },
  };
  /* Link "no-code" do Portal do Cliente Stripe (Settings -> Billing -> Customer portal).
     Formato https://billing.stripe.com/p/login/... — deixe vazio p/ cair no suporte por e-mail. */
  const STRIPE_PORTAL = "https://billing.stripe.com/p/login/6oU3cxaWndOD95Q4nG8Ra00";

  /* Sizing por Kelly — full Kelly f* = W - (1-W)/payoff, do track record real 10a
     (payoff = ganho médio / perda média). US: W65.1% payoff .96 -> 28.8%;
     BR: W55.5% payoff .97 -> 9.7%. Ladder 1 / ½ / ¼ / ⅛. Padrão ¼ Kelly
     (posicionamento institucional conservador, coerente com o alvo de 6.5% VaR). */
  const KELLY_FULL = { US: 28.8, BR: 9.7 };
  const KELLY_FRACS = [[1, "1 Kelly"], [0.5, "½ Kelly"], [0.25, "¼ Kelly"], [0.125, "⅛ Kelly"]];
  const KELLY_DEFAULT = 0.125;
  const savedKelly = () => { const v = parseFloat(localStorage.getItem("seven7-kelly")); return KELLY_FRACS.some(f => f[0] === v) ? v : KELLY_DEFAULT; };
  const kellyPct = (market, frac) => +(( KELLY_FULL[market] || KELLY_FULL.US) * frac).toFixed(1);

  /* ---------------- i18n dictionary ---------------- */
  const T = {
    "brand.tag": { en: "QUANTIFIED INVESTING", pt: "INVESTIMENTOS QUANTIFICADOS" },
    "nav.perf": { en: "Performance", pt: "Desempenho" },
    "nav.metrics": { en: "Metrics", pt: "Métricas" },
    "nav.signals": { en: "Signals", pt: "Sinais" },
    "nav.replay": { en: "Replay", pt: "Replay" },
    "nav.portfolio": { en: "Portfolio", pt: "Portfólio" },
    "nav.plans": { en: "Plans", pt: "Planos" },
    "nav.login": { en: "Log in", pt: "Entrar" },
    "nav.trial": { en: "Free trial", pt: "Teste grátis" },
    "hero.eyebrow": { en: "QUANTIFIED INVESTING · US + BRAZIL STOCKS", pt: "INVESTIMENTOS QUANTIFICADOS · AÇÕES EUA + BRASIL" },
    "hero.h1": { en: 'Less promise.<br>More <span class="accent">proof.</span>', pt: 'Menos promessa.<br>Mais <span class="accent">prova.</span>' },
    "hero.lede": {
      en: "A systematic engine generates the signals — no opinions, no guesses, no after-the-fact heroes. And, unlike everyone else, you judge by the numbers: <strong>10 years of real, auditable performance</strong>, updated every day.",
      pt: "Um motor sistemático gera os sinais — sem opinião, sem palpite, sem herói pós-fato. E, diferente de todo mundo, você julga pelos números: <strong>10 anos de desempenho real e auditável</strong>, atualizado todo dia."
    },
    "hero.cta1": { en: "Start 7-day free trial", pt: "Começar teste de 7 dias" },
    "hero.cta2": { en: "See the numbers →", pt: "Ver os números →" },
    "home.explore": { en: "EXPLORE", pt: "EXPLORE" },
    "home.exploreH": { en: "Everything, on the record.", pt: "Tudo, registrado." },
    "card.perf.d": { en: "10-year equity curve, win rate and drawdown — with the tail hedge applied.", pt: "Curva de 10 anos, win rate e drawdown — já com o hedge de cauda aplicado." },
    "card.metrics.d": { en: "Sharpe, Sortino, monthly returns and the checks that unmask a pretty backtest.", pt: "Sharpe, Sortino, retornos mensais e os testes que desmascaram um backtest bonito." },
    "card.signals.d": { en: "What the system sees right now — live signals across US + BR.", pt: "O que o sistema vê agora — sinais ao vivo em US + BR." },
    "card.replay.d": { en: "Closed results month by month — wins and losses, no filter.", pt: "Resultados fechados mês a mês — ganhos e perdas, sem filtro." },
    "card.open": { en: "Open →", pt: "Abrir →" },
    "track.kicker": { en: "TRACK RECORD", pt: "TRACK RECORD" },
    "track.h2": { en: "Numbers that don't have feelings.", pt: "Números que não têm sentimento." },
    "track.sub": { en: "Event-driven backtest over 10 years of real daily data, with costs. Pick a book:", pt: "Backtest event-driven sobre 10 anos de dados diários reais, com custos. Escolha o livro:" },
    "chart.equity.title": { en: "Equity curve — 10 years", pt: "Evolução do capital — 10 anos" },
    "chart.dd.title": { en: "Underwater drawdown", pt: "Drawdown submerso" },
    "metrics.kicker": { en: "METRICS · THE DIFFERENCE", pt: "MÉTRICAS · O DIFERENCIAL" },
    "metrics.h2": { en: "Proof, not promise.", pt: "A prova, não a promessa." },
    "metrics.sub": { en: "Performance measured over <em>10 years of real data</em>, with costs — the metrics that matter to judge a system.", pt: "Desempenho medido sobre <em>10 anos de dados reais</em>, com custos — as métricas que importam para julgar um sistema." },
    "heatmap.title": { en: "Monthly returns (%)", pt: "Retornos mensais (%)" },
    "heatmap.sub": { en: "Green = positive month · red = negative. YTD column on the right.", pt: "Verde = mês positivo · vermelho = negativo. Coluna do ano à direita." },
    "heatmap.year": { en: "Year", pt: "Ano" },
    "hedge.kicker": { en: "PROTECTION · TAIL HEDGE · ELITE", pt: "PROTEÇÃO · HEDGE DE CAUDA · ELITE" },
    "hedge.h2": { en: "Insurance that pays for itself.", pt: "Um seguro que se paga." },
    "hedge.sub": { en: "Under market stress, the portfolio automatically raises protection in an <em>uncorrelated asset</em>. Which asset? Exclusive to Elite members.", pt: "Em estresse de mercado, a carteira eleva a proteção em um <em>ativo descorrelacionado</em>. Qual é o ativo? Exclusivo de quem é Elite." },
    "radar.kicker": { en: "SIGNAL RADAR", pt: "SIGNAL RADAR" },
    "radar.h2": { en: "What the system sees right now.", pt: "O que o sistema está vendo agora." },
    "radar.subA": { en: "Live signals per asset.", pt: "Sinais ao vivo por ativo." },
    "replay.kicker": { en: "LIVE REPLAY", pt: "LIVE REPLAY" },
    "replay.h2": { en: "Closed results, month by month.", pt: "Resultados concluídos, mês a mês." },
    "replay.sub": { en: "Average performance of the trades closed each month — activity, win rate, and result.", pt: "Desempenho médio das operações fechadas em cada mês — atividade, acerto e resultado." },
    "trust.kicker": { en: "WHY TRUST US", pt: "POR QUE CONFIAR" },
    "trust.h2": { en: "You don't believe. You check.", pt: "Você não acredita. Você confere." },
    "trust.sub": { en: "Quantified investing: every decision comes from a model, every result is on the record.", pt: "Investimentos quantificados: cada decisão vem de um modelo, cada resultado fica registrado." },
    "trust.b1": { en: "10 years of real data, with costs — not a marketing curve.", pt: "10 anos de dados reais, com custos — não é curva de marketing." },
    "trust.b2": { en: "100% fixed rules: no discretion, no guessing, no after-the-fact heroes.", pt: "Regras 100% fixas: zero discricionário, zero palpite, zero herói pós-fato." },
    "trust.b3": { en: "Every trade recorded and marked to market — numbers, not narrative.", pt: "Toda operação registrada e marcada a mercado — números, não narrativa." },
    "trust.b4": { en: "Validated against 10,000 random strategies before going live.", pt: "Validado contra 10 mil estratégias aleatórias antes de ir ao ar." },
    "pricing.kicker": { en: "PLANS", pt: "PLANOS" },
    "pricing.h2": { en: "Three tiers. One model.", pt: "Três níveis. Um modelo." },
    "pricing.sub": { en: "Launch pricing. Start with a 7-day free trial — no card.", pt: "Preço de lançamento. Comece com 7 dias grátis — sem cartão." },
    "billing.monthly": { en: "Monthly", pt: "Mensal" },
    "billing.annual": { en: "Annual", pt: "Anual" },
    "billing.save": { en: "save up to 20%", pt: "economize até 20%" },
    "price.cancel": { en: "Cancel anytime", pt: "Cancele quando quiser" },
    "price.billed": { en: "billed", pt: "cobrado" },
    "price.year": { en: "yr", pt: "ano" },
    "price.perMonth": { en: "/ mo", pt: "/ mês" },
    "hs.sharpe": { en: "Sharpe (US, 10y)", pt: "Sharpe (US, 10a)" },
    "hs.cagr": { en: "Annual CAGR (US)", pt: "CAGR anual (US)" },
    "hs.win": { en: "win rate (US)", pt: "win rate (US)" },
    "hs.assets": { en: "monitored assets", pt: "ativos monitorados" },
    "hs.years": { en: "of real data", pt: "de dados reais" },
    "updated": { en: "Data updated through", pt: "Dados atualizados até" },
    "stat.win": { en: "Win rate", pt: "Win rate" },
    "stat.trades": { en: "Trades (10y)", pt: "Trades (10a)" },
    "stat.cumret": { en: "Cumulative return", pt: "Retorno acumulado" },
    "stat.pf": { en: "Profit factor", pt: "Profit factor" },
    "stat.cagr": { en: "CAGR", pt: "CAGR" },
    "stat.sharpe": { en: "Sharpe", pt: "Sharpe" },
    "stat.maxdd": { en: "Max drawdown", pt: "Max drawdown" },
    "stat.vol": { en: "Annual vol", pt: "Vol anual" },
    "legend.stratBench": { en: "index (buy & hold)", pt: "índice (buy & hold)" },
    "legend.stratBenchBR": { en: "BR index (buy & hold)", pt: "índice BR (buy & hold)" },
    "m.totalRet": { en: "Total return", pt: "Retorno total" },
    "m.maxDD": { en: "MaxDD", pt: "MaxDD" },
    "dd.worst": { en: "Worst peak-to-trough:", pt: "Pior queda de pico a vale:" },
    "mt.cagr.l": { en: "CAGR (10 years)", pt: "CAGR (10 anos)" },
    "mt.cagr.d": { en: "The average yearly return, already compounded — what your money grew, per year.", pt: "O retorno médio ao ano, já composto — o quanto seu dinheiro rendeu por ano." },
    "mt.sharpe.l": { en: "Annualized Sharpe", pt: "Sharpe anualizado" },
    "mt.sharpe.d": { en: "Return earned for each unit of risk. Above 1 is good, above 2 is excellent.", pt: "Retorno obtido para cada unidade de risco. Acima de 1 é bom, acima de 2 é excelente." },
    "mt.sortino.l": { en: "Sortino", pt: "Sortino" },
    "mt.sortino.d": { en: "Like Sharpe, but only counts the risk of losing — it ignores 'good' upside swings.", pt: "Como o Sharpe, mas só conta o risco de perder — ignora as oscilações 'boas' para cima." },
    "mt.maxdd.l": { en: "Max drawdown", pt: "Max drawdown" },
    "mt.maxdd.d": { en: "The worst fall from a peak to a low — how deep the pain got at its worst.", pt: "A pior queda de um topo até um fundo — o quanto doeu no pior momento." },
    "mt.win.l": { en: "Win rate", pt: "Win rate" },
    "mt.win.d": { en: "Share of trades that ended in profit.", pt: "Fração das operações que terminaram no lucro." },
    "mt.vol.l": { en: "Annual volatility", pt: "Volatilidade anual" },
    "mt.vol.d": { en: "How much returns swing in a year — lower means a smoother ride.", pt: "O quanto os retornos oscilam no ano — menor significa trajetória mais suave." },
    "mt.drag.l": { en: "Vol drag / year", pt: "Vol drag / ano" },
    "mt.drag.d": { en: "Return quietly lost to volatility — choppier returns compound to less. Lower is better.", pt: "Retorno perdido silenciosamente para a volatilidade — retornos mais irregulares compõem menos. Menor é melhor." },
    "mt.pct.v": { en: "top {x}%", pt: "top {x}%" },
    "mt.pct.l": { en: "vs. 10,000 random", pt: "vs. 10 mil aleatórias" },
    "mt.pct.d": { en: "Beats {y}% of random strategies — evidence it's skill, not luck.", pt: "Supera {y}% de estratégias aleatórias — evidência de skill, não sorte." },
    "mt.adv.l": { en: "Adverse scenario (p95)", pt: "Cenário adverso (p95)" },
    "mt.adv.d": { en: "The loss to expect in a really bad year — the worst 5% of scenarios.", pt: "A perda a esperar num ano bem ruim — os piores 5% dos cenários." },
    "radar.asof": { en: "Close of", pt: "Fechamento de" },
    "radar.on": { en: "System operating.", pt: "Sistema operando." },
    "radar.off": { en: "System in defensive mode (cash) right now.", pt: "Sistema em modo defensivo (caixa) neste momento." },
    "radar.active": { en: "active signals", pt: "sinais ativos" },
    "radar.total": { en: "assets on radar", pt: "ativos no radar" },
    "radar.waiting": { en: "awaiting trigger", pt: "aguardando gatilho" },
    "radar.buy": { en: "▲ BUY", pt: "▲ COMPRA" },
    "radar.hAsset": { en: "Asset", pt: "Ativo" },
    "radar.hDir": { en: "Direction", pt: "Direção" },
    "radar.hEntry": { en: "Entry", pt: "Entrada" },
    "radar.hStop": { en: "Stop", pt: "Stop" },
    "radar.hTarget": { en: "Target", pt: "Alvo" },
    "radar.lockT": { en: "Entry, stop and target levels are for subscribers only.", pt: "Os níveis de entrada, stop e alvo são exclusivos para assinantes." },
    "radar.lockS": { en: "See where to enter, protect and take profit — across {n} assets, updated daily.", pt: "Veja onde entrar, proteger e realizar — em {n} ativos, atualizado todo dia." },
    "radar.lockCta": { en: "Subscribe and see the signals", pt: "Assinar e ver os sinais" },
    "sig.loading": { en: "Loading signals…", pt: "Carregando sinais…" },
    "sig.err": { en: "Couldn't load signals. Please refresh.", pt: "Não foi possível carregar os sinais. Atualize a página." },
    "sig.all": { en: "All", pt: "Todos" },
    "sig.active": { en: "active", pt: "ativos" },
    "sig.monitoring": { en: "monitoring", pt: "em monitoração" },
    "sig.total": { en: "on radar", pt: "no radar" },
    "sig.flat": { en: "in cash", pt: "em caixa" },
    "sig.none": { en: "No assets in this view right now.", pt: "Nenhum ativo nesta visão no momento." },
    "sig.updated": { en: "updated", pt: "atualizado" },
    "sig.state": { en: "State", pt: "Estado" },
    "sig.ticker": { en: "Asset", pt: "Ativo" },
    "sig.price": { en: "Price", pt: "Preço" },
    "sig.entry": { en: "Entry", pt: "Entrada" },
    "sig.stop": { en: "Stop", pt: "Stop" },
    "sig.tp": { en: "Target", pt: "Alvo" },
    "sig.cc": { en: "Covered call", pt: "Covered call" },
    "sig.stActive": { en: "ACTIVE", pt: "ATIVO" },
    "sig.stMon": { en: "MONITORING", pt: "MONITORANDO" },
    "sig.stFlat": { en: "CASH", pt: "CAIXA" },
    "sig.openTV": { en: "Open in TradingView", pt: "Abrir no TradingView" },
    "sig.allocLbl": { en: "Kelly sizing (% of deposit to buy)", pt: "Sizing de Kelly (% do depósito p/ comprar)" },
    "sig.buyCalc": { en: "Buy ≈ <b>{shares}</b> shares · {notional} ({pct}% of deposit) · real risk ≈ {risk} ({riskpct}%), capped by the stop", pt: "Comprar ≈ <b>{shares}</b> ações · {notional} ({pct}% do depósito) · risco real ≈ {risk} ({riskpct}%), limitado pelo stop" },
    "sig.buyNoDep": { en: "Set your initial deposit on the Portfolio page to see exactly how much to buy.", pt: "Defina seu depósito inicial na página Portfólio para ver exatamente quanto comprar." },
    "sig.kellyHint": { en: "This is how much of your deposit to <b>buy</b> — not risk. The stop caps each trade's real loss, so even a bad streak is a drawdown, not ruin. Fractional shares/lots work on MT5 brokers (e.g. Exness, from 0.01). ⅛ Kelly mirrors the metrics' 6.5% VaR posture.", pt: "Isto é quanto do seu depósito <b>comprar</b> — não é risco. O stop limita a perda real de cada trade, então mesmo uma sequência ruim é drawdown, não ruína. Frações de ação/lote funcionam em corretoras MT5 (ex.: Exness, a partir de 0,01). ⅛ de Kelly espelha a postura de 6,5% VaR das métricas." },
    "sig.addBtn": { en: "＋ Portfolio", pt: "＋ Portfólio" },
    "sig.added": { en: "Added ✓", pt: "Adicionado ✓" },
    "sig.goPortfolio": { en: "view portfolio →", pt: "ver portfólio →" },
    "sig.addErr": { en: "Couldn't add.", pt: "Não deu para adicionar." },
    "pf.needLoginSub": { en: "Log in to build and track your portfolio.", pt: "Entre para montar e acompanhar seu portfólio." },
    "pf.deposit": { en: "Initial deposit", pt: "Depósito inicial" },
    "pf.save": { en: "Save", pt: "Salvar" },
    "pf.saved": { en: "Saved ✓ (metrics update at the next daily run)", pt: "Salvo ✓ (as métricas atualizam no próximo ciclo diário)" },
    "pf.value": { en: "Portfolio value", pt: "Valor do portfólio" },
    "pf.return": { en: "Total return", pt: "Retorno total" },
    "pf.win": { en: "Win rate", pt: "Win rate" },
    "pf.dd": { en: "Max drawdown", pt: "Max drawdown" },
    "pf.drag": { en: "Vol drag", pt: "Vol drag" },
    "pf.open": { en: "Open positions", pt: "Posições abertas" },
    "pf.you": { en: "You", pt: "Você" },
    "pf.chart": { en: "You vs Buy & Hold (SPY · BOVA11)", pt: "Você vs Buy & Hold (SPY · BOVA11)" },
    "pf.added": { en: "Added", pt: "Adicionado" },
    "pf.alloc": { en: "% deposit", pt: "% depósito" },
    "pf.current": { en: "Current", pt: "Atual" },
    "pf.pl": { en: "P&L", pt: "Resultado" },
    "pf.won": { en: "WON", pt: "GANHOU" },
    "pf.lost": { en: "LOST", pt: "PERDEU" },
    "pf.openst": { en: "OPEN", pt: "ABERTA" },
    "pf.pending": { en: "PENDING", pt: "PENDENTE" },
    "pf.remove": { en: "Remove", pt: "Remover" },
    "pf.computing": { en: "Full metrics (drawdown, vol drag, benchmark curve) are computed daily — they'll appear after the next update.", pt: "As métricas completas (drawdown, vol drag, curva comparativa) são calculadas diariamente — aparecem após a próxima atualização." },
    "pf.emptyT": { en: "Your portfolio is empty", pt: "Seu portfólio está vazio" },
    "pf.emptyS": { en: "Add a signal to your portfolio to track it — deposit, allocation, P&L, drawdown, all vs SPY & BOVA11.", pt: "Adicione um sinal ao portfólio para acompanhar — depósito, alocação, resultado, drawdown, tudo vs SPY e BOVA11." },
    "pf.emptyCta": { en: "Go to Signals", pt: "Ir para Sinais" },
    "rep.month": { en: "Month", pt: "Mês" },
    "rep.trades": { en: "Trades", pt: "Operações" },
    "rep.win": { en: "Win rate", pt: "Acerto" },
    "rep.avg": { en: "Avg result", pt: "Resultado médio" },
    "rep.trend": { en: "Trend", pt: "Tendência" },
    "hg.ddRed": { en: "max drawdown reduction", pt: "redução do drawdown máximo" },
    "hg.worst": { en: "worst year (12 months)", pt: "pior ano (12 meses)" },
    "hg.sharpe": { en: "Sharpe (risk × return)", pt: "Sharpe (risco × retorno)" },
    "hg.metric": { en: "Metric", pt: "Métrica" },
    "hg.years": { en: "years", pt: "anos" },
    "hg.without": { en: "Without hedge", pt: "Sem hedge" },
    "hg.with": { en: "With hedge", pt: "Com hedge" },
    "hg.rMaxdd": { en: "Max drawdown", pt: "Max drawdown" },
    "hg.rWorst": { en: "Worst year", pt: "Pior ano" },
    "hg.rSharpe": { en: "Sharpe", pt: "Sharpe" },
    "hg.rVol": { en: "Annual volatility", pt: "Volatilidade anual" },
    "hg.rCagr": { en: "CAGR", pt: "CAGR" },
    "hg.eliteT": { en: "The asset is Elite-exclusive", pt: "O ativo é exclusivo do Elite" },
    "hg.eliteS": { en: "{base}% of capital in protection at all times, raised to {stress}% under stress. Elite members get which asset it is and the signal to switch.", pt: "{base}% do capital em proteção sempre, elevado a {stress}% em estresse. Membros Elite recebem qual é o ativo e o sinal de quando alternar." },
    "hg.eliteCta": { en: "Subscribe to Elite", pt: "Assinar Elite" },
    "hg.note": { en: "Measured over {years} years — a window that includes the 2022 stress. Correlation to the portfolio: {corr}.", pt: "Avaliado ao longo de {years} anos — janela que inclui o estresse de 2022. Correlação com a carteira: {corr}." },
    // cherry on top (mistério — mecanismo oculto, só métricas)
    "cc.kicker": { en: "THE CHERRY ON TOP · ELITE", pt: "A CEREJA DO BOLO · ELITE" },
    "cc.h2": { en: "The cherry on top.", pt: "A cereja do bolo." },
    "cc.sub": { en: "An exclusive Elite layer lifts every metric that matters — more return, better risk-adjusted — on the very same trades, with no extra risk. What it is stays behind the Elite door. The numbers don't.", pt: "Uma camada exclusiva do Elite eleva cada métrica que importa — mais retorno, melhor risco-retorno — nas mesmas operações, sem risco a mais. O que é fica atrás da porta do Elite. Os números, não." },
    "cc.hCagr": { en: "extra CAGR / year", pt: "CAGR extra / ano" },
    "cc.hSharpe": { en: "Sharpe (risk × return)", pt: "Sharpe (risco × retorno)" },
    "cc.hSortino": { en: "Sortino (downside risk)", pt: "Sortino (risco de queda)" },
    "cc.hPrem": { en: "extra return / trade", pt: "retorno extra / operação" },
    "cc.metric": { en: "Metric (10 years)", pt: "Métrica (10 anos)" },
    "cc.stocks": { en: "Stocks only", pt: "Só ações" },
    "cc.withcc": { en: "+ The cherry", pt: "+ A cereja" },
    "cc.rCagr": { en: "CAGR", pt: "CAGR" },
    "cc.rSharpe": { en: "Sharpe", pt: "Sharpe" },
    "cc.rSortino": { en: "Sortino", pt: "Sortino" },
    "cc.rMaxdd": { en: "Max drawdown", pt: "Max drawdown" },
    "cc.eliteT": { en: "The cherry is Elite-exclusive", pt: "A cereja é exclusiva do Elite" },
    "cc.eliteS": { en: "Same trades, no extra risk taken — just a bigger result. Elite members get the full recipe and the live signal.", pt: "As mesmas operações, sem risco a mais — só um resultado maior. Membros Elite recebem a receita completa e o sinal ao vivo." },
    "cc.eliteCta": { en: "Subscribe to Elite", pt: "Assinar Elite" },
    "cc.note": { en: "These figures are modeled and conservative, over 10 years of real prices — to be validated live. The recipe is revealed to Elite members.", pt: "Números modelados e conservadores, sobre 10 anos de preços reais — a validar ao vivo. A receita é revelada aos membros Elite." },
    // home teaser
    "cherry.teaserH": { en: "There's a cherry on top.", pt: "Tem uma cereja no bolo." },
    "cherry.teaserSub": { en: "An Elite-only layer that lifts every number — on the same trades, no extra risk. See the difference.", pt: "Uma camada só do Elite que eleva cada número — nas mesmas operações, sem risco a mais. Veja a diferença." },
    "cherry.teaserCta": { en: "See the cherry →", pt: "Ver a cereja →" },
    "tick.buy": { en: "BUY", pt: "COMPRA" },
    "tick.live": { en: "LIVE", pt: "AO VIVO" },
    "book.us": { en: "🇺🇸 US · S&P 100", pt: "🇺🇸 EUA · S&P 100" },
    "book.br": { en: "🇧🇷 Brazil · IBrX", pt: "🇧🇷 Brasil · IBrX" },
    "book.global": { en: "🌐 Global 50/50", pt: "🌐 Global 50/50" },
    "disclaimer": { en: "Backtest results over 10 years of real data. A mostly-bull-market window; the Sharpe is optimistic. Software and market information — not investment advice. Past performance does not guarantee future results.", pt: "Resultados de backtest sobre 10 anos de dados reais. Janela majoritariamente de bull market; o Sharpe é otimista. Software e informação de mercado — não é recomendação de investimento. Rentabilidade passada não garante resultado futuro." },
    "footer.copy": { en: "© 2026 Seven7 · Quantified Investing. All rights reserved.", pt: "© 2026 Seven7 · Investimentos Quantificados. Todos os direitos reservados." },
    // auth
    "auth.login.title": { en: "Log in", pt: "Entrar" },
    "auth.login.sub": { en: "Access your signals and dashboard.", pt: "Acesse seus sinais e painel." },
    "auth.email": { en: "Email", pt: "E-mail" },
    "auth.password": { en: "Password", pt: "Senha" },
    "auth.login.submit": { en: "Log in", pt: "Entrar" },
    "auth.login.no": { en: "Don't have an account?", pt: "Não tem conta?" },
    "auth.login.signup": { en: "Create one", pt: "Criar conta" },
    "auth.register.title": { en: "Create your account", pt: "Crie sua conta" },
    "auth.register.sub": { en: "Start your 7-day free trial. No card required.", pt: "Comece seu teste de 7 dias. Sem cartão." },
    "auth.name": { en: "Full name", pt: "Nome completo" },
    "auth.register.submit": { en: "Create account", pt: "Criar conta" },
    "auth.register.have": { en: "Already have an account?", pt: "Já tem conta?" },
    "auth.register.login": { en: "Log in", pt: "Entrar" },
    "auth.soon": { en: "Accounts are launching soon — we saved your interest. We'll email you the moment sign-ups open.", pt: "As contas estão sendo lançadas — registramos seu interesse. Avisaremos por e-mail assim que abrir." },
    "auth.checkEmail": { en: "Account created! Check your inbox to confirm your email — then log in.", pt: "Conta criada! Confira seu e-mail para confirmar o endereço — depois é só entrar." },
    "auth.loginOk": { en: "Logged in. Welcome back!", pt: "Login feito. Bem-vindo de volta!" },
    "auth.err": { en: "Couldn't complete: {msg}", pt: "Não deu certo: {msg}" },
    "auth.logout": { en: "Log out", pt: "Sair" },
    "auth.unavailable": { en: "Sign-in is temporarily unavailable. Please try again shortly.", pt: "O acesso está temporariamente indisponível. Tente novamente em instantes." },
    "acct.kicker": { en: "ACCOUNT", pt: "CONTA" },
    "acct.title": { en: "Your account", pt: "Sua conta" },
    "acct.name": { en: "Name", pt: "Nome" },
    "acct.email": { en: "Email", pt: "E-mail" },
    "acct.plan": { en: "Plan", pt: "Plano" },
    "acct.status": { en: "Status", pt: "Situação" },
    "acct.free": { en: "Free", pt: "Grátis" },
    "acct.active": { en: "Active subscriber", pt: "Assinante ativo" },
    "acct.inactive": { en: "No active subscription", pt: "Sem assinatura ativa" },
    "acct.upsell": { en: "Unlock the live signal levels, the hedge asset and the cherry recipe.", pt: "Libere os níveis dos sinais ao vivo, o ativo do hedge e a receita da cereja." },
    "acct.subscribe": { en: "See plans", pt: "Ver planos" },
    "acct.manage": { en: "Manage subscription", pt: "Gerenciar assinatura" },
    "acct.needLogin": { en: "You're not logged in", pt: "Você não está logado" },
    "acct.needLoginSub": { en: "Log in to see your account and subscription.", pt: "Entre para ver sua conta e assinatura." },
    "auth.orTrial": { en: "or start a free trial", pt: "ou comece um teste grátis" },
    "page.plans.trial": { en: "Includes a 7-day free trial · cancel anytime", pt: "Inclui teste grátis de 7 dias · cancele quando quiser" },
  };

  /* ---------------- plans (USD) ---------------- */
  const PLANS = [
    {
      tier: "BEGINNER", monthly: 9, disc: 0.10, featured: false,
      feats: [
        [true, { en: "Brazilian market signals (IBrX)", pt: "Sinais do mercado brasileiro (IBrX)" }],
        [true, { en: "The Magnificent 7 (US) — AAPL · MSFT · GOOGL · AMZN · NVDA · META · TSLA", pt: "As 7 Magníficas dos EUA — AAPL · MSFT · GOOGL · AMZN · NVDA · META · TSLA" }],
        [true, { en: "10-year performance and history", pt: "Desempenho e histórico de 10 anos" }],
        [false, { en: "Full Signal Radar (US + BR)", pt: "Signal Radar completo (US + BR)" }],
        [false, { en: "Exclusive Hedge signal", pt: "Sinal de Hedge exclusivo" }],
        [false, { en: "Community + weekly videos", pt: "Comunidade + vídeos semanais" }],
      ],
      cta: { en: "Get Beginner", pt: "Assinar Beginner" },
    },
    {
      tier: "PRO", monthly: 29, disc: 0.15, featured: true,
      badge: { en: "MOST POPULAR", pt: "MAIS POPULAR" },
      feats: [
        [true, { en: "All signals — US (S&P 100) + Brazil (IBrX)", pt: "Todos os sinais — EUA (S&P 100) + Brasil (IBrX)" }],
        [true, { en: "Full Signal Radar + watchlist", pt: "Signal Radar completo + watchlist" }],
        [true, { en: "Complete quantitative metrics", pt: "Métricas quantitativas completas" }],
        [true, { en: "Real-time alerts", pt: "Alertas em tempo real" }],
        [false, { en: "Exclusive Hedge signal", pt: "Sinal de Hedge exclusivo" }],
        [false, { en: "Community + weekly videos", pt: "Comunidade + vídeos semanais" }],
      ],
      cta: { en: "Get Pro", pt: "Assinar Pro" },
    },
    {
      tier: "ELITE", monthly: 59, disc: 0.20, featured: false,
      cycleFeat: {
        annual: [true, { en: "Full strategy revealed on subscription", pt: "Estratégia completa revelada na assinatura" }, "hot"],
        monthly: [true, { en: "Full strategy revealed after 6 months", pt: "Estratégia completa revelada após 6 meses de plano" }, "hot"],
      },
      feats: [
        [true, { en: "Everything in Pro", pt: "Tudo do Pro" }],
        [true, { en: "🍒 The cherry on top — an exclusive layer that lifts every metric", pt: "🍒 A cereja do bolo — camada exclusiva que eleva cada métrica" }, "hot"],
        [true, { en: "Automated MT5 robot — trades the signals for you (bonus)", pt: "Robô automatizado em MT5 — opera os sinais sozinho (bônus)" }],
        [true, { en: "Exclusive Hedge — 15%→30% in an uncorrelated protection asset", pt: "Sinal de Hedge exclusivo — 15%→30% em ativo de proteção descorrelacionado" }],
        [true, { en: "Community: weekly market videos, outlook and reads", pt: "Comunidade: vídeos semanais de mercado, expectativas e leitura" }],
        [true, { en: "Export history (CSV) + API access", pt: "Exportar histórico (CSV) + acesso à API" }],
        [true, { en: "Priority support", pt: "Suporte prioritário" }],
      ],
      cta: { en: "Get Elite", pt: "Assinar Elite" },
    },
  ];

  /* ---------------- shared chrome ---------------- */
  const MARK_SVG = `<svg viewBox="0 0 44 44" aria-hidden="true"><defs><linearGradient id="s7g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#43d8f6"/><stop offset="1" stop-color="#12a6cf"/></linearGradient></defs><path d="M7 7 H37 V15 H20 V21 H12 V15 H7 Z" fill="url(#s7g)"/><path d="M25 17 H37 L20 40 H9 Z" fill="url(#s7g)"/><path d="M7 7 L20 21 M37 7 L12 21 M25 17 L9 40 M37 17 L20 40" stroke="#06131d" stroke-width="0.9" opacity=".35" fill="none"/><g fill="#8fecfb"><circle cx="7" cy="7" r="1.7"/><circle cx="37" cy="7" r="1.7"/><circle cx="12" cy="21" r="1.7"/><circle cx="25" cy="17" r="1.7"/><circle cx="9" cy="40" r="1.7"/><circle cx="20" cy="40" r="1.7"/></g></svg>`;
  const NAV_HTML = `
    <header class="nav">
      <a class="brand" href="index.html">
        <span class="brand-mark">${MARK_SVG}</span>
        <span class="brand-wrap"><span class="brand-name">Seven7</span><span class="brand-tag" data-i18n="brand.tag"></span></span>
      </a>
      <nav class="nav-links">
        <a href="performance.html" data-page="performance" data-i18n="nav.perf"></a>
        <a href="metrics.html" data-page="metrics" data-i18n="nav.metrics"></a>
        <a href="signals.html" data-page="signals" data-i18n="nav.signals"></a>
        <a href="portfolio.html" data-page="portfolio" data-i18n="nav.portfolio"></a>
        <a href="replay.html" data-page="replay" data-i18n="nav.replay"></a>
        <a href="plans.html" data-page="plans" data-i18n="nav.plans"></a>
      </nav>
      <div class="nav-cta">
        <div class="lang-toggle" id="langToggle">
          <button class="lang-opt" data-lang="en">EN</button>
          <button class="lang-opt" data-lang="pt">PT</button>
        </div>
        <button class="theme-toggle" id="themeToggle" title="Theme" aria-label="Theme">◐</button>
        <span class="nav-auth" id="navAuth">
          <a class="btn btn-ghost" href="login.html" data-i18n="nav.login"></a>
          <a class="btn btn-primary" href="register.html" data-i18n="nav.trial"></a>
        </span>
      </div>
    </header>`;
  const FOOTER_HTML = `
    <footer class="footer">
      <div class="footer-top">
        <div class="brand"><span class="brand-mark">${MARK_SVG}</span><span class="brand-name">Seven7</span></div>
        <div class="footer-links">
          <a href="metrics.html" data-i18n="nav.metrics"></a><a href="performance.html" data-i18n="nav.perf"></a><a href="plans.html" data-i18n="nav.plans"></a>
        </div>
      </div>
      <p class="disclaimer" id="disclaimer"></p>
      <p class="copy" id="copy"></p>
    </footer>`;

  let DATA = null;
  const boot = window.__DATA__ ? Promise.resolve(window.__DATA__) : fetch("data/metrics.json?d=" + new Date().toISOString().slice(0, 10)).then(r => r.json());
  boot.then(d => { DATA = d; render(); }).catch(e => { render(); console.error(e); });

  function render() {
    injectChrome();
    applyStatic();
    initToggles();
    if (DATA) {
      buildTicker(); buildHero();
      const dc = $("#disclaimer"); if (dc) dc.textContent = t("disclaimer");
      guard("#bookTabs", () => initSection(["US", "BR", "GLOBAL"], "#bookTabs", renderTrack));
      guard("#quantHost", () => initSection(["US", "BR"], "#quantTabsHost", renderMetrics, "#quantHost"));
      guard("#cherryHost", renderCherry);
      guard("#cherryTeaser", buildCherryTeaser);
      guard("#hedgeHost", renderHedge);
      guard("#radarTabs", () => initSection(["US", "BR"], "#radarTabs", renderRadar));
      guard("#replayTabs", () => initSection(["US", "BR"], "#replayTabs", renderReplay));
      guard("#trustGrid", buildTrust);
      guard("#homeCards", buildHomeCards);
    }
    guard("#pricingGrid", () => { renderPricing(); initBilling(); });
    initAuth();
    const cp = $("#copy"); if (cp) cp.textContent = t("footer.copy");
  }
  function guard(sel, fn) { if ($(sel)) fn(); }

  function injectChrome() {
    const n = $("#nav-root"); if (n) n.innerHTML = NAV_HTML;
    const f = $("#footer-root"); if (f) f.innerHTML = FOOTER_HTML;
    const page = document.body.dataset.page;
    $$(".nav-links a[data-page]").forEach(a => a.classList.toggle("active", a.dataset.page === page));
  }
  function applyStatic() {
    $$("[data-i18n]").forEach(el => { const v = t(el.getAttribute("data-i18n")); if (v != null) el.textContent = v; });
    $$("[data-i18n-html]").forEach(el => { const v = t(el.getAttribute("data-i18n-html")); if (v != null) el.innerHTML = v; });
    document.documentElement.lang = LANG;
  }

  const labelOf = k => ({ US: t("book.us"), BR: t("book.br"), GLOBAL: t("book.global") }[k] || k);
  function initSection(keys, hostSel, fn, insertAfter) {
    let host = $(hostSel);
    if (!host && insertAfter) { host = elh("div", "book-tabs"); host.id = hostSel.slice(1); $(insertAfter).after(host); }
    if (!host) return;
    host.innerHTML = "";
    keys.forEach((k, i) => {
      const b = elh("button", "book-tab" + (i === 0 ? " on" : ""), labelOf(k));
      b.onclick = () => { [...host.children].forEach(c => c.classList.remove("on")); b.classList.add("on"); fn(k); };
      host.appendChild(b);
    });
    fn(keys[0]);
  }

  function buildTicker() {
    const host = $("#tickerTrack"); if (!host) return;
    const names = [];
    ["US", "BR"].forEach(r => (DATA.books[r]?.signals_summary?.sample || []).forEach(tk => names.push(tk)));
    const one = () => names.map(tk => `<span class="tick"><span class="tk">${tk}</span><span class="badge buy">${t("tick.buy")}</span><span class="badge active">${t("tick.live")}</span></span>`).join("");
    host.innerHTML = one() + one();
  }
  function buildHero() {
    const host = $("#heroStats"); if (!host) return;
    const us = DATA.books.US;
    const nSym = Object.values(DATA.books).reduce((a, b) => a + b.n_symbols_traded, 0);
    const stats = [
      { v: us?.headline.sharpe ?? "—", l: t("hs.sharpe") },
      { v: fmtPct(us?.headline.cagr), l: t("hs.cagr") },
      { v: nf(us?.track_record.win_rate ?? 0, 1) + "%", l: t("hs.win") },
      { v: fmtNum(nSym), l: t("hs.assets") },
      { v: "10", l: t("hs.years") },
    ];
    host.innerHTML = stats.map(s => `<div class="hstat"><div class="v">${s.v}</div><div class="l">${s.l}</div></div>`).join("");
    const up = $("#updated"); if (up) up.innerHTML = `<span class="dot"></span> ${t("updated")} <b style="color:var(--ink-2);margin-left:4px">${DATA.data_through}</b>`;
  }
  function buildHomeCards() {
    const cards = [
      { p: "performance.html", k: "nav.perf", d: "card.perf.d" },
      { p: "metrics.html", k: "nav.metrics", d: "card.metrics.d" },
      { p: "signals.html", k: "nav.signals", d: "card.signals.d" },
      { p: "replay.html", k: "nav.replay", d: "card.replay.d" },
    ];
    $("#homeCards").innerHTML = cards.map(c => `<a class="home-card" href="${c.p}">
      <div class="hc-title">${t(c.k)}</div><div class="hc-desc">${t(c.d)}</div>
      <div class="hc-open">${t("card.open")}</div></a>`).join("");
  }

  function bookOrCombined(k) {
    if (k === "GLOBAL") return { headline: DATA.combined.headline, equity_curve: DATA.combined.equity_curve, combined: true };
    return DATA.books[k];
  }
  function renderTrack(k) {
    const b = bookOrCombined(k), h = b.headline, tr = b.track_record;
    let cards;
    if (b.combined) {
      cards = [[t("stat.cagr"), fmtPct(h.cagr), h.cagr >= 0 ? "pos" : "neg"], [t("stat.sharpe"), h.sharpe, ""],
      [t("stat.maxdd"), "-" + nf(Math.abs(h.max_dd)) + "%", "neg"], [t("stat.vol"), nf(h.ann_vol) + "%", ""]];
    } else {
      cards = [[t("stat.win"), nf(tr.win_rate) + "%", ""], [t("stat.trades"), fmtNum(tr.total_trades), ""],
      [t("stat.cumret"), fmtPct(tr.total_pnl_pct), tr.total_pnl_pct >= 0 ? "pos" : "neg"], [t("stat.pf"), tr.profit_factor ?? "—", ""]];
    }
    $("#statRow").innerHTML = cards.map(c => `<div class="stat"><div class="v ${c[2]}">${c[1]}</div><div class="l">${c[0]}</div></div>`).join("");
    const benchName = b.combined ? null : (k === "US" ? t("legend.stratBench") : t("legend.stratBenchBR"));
    $("#equitySub").textContent = `${h.total_return != null ? t("m.totalRet") + " " + fmtPct(h.total_return) + " · " : ""}CAGR ${fmtPct(h.cagr)} · Sharpe ${h.sharpe} · ${t("m.maxDD")} -${nf(Math.abs(h.max_dd))}%`;
    $("#equityLegend").innerHTML = `<span class="lg"><span class="sw" style="background:var(--series)"></span>Seven7</span>` + (benchName ? `<span class="lg"><span class="sw dash"></span>${benchName}</span>` : "");
    lineChart($("#equityChart"), b.equity_curve, { keys: benchName ? ["e", "b"] : ["e"], colors: ["var(--series)", "var(--bench)"], labels: ["Seven7", benchName || ""], dash: [false, true], asPctGrowth: true });
    let dd = b.drawdown_curve;
    if (!dd) { let pk = -Infinity; dd = b.equity_curve.map(p => { pk = Math.max(pk, p.e); return { d: p.d, e: p.e / pk - 1 }; }); }
    $("#ddSub").textContent = `${t("dd.worst")} ${nf(Math.min(...dd.map(p => p.e)) * 100)}%`;
    areaChart($("#ddChart"), dd, { color: "var(--neg)" });
  }
  function renderMetrics(k) {
    const b = DATA.books[k], h = b.headline, vp = b.validation_public, tr = b.track_record;
    const tiles = [
      { v: fmtPct(h.cagr), l: t("mt.cagr.l"), d: t("mt.cagr.d") },
      { v: h.sharpe, l: t("mt.sharpe.l"), d: t("mt.sharpe.d") },
      { v: h.sortino, l: t("mt.sortino.l"), d: t("mt.sortino.d") },
      { v: "-" + nf(Math.abs(h.max_dd)) + "%", l: t("mt.maxdd.l"), d: t("mt.maxdd.d") },
      { v: nf(tr.win_rate) + "%", l: t("mt.win.l"), d: t("mt.win.d") },
      { v: nf(h.ann_vol) + "%", l: t("mt.vol.l"), d: t("mt.vol.d") },
      { v: nf(h.vol_drag, 2) + "%", l: t("mt.drag.l"), d: t("mt.drag.d") },
      { v: interp(t("mt.pct.v"), { x: Math.max(1, Math.round(100 - vp.pf_percentile)) }), l: t("mt.pct.l"), d: interp(t("mt.pct.d"), { y: nf(vp.pf_percentile, 0) }) },
      { v: "-" + nf(vp.mc_p95_dd) + "%", l: t("mt.adv.l"), d: t("mt.adv.d") },
    ];
    $("#quantGrid").innerHTML = tiles.map(x => `<div class="qcard"><div class="qv">${x.v}</div><div class="ql">${x.l}</div><div class="qd">${x.d}</div></div>`).join("");
    guard("#monthlyHeatmap", () => heatmap($("#monthlyHeatmap"), b.monthly_returns));
  }
  function renderCherry() {
    const c = DATA.cherry; if (!c) { const s = $("#cherryHost")?.closest("section"); if (s) s.style.display = "none"; return; }
    const so = c.stocks_only, w = c.with;
    const hero = [
      { v: `+${nf(w.cagr - so.cagr, 1)}pp`, l: t("cc.hCagr"), good: true },
      { v: `${so.sharpe}<span class="arrow">→</span><b class="pos">${w.sharpe}</b>`, l: t("cc.hSharpe") },
      { v: `${so.sortino}<span class="arrow">→</span><b class="pos">${w.sortino}</b>`, l: t("cc.hSortino") },
      { v: `${nf(c.extra_lo, 1)}–${nf(c.extra_hi, 1)}%`, l: t("cc.hPrem"), good: true },
    ];
    const pct = v => (v > 0 ? "+" : "") + nf(v) + "%", dd = v => "-" + nf(Math.abs(v)) + "%";
    const rows = [
      [t("cc.rCagr"), pct(so.cagr), pct(w.cagr)],
      [t("cc.rSharpe"), nf(so.sharpe, 2), nf(w.sharpe, 2)],
      [t("cc.rSortino"), nf(so.sortino, 2), nf(w.sortino, 2)],
      [t("cc.rMaxdd"), dd(so.max_dd), dd(w.max_dd)],
    ];
    const body = rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td class="col-h hc-better">${r[2]}</td></tr>`).join("");
    $("#cherryHost").innerHTML = `
      <div class="hedge-head">${hero.map(x => `<div class="hedge-hero"><div class="v ${x.good ? "good" : ""}">${x.v}</div><div class="l">${x.l}</div></div>`).join("")}</div>
      <div class="hedge-wrap">
        <div class="hedge-table-card"><table class="hedge-table">
          <thead><tr><th>${t("cc.metric")}</th><th>${t("cc.stocks")}</th><th>${t("cc.withcc")}</th></tr></thead>
          <tbody>${body}</tbody></table></div>
        <div class="hedge-elite">
          <div class="he-lock">🍒</div><div class="he-t">${t("cc.eliteT")}</div>
          <div class="he-s">${t("cc.eliteS")}</div>
          <a class="btn btn-primary" href="plans.html">${t("cc.eliteCta")}</a>
        </div>
      </div>
      <p class="hedge-note">${t("cc.note")}</p>`;
  }

  function buildCherryTeaser() {
    const c = DATA.cherry; const host = $("#cherryTeaser"); if (!c || !host) return;
    const so = c.stocks_only, w = c.with;
    const chips = [
      [`+${nf(w.cagr - so.cagr, 1)}pp`, t("cc.hCagr")],
      [`${so.sharpe}→${w.sharpe}`, "Sharpe"],
      [`${so.sortino}→${w.sortino}`, "Sortino"],
    ];
    host.innerHTML = `<div class="cherry-teaser">
      <div class="ct-emoji">🍒</div>
      <div class="ct-body">
        <div class="ct-h">${t("cherry.teaserH")}</div>
        <div class="ct-sub">${t("cherry.teaserSub")}</div>
        <div class="ct-chips">${chips.map(c => `<span class="ct-chip"><b>${c[0]}</b>${c[1]}</span>`).join("")}</div>
      </div>
      <a class="btn btn-primary" href="metrics.html#cherry">${t("cherry.teaserCta")}</a>
    </div>`;
  }

  function renderHedge() {
    const h = DATA.hedge; if (!h) { $("#hedgeHost").closest("section")?.style && ($("#hedgeHost").closest("section").style.display = "none"); return; }
    const u = h.unhedged, hh = h.hedged;
    const hero = [
      { v: `−${nf(h.dd_reduction)}pp`, l: t("hg.ddRed"), good: true },
      { v: `${nf(u.worst_year)}%<span class="arrow">→</span><b class="pos">${nf(hh.worst_year)}%</b>`, l: t("hg.worst") },
      { v: `${u.sharpe}<span class="arrow">→</span><b class="pos">${hh.sharpe}</b>`, l: t("hg.sharpe") },
    ];
    const pct = v => (v > 0 ? "+" : "") + nf(v) + "%", dd = v => "-" + nf(Math.abs(v)) + "%";
    const rows = [
      [t("hg.rMaxdd"), dd(u.max_dd), dd(hh.max_dd), hh.max_dd < u.max_dd],
      [t("hg.rWorst"), pct(u.worst_year), pct(hh.worst_year), hh.worst_year > u.worst_year],
      [t("hg.rSharpe"), nf(u.sharpe, 2), nf(hh.sharpe, 2), hh.sharpe > u.sharpe],
      [t("hg.rVol"), nf(u.ann_vol) + "%", nf(hh.ann_vol) + "%", hh.ann_vol < u.ann_vol],
      [t("hg.rCagr"), pct(u.cagr), pct(hh.cagr), hh.cagr > u.cagr],
    ];
    const body = rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td class="col-h ${r[3] ? "hc-better" : ""}">${r[2]}</td></tr>`).join("");
    $("#hedgeHost").innerHTML = `
      <div class="hedge-head">${hero.map(x => `<div class="hedge-hero"><div class="v ${x.good ? "good" : ""}">${x.v}</div><div class="l">${x.l}</div></div>`).join("")}</div>
      <div class="hedge-wrap">
        <div class="hedge-table-card"><table class="hedge-table">
          <thead><tr><th>${t("hg.metric")} (${nf(h.period.years)} ${t("hg.years")})</th><th>${t("hg.without")}</th><th>${t("hg.with")}</th></tr></thead>
          <tbody>${body}</tbody></table></div>
        <div class="hedge-elite">
          <div class="he-lock">🔒</div><div class="he-t">${t("hg.eliteT")}</div>
          <div class="he-s">${interp(t("hg.eliteS"), { base: h.base_weight, stress: h.stress_weight })}</div>
          <a class="btn btn-primary" href="plans.html">${t("hg.eliteCta")}</a>
        </div>
      </div>
      <p class="hedge-note">${interp(t("hg.note"), { years: nf(h.period.years), corr: h.corr_to_equity })}</p>`;
  }
  function renderRadar(k) {
    const b = DATA.books[k], s = b.signals_summary;
    $("#radarAsOf").textContent = `${t("radar.asof")} ${DATA.data_through}. ${b.regime_on ? t("radar.on") : t("radar.off")}`;
    const rows = s.sample.slice(0, 8).map(tk => `<tr><td class="tk-cell">${tk}</td><td><span class="dir-buy">${t("radar.buy")}</span></td>
       <td class="num"><span class="lockval">000.00</span></td><td class="num"><span class="lockval">000.00</span></td><td class="num"><span class="lockval">000.00</span></td></tr>`).join("");
    $("#radarHost").innerHTML = `
      <div class="radar-summary">
        <div class="rs-pill"><div class="v pos">${s.active}</div><div class="l">${t("radar.active")}</div></div>
        <div class="rs-pill"><div class="v">${s.total}</div><div class="l">${t("radar.total")}</div></div>
        <div class="rs-pill"><div class="v">${s.waiting}</div><div class="l">${t("radar.waiting")}</div></div>
      </div>
      <div class="locked-wrap">
        <table class="locked-table">
          <thead><tr><th>${t("radar.hAsset")}</th><th>${t("radar.hDir")}</th><th class="num">${t("radar.hEntry")}</th><th class="num">${t("radar.hStop")}</th><th class="num">${t("radar.hTarget")}</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="locked-cta"><div class="lk">🔒</div><div class="lt">${t("radar.lockT")}</div>
          <div class="ls">${interp(t("radar.lockS"), { n: s.total })}</div>
          <a class="btn btn-primary" href="plans.html">${t("radar.lockCta")}</a></div>
      </div>`;
  }
  function moLabel(ym) { const [y, m] = ym.split("-"); return `${MONTHS[LANG][+m - 1]}/${y.slice(2)}`; }
  function renderReplay(k) {
    const rows = (DATA.books[k].monthly_results || []).slice().reverse();
    const val = r => (r.ret_pct != null ? r.ret_pct : 0);
    const maxAbs = Math.max(0.01, ...rows.map(r => Math.abs(val(r))));
    const body = rows.map(r => {
      const v = val(r), pos = v >= 0, w = Math.round(Math.abs(v) / maxAbs * 90) + 6;
      return `<tr><td class="mr-mo">${moLabel(r.month)}</td><td class="num">${r.n_trades}</td><td class="num">${nf(r.win_rate, 0)}%</td>
        <td class="num"><span class="mr-r ${pos ? "pos" : "neg"}">${pos ? "+" : ""}${nf(v, 1)}%</span></td>
        <td><span class="mr-bar" style="width:${w}px;background:${pos ? "var(--pos)" : "var(--neg)"}"></span></td></tr>`;
    }).join("");
    $("#replayHost").innerHTML = `<table class="mr-table">
      <thead><tr><th>${t("rep.month")}</th><th class="num">${t("rep.trades")}</th><th class="num">${t("rep.win")}</th><th class="num">${t("rep.avg")}</th><th>${t("rep.trend")}</th></tr></thead>
      <tbody>${body}</tbody></table>`;
  }
  function buildTrust() {
    $("#trustGrid").innerHTML = ["trust.b1", "trust.b2", "trust.b3", "trust.b4"].map(k => `<div class="rule"><div class="n">✓</div><p>${t(k)}</p></div>`).join("");
  }

  /* ---- pricing (USD, Stripe-ready) ---- */
  let CYCLE = "monthly";
  function subscribe(tier) {
    const link = STRIPE_LINKS[tier] && STRIPE_LINKS[tier][CYCLE];
    if (!USER) { localStorage.setItem("seven7-intent", tier + ":" + CYCLE); location.href = "register.html"; return; }
    if (!link) { location.href = "account.html"; return; }          // checkout ainda não configurado
    const u = new URL(link);
    u.searchParams.set("client_reference_id", USER.id + ":" + tier.toLowerCase());
    if (USER.email) u.searchParams.set("prefilled_email", USER.email);
    location.href = u.toString();
  }
  function renderPricing() {
    $("#pricingGrid").innerHTML = PLANS.map(p => {
      const annualMo = Math.round(p.monthly * (1 - p.disc));
      const price = CYCLE === "annual" ? annualMo : p.monthly;
      const sub = CYCLE === "annual" ? `<span class="price-strike">$${p.monthly}</span> ${t("price.billed")} $${annualMo * 12}/${t("price.year")}` : t("price.cancel");
      const save = CYCLE === "annual" ? `<div class="price-save">−${Math.round(p.disc * 100)}%</div>` : "";
      let featList = p.feats.slice();
      if (p.cycleFeat) featList = [featList[0], p.cycleFeat[CYCLE], ...featList.slice(1)];
      const feats = featList.map(f => `<li class="${f[0] ? "" : "off"} ${f[2] || ""}">${f[1][LANG]}</li>`).join("");
      return `<div class="price-card ${p.featured ? "featured" : ""}">
        ${p.badge ? `<div class="price-badge">${p.badge[LANG]}</div>` : ""}${save}
        <div class="price-tier">${p.tier}</div>
        <div class="price-amt">$${price} <span>${t("price.perMonth")}</span></div>
        <div class="price-sub">${sub}</div>
        <ul class="price-feats">${feats}</ul>
        <a class="btn ${p.featured ? "btn-primary" : "btn-ghost"} btn-block" data-tier="${p.tier}" href="#">${p.cta[LANG]}</a>
      </div>`;
    }).join("");
    $$("#pricingGrid a[data-tier]").forEach(a => a.onclick = ev => { ev.preventDefault(); subscribe(a.dataset.tier); });
  }
  function initBilling() {
    const tg = $("#billingToggle"); if (!tg) return;
    tg.querySelectorAll(".bt-opt").forEach(b => b.onclick = () => {
      tg.querySelectorAll(".bt-opt").forEach(x => x.classList.remove("on")); b.classList.add("on"); CYCLE = b.dataset.cycle; renderPricing();
    });
  }

  /* ---- auth (Supabase) ---- */
  async function initAuth() {
    try {
      const mod = await import("https://esm.sh/@supabase/supabase-js@2");
      sb = mod.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const { data } = await sb.auth.getSession();
      USER = data?.session?.user || null;
      await loadProfile();
      updateAuthUI(); renderAccount(); renderMemberSignals(); renderPortfolio();
      sb.auth.onAuthStateChange(async (_ev, session) => {
        USER = session?.user || null; await loadProfile(); updateAuthUI(); renderAccount(); renderMemberSignals(); renderPortfolio();
      });
    } catch (e) { console.error("auth init failed", e); renderAccount(); }
    wireAuthForms();
  }
  async function loadProfile() {
    PROFILE = null;
    if (!sb || !USER) return;
    try { const { data } = await sb.from("profiles").select("*").eq("id", USER.id).single(); PROFILE = data || null; } catch (e) { PROFILE = null; }
  }
  function updateAuthUI() {
    const host = $("#navAuth"); if (!host) return;
    if (USER) {
      const name = USER.user_metadata?.name || USER.email;
      const badge = isMember() ? `<span class="nav-plan">${(PROFILE.plan || "").toUpperCase()}</span>` : "";
      host.innerHTML = `<a class="nav-user" href="account.html" title="${USER.email}">${name}${badge}</a><button class="btn btn-ghost" id="logoutBtn">${t("auth.logout")}</button>`;
      const lb = $("#logoutBtn"); if (lb) lb.onclick = async () => { if (sb) await sb.auth.signOut(); location.href = "index.html"; };
    } else {
      host.innerHTML = `<a class="btn btn-ghost" href="login.html">${t("nav.login")}</a><a class="btn btn-primary" href="register.html">${t("nav.trial")}</a>`;
    }
  }
  function wireAuthForms() {
    const f = $(".auth-form"); if (!f) return;
    const page = document.body.dataset.page;
    const msg = f.querySelector(".auth-msg");
    const show = (txt, ok) => { if (!msg) return; msg.textContent = txt; msg.classList.add("show"); msg.classList.toggle("err", !ok); };
    f.onsubmit = async ev => {
      ev.preventDefault();
      if (!sb) { show(t("auth.unavailable"), false); return; }
      const btn = f.querySelector("button[type=submit]"); if (btn) btn.disabled = true;
      try {
        if (page === "register") {
          const name = ($("#rg-name") || {}).value?.trim() || "";
          const email = $("#rg-email").value.trim(), pass = $("#rg-pass").value;
          const { error } = await sb.auth.signUp({ email, password: pass, options: { data: { name }, emailRedirectTo: new URL(".", location.href).href } });
          if (error) throw error;
          show(t("auth.checkEmail"), true);
          f.querySelectorAll("input").forEach(i => i.value = "");
        } else {
          const email = $("#li-email").value.trim(), pass = $("#li-pass").value;
          const { error } = await sb.auth.signInWithPassword({ email, password: pass });
          if (error) throw error;
          show(t("auth.loginOk"), true);
          const intent = localStorage.getItem("seven7-intent");
          setTimeout(() => location.href = intent ? "plans.html" : "index.html", 900);
        }
      } catch (e) {
        show(interp(t("auth.err"), { msg: (e && e.message) || e }), false);
      } finally { if (btn) btn.disabled = false; f.querySelectorAll('input[type="password"]').forEach(i => i.value = ""); }
    };
  }

  /* ---- members signals dashboard ---- */
  let SIGNALS = [], SIG_FILTER = "ALL", SIG_SEL = null, STATE_VIEW = "ACTIVE", tvLoading = false;
  const stClass = s => (s === "ACTIVE" ? "active" : s === "MONITORING" ? "wait" : "flat");
  const stLabel = s => (s === "ACTIVE" ? t("sig.stActive") : s === "MONITORING" ? t("sig.stMon") : t("sig.stFlat"));

  async function renderMemberSignals() {
    if (document.body.dataset.page !== "signals" || !sb || !isMember()) return;
    const host = $("#radarHost"), tabsHost = $("#radarTabs");
    if (!host) return;
    host.innerHTML = `<p class="muted-note">${t("sig.loading")}</p>`;
    const { data, error } = await sb.from("signals").select("*");
    if (error) { host.innerHTML = `<p class="muted-note">${t("sig.err")}</p>`; return; }
    SIGNALS = (data || []).sort((a, b) => a.ticker.localeCompare(b.ticker));  // ordem alfabética
    const filters = [["ALL", t("sig.all")], ["US", "🇺🇸 US"], ["BR", "🇧🇷 BR"]];
    if (tabsHost) {
      tabsHost.innerHTML = filters.map(f => `<button class="book-tab ${SIG_FILTER === f[0] ? "on" : ""}" data-f="${f[0]}">${f[1]}</button>`).join("");
      tabsHost.querySelectorAll(".book-tab").forEach(b => b.onclick = () => {
        tabsHost.querySelectorAll(".book-tab").forEach(x => x.classList.remove("on")); b.classList.add("on");
        SIG_FILTER = b.dataset.f; SIG_SEL = null; paintSignals();
      });
    }
    host.innerHTML = `
      <div class="sig-viewbar" id="sigViewbar"></div>
      <div class="sig-chartcard">
        <div class="sig-charthead" id="sigChartHead"></div>
        <div class="tvchart" id="tvChart"></div>
        <div class="sig-levels" id="sigLevels"></div>
        <div class="sig-add" id="sigAdd"></div>
      </div>
      <div class="sig-tablewrap"><table class="sig-table" id="sigTable"></table></div>`;
    paintSignals();
  }

  function paintSignals() {
    const mkt = SIGNALS.filter(s => SIG_FILTER === "ALL" || s.market === SIG_FILTER);
    const cnt = st => mkt.filter(s => s.state === st).length;
    const views = [["ACTIVE", t("sig.active"), cnt("ACTIVE"), "pos"], ["MONITORING", t("sig.monitoring"), cnt("MONITORING"), "wait"]];
    if (cnt("FLAT") > 0) views.push(["FLAT", t("sig.flat"), cnt("FLAT"), ""]);
    if (!views.find(v => v[0] === STATE_VIEW && v[2] > 0)) STATE_VIEW = (views.find(v => v[2] > 0) || views[0])[0];
    const vb = $("#sigViewbar");
    if (vb) {
      vb.innerHTML = views.map(v => `<button class="sig-vpill ${STATE_VIEW === v[0] ? "on" : ""}" data-v="${v[0]}"><span class="vn ${v[3]}">${v[2]}</span><span class="vl">${v[1]}</span></button>`).join("")
        + `<div class="sig-vupd"><span class="vn">${DATA ? DATA.data_through : ""}</span><span class="vl">${t("sig.updated")}</span></div>`;
      vb.querySelectorAll(".sig-vpill").forEach(b => b.onclick = () => { STATE_VIEW = b.dataset.v; SIG_SEL = null; paintSignals(); });
    }
    const rows = mkt.filter(s => s.state === STATE_VIEW);
    const elite = PROFILE && PROFILE.plan === "elite";
    const head = `<thead><tr><th>${t("sig.ticker")}</th><th class="num">${t("sig.price")}</th><th class="num">${t("sig.entry")}</th><th class="num">${t("sig.stop")}</th><th class="num">${t("sig.tp")}</th><th class="num">R:R</th>${elite ? `<th class="num">${t("sig.cc")}</th>` : ""}</tr></thead>`;
    const body = rows.map(s => `<tr data-tk="${s.ticker}" class="${SIG_SEL === s.ticker ? "sel" : ""}">
        <td class="tk-cell">${s.ticker} <span class="mkt">${s.market}</span></td>
        <td class="num">${fmtNum(s.price)}</td>
        <td class="num">${fmtNum(s.entry)}</td>
        <td class="num neg">${fmtNum(s.stop)}</td>
        <td class="num pos">${fmtNum(s.tp)}</td>
        <td class="num">${s.rr != null ? nf(s.rr, 2) : "—"}</td>
        ${elite ? `<td class="num">@${fmtNum(s.cc_strike)} · ${nf(s.cc_premium_pct, 1)}%</td>` : ""}
      </tr>`).join("");
    const cols = elite ? 7 : 6;
    const tbl = $("#sigTable");
    if (tbl) {
      tbl.innerHTML = head + `<tbody>${body || `<tr><td colspan="${cols}" class="muted-note" style="padding:22px;text-align:center">${t("sig.none")}</td></tr>`}</tbody>`;
      tbl.querySelectorAll("tbody tr[data-tk]").forEach(tr => tr.onclick = () => selectSignal(tr.dataset.tk));
    }
    if (rows.length && (!SIG_SEL || !rows.find(s => s.ticker === SIG_SEL))) selectSignal(rows[0].ticker);
    else if (!rows.length) { ["sigChartHead", "sigLevels", "tvChart"].forEach(id => { const e = document.getElementById(id); if (e) e.innerHTML = ""; }); }
    else selectSignal(SIG_SEL);
  }

  function selectSignal(ticker) {
    const s = SIGNALS.find(x => x.ticker === ticker); if (!s) return;
    SIG_SEL = ticker;
    document.querySelectorAll("#sigTable tbody tr").forEach(tr => tr.classList.toggle("sel", tr.dataset.tk === ticker));
    const elite = PROFILE && PROFILE.plan === "elite";
    const head = $("#sigChartHead");
    if (head) head.innerHTML = `<div><span class="sig-tk">${s.ticker}</span> <span class="st ${stClass(s.state)}">${stLabel(s.state)}</span></div>
      <a class="sig-tv" href="https://www.tradingview.com/chart/?symbol=${encodeURIComponent(s.tv_symbol)}" target="_blank" rel="noopener">${t("sig.openTV")} ↗</a>`;
    const lv = $("#sigLevels");
    if (lv) lv.innerHTML = `
      <div class="lvl"><span class="lk">${t("sig.entry")}</span><span class="lv-v">${fmtNum(s.entry)}</span></div>
      <div class="lvl"><span class="lk">${t("sig.stop")}</span><span class="lv-v neg">${fmtNum(s.stop)}</span></div>
      <div class="lvl"><span class="lk">${t("sig.tp")}</span><span class="lv-v pos">${fmtNum(s.tp)}</span></div>
      <div class="lvl"><span class="lk">R:R</span><span class="lv-v">${s.rr != null ? nf(s.rr, 2) : "—"}</span></div>
      ${elite ? `<div class="lvl cc"><span class="lk">🍒 ${t("sig.cc")}</span><span class="lv-v">@${fmtNum(s.cc_strike)} · ${nf(s.cc_premium_pct, 1)}%</span></div>` : ""}`;
    const add = $("#sigAdd");
    if (add) {
      const cur = s.market === "BR" ? "R$" : "$";
      const dep = PROFILE && PROFILE.portfolio_deposit ? Number(PROFILE.portfolio_deposit) : null;
      const chosen = savedKelly();
      const opts = KELLY_FRACS.map(([fr, lbl]) =>
        `<option value="${fr}" ${fr === chosen ? "selected" : ""}>${lbl} — ${kellyPct(s.market, fr)}%</option>`).join("");
      add.innerHTML = `<span class="alloc-lbl">${t("sig.allocLbl")}</span>
        <select id="allocFrac" class="alloc-in alloc-sel">${opts}</select>
        <button class="btn btn-primary" id="addPortfolioBtn">${t("sig.addBtn")}</button>
        <span class="add-msg" id="addMsg"></span>
        <div class="buy-calc" id="buyCalc"></div>
        <div class="kelly-hint">${t("sig.kellyHint")}</div>`;
      const money = v => cur + Number(v).toLocaleString(locale(), { maximumFractionDigits: v >= 1000 ? 0 : 2 });
      const paintBuy = () => {
        const fr = parseFloat($("#allocFrac").value);
        const pct = kellyPct(s.market, fr);
        const px = s.entry || s.price;
        const bc = $("#buyCalc"); if (!bc) return;
        if (!dep) { bc.innerHTML = t("sig.buyNoDep"); return; }
        const notional = dep * pct / 100;
        const shares = px > 0 ? notional / px : 0;
        const riskPct = (s.entry > 0 && s.stop > 0 && s.entry > s.stop) ? pct * (s.entry - s.stop) / s.entry : null;
        bc.innerHTML = interp(t("sig.buyCalc"), {
          shares: nf(shares, shares >= 100 ? 0 : 2), notional: money(notional), pct: nf(pct, 1),
          risk: riskPct != null ? money(dep * riskPct / 100) : "—", riskpct: riskPct != null ? nf(riskPct, 2) : "—",
        });
      };
      paintBuy();
      $("#allocFrac").onchange = () => { localStorage.setItem("seven7-kelly", $("#allocFrac").value); paintBuy(); };
      $("#addPortfolioBtn").onclick = async () => {
        const fr = parseFloat($("#allocFrac").value) || KELLY_DEFAULT;
        localStorage.setItem("seven7-kelly", String(fr));
        const pct = Math.min(100, Math.max(0.1, kellyPct(s.market, fr)));
        const msg = $("#addMsg"), btn = $("#addPortfolioBtn"); btn.disabled = true;
        const err = await addPosition(s, pct);
        if (err) { msg.textContent = t("sig.addErr"); msg.className = "add-msg err"; }
        else { msg.innerHTML = `${t("sig.added")} <a href="portfolio.html">${t("sig.goPortfolio")}</a>`; msg.className = "add-msg ok"; }
        btn.disabled = false;
      };
    }
    showTVChart(s.tv_symbol);
  }
  async function addPosition(sig, allocPct) {
    if (!sb || !USER) return "no-auth";
    const { error } = await sb.from("portfolio_positions").insert({
      ticker: sig.ticker, tv_symbol: sig.tv_symbol, market: sig.market,
      entry: sig.entry, stop: sig.stop, tp: sig.tp, alloc_pct: allocPct,
    });
    return error;
  }

  function ensureTV() {
    return new Promise(res => {
      if (window.TradingView) return res();
      if (tvLoading) { const i = setInterval(() => { if (window.TradingView) { clearInterval(i); res(); } }, 120); return; }
      tvLoading = true;
      const sc = document.createElement("script"); sc.src = "https://s3.tradingview.com/tv.js"; sc.onload = () => res();
      document.head.appendChild(sc);
    });
  }
  async function showTVChart(symbol) {
    await ensureTV();
    const el = $("#tvChart"); if (!el || !window.TradingView) return;
    el.innerHTML = "";
    new window.TradingView.widget({
      container_id: "tvChart", symbol, interval: "D", autosize: true,
      theme: document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark",
      style: "1", locale: LANG === "pt" ? "br" : "en",
      hide_side_toolbar: true, allow_symbol_change: false, save_image: false,
    });
  }

  /* ---- portfolio page ---- */
  async function renderPortfolio() {
    const host = $("#portfolioHost"); if (!host || document.body.dataset.page !== "portfolio") return;
    if (!USER) {
      host.innerHTML = `<div class="auth-card" style="margin:0 auto"><h1>${t("acct.needLogin")}</h1><p class="auth-sub">${t("pf.needLoginSub")}</p><a class="btn btn-primary btn-block" href="login.html">${t("nav.login")}</a></div>`;
      return;
    }
    host.innerHTML = `<p class="muted-note">${t("sig.loading")}</p>`;
    const [pr, po, st] = await Promise.all([
      sb.from("profiles").select("portfolio_deposit,portfolio_currency").eq("id", USER.id).maybeSingle(),
      sb.from("portfolio_positions").select("*").order("added_at", { ascending: false }),
      sb.from("portfolio_stats").select("data").eq("user_id", USER.id).maybeSingle(),
    ]);
    const deposit = (pr.data && pr.data.portfolio_deposit) || 10000;
    const cur = (pr.data && pr.data.portfolio_currency) || "USD";
    const positions = po.data || [];
    const d = (st.data && st.data.data) || null;
    const sym = cur === "BRL" ? "R$" : "$";
    const money = v => v == null ? "—" : sym + Number(v).toLocaleString(locale(), { maximumFractionDigits: 0 });

    let html = `<div class="pf-deposit">
      <label>${t("pf.deposit")}</label>
      <div class="pf-dep-in"><span>${sym}</span><input id="pfDeposit" type="number" value="${deposit}" min="0" step="100"></div>
      <button class="btn btn-ghost" id="pfSaveDep">${t("pf.save")}</button>
      <span class="add-msg" id="pfDepMsg"></span></div>`;

    if (!positions.length) {
      html += `<div class="pf-empty"><div class="pf-empty-ic">📈</div><div class="pf-empty-t">${t("pf.emptyT")}</div>
        <div class="pf-empty-s">${t("pf.emptyS")}</div><a class="btn btn-primary" href="signals.html">${t("pf.emptyCta")}</a></div>`;
    } else {
      const you = d ? d.total_return : null, spy = d ? d.spy_return : null, bova = d ? d.bova_return : null;
      html += `<div class="pf-tiles">
        <div class="stat"><div class="v">${money(d ? d.value : deposit)}</div><div class="l">${t("pf.value")}</div></div>
        <div class="stat"><div class="v ${you >= 0 ? "pos" : "neg"}">${you == null ? "—" : fmtPct(you)}</div><div class="l">${t("pf.return")}</div></div>
        <div class="stat"><div class="v">${d && d.win_rate != null ? nf(d.win_rate, 0) + "%" : "—"}</div><div class="l">${t("pf.win")}</div></div>
        <div class="stat"><div class="v neg">${d ? "-" + nf(d.max_dd, 1) + "%" : "—"}</div><div class="l">${t("pf.dd")}</div></div>
        <div class="stat"><div class="v">${d ? nf(d.vol_drag, 2) + "%" : "—"}</div><div class="l">${t("pf.drag")}</div></div>
        <div class="stat"><div class="v">${d ? d.n_open : positions.filter(p => p.status === "open").length}</div><div class="l">${t("pf.open")}</div></div>
      </div>`;
      // benchmark headline + chart
      html += `<div class="pf-vs">
        <span class="pf-vs-you">${t("pf.you")}: <b class="${you >= 0 ? "pos" : "neg"}">${you == null ? "—" : fmtPct(you)}</b></span>
        <span>SPY: <b>${spy == null ? "—" : fmtPct(spy)}</b></span>
        <span>BOVA11: <b>${bova == null ? "—" : fmtPct(bova)}</b></span></div>
      <div class="chart-card"><div class="chart-head"><div class="chart-title">${t("pf.chart")}</div>
        <div class="legend"><span class="lg"><span class="sw" style="background:var(--series)"></span>${t("pf.you")}</span><span class="lg"><span class="sw" style="background:var(--bench)"></span>SPY</span><span class="lg"><span class="sw" style="background:var(--warn)"></span>BOVA11</span></div></div>
        <div class="chart-body" id="pfChart"></div></div>`;
      // positions table
      const smap = { won: ["pos", "active", t("pf.won")], lost: ["neg", "flat", t("pf.lost")], open: ["", "wait", t("pf.openst")], pending: ["", "flat", t("pf.pending")] };
      const rows = positions.map(p => {
        const [retc, stcls, stl] = smap[p.status] || smap.open;
        return `<tr><td class="tk-cell">${p.ticker} <span class="mkt">${p.market}</span></td>
          <td>${p.added_at}</td><td class="num">${nf(p.alloc_pct, 1)}%</td>
          <td class="num">${fmtNum(p.entry)}</td><td class="num">${fmtNum(p.current_price ?? p.entry)}</td>
          <td><span class="st ${stcls}">${stl}</span></td>
          <td class="num ${retc}">${p.status === "pending" ? "—" : (p.ret_pct == null ? "—" : fmtPct(p.ret_pct))}</td>
          <td><button class="pf-del" data-id="${p.id}" title="${t("pf.remove")}">✕</button></td></tr>`;
      }).join("");
      html += `<div class="table-wrap" style="margin-top:18px"><table class="sig-table"><thead><tr>
        <th>${t("sig.ticker")}</th><th>${t("pf.added")}</th><th class="num">${t("pf.alloc")}</th><th class="num">${t("sig.entry")}</th><th class="num">${t("pf.current")}</th><th>${t("sig.state")}</th><th class="num">${t("pf.pl")}</th><th></th>
        </tr></thead><tbody>${rows}</tbody></table></div>
        ${d ? "" : `<p class="hedge-note">${t("pf.computing")}</p>`}`;
    }
    host.innerHTML = html;

    const save = $("#pfSaveDep");
    if (save) save.onclick = async () => {
      const val = Math.max(0, parseFloat($("#pfDeposit").value) || 0);
      const { error } = await sb.from("profiles").update({ portfolio_deposit: val }).eq("id", USER.id);
      const m = $("#pfDepMsg"); m.textContent = error ? t("sig.addErr") : t("pf.saved"); m.className = "add-msg " + (error ? "err" : "ok");
    };
    host.querySelectorAll(".pf-del").forEach(b => b.onclick = async () => {
      await sb.from("portfolio_positions").delete().eq("id", b.dataset.id); renderPortfolio();
    });
    if (d && d.curve && d.curve.length > 1) {
      lineChart($("#pfChart"), d.curve, { keys: ["p", "spy", "bova"], colors: ["var(--series)", "var(--bench)", "var(--warn)"], labels: [t("pf.you"), "SPY", "BOVA11"], dash: [false, true, true], asPctGrowth: true });
    }
  }

  /* ---- account page ---- */
  function renderAccount() {
    const host = $("#accountHost"); if (!host) return;
    if (!USER) {
      host.innerHTML = `<div class="auth-card" style="margin:0 auto">
        <h1>${t("acct.needLogin")}</h1><p class="auth-sub">${t("acct.needLoginSub")}</p>
        <a class="btn btn-primary btn-block" href="login.html">${t("nav.login")}</a></div>`;
      return;
    }
    const p = PROFILE || {}, member = isMember();
    const planName = member ? (p.plan || "—").toUpperCase() : t("acct.free");
    host.innerHTML = `
      <div class="acct-card">
        <div class="acct-grid">
          <div class="acct-row"><span class="acct-k">${t("acct.name")}</span><span class="acct-v">${(USER.user_metadata && USER.user_metadata.name) || "—"}</span></div>
          <div class="acct-row"><span class="acct-k">${t("acct.email")}</span><span class="acct-v">${USER.email}</span></div>
          <div class="acct-row"><span class="acct-k">${t("acct.plan")}</span><span class="acct-v"><span class="acct-badge ${member ? "on" : ""}">${planName}</span></span></div>
          <div class="acct-row"><span class="acct-k">${t("acct.status")}</span><span class="acct-v">${member ? t("acct.active") : t("acct.inactive")}</span></div>
        </div>
        ${member
        ? `<a class="btn btn-ghost btn-block" href="#" id="manageBtn">${t("acct.manage")}</a>`
        : `<div class="acct-upsell"><p>${t("acct.upsell")}</p><a class="btn btn-primary btn-block" href="plans.html">${t("acct.subscribe")}</a></div>`}
        <button class="btn btn-ghost btn-block" id="acctLogout">${t("auth.logout")}</button>
      </div>`;
    const lo = $("#acctLogout"); if (lo) lo.onclick = async () => { if (sb) await sb.auth.signOut(); location.href = "index.html"; };
    const mb = $("#manageBtn");
    if (mb) mb.onclick = ev => {
      ev.preventDefault();
      if (STRIPE_PORTAL) {
        const u = new URL(STRIPE_PORTAL);
        if (USER.email) u.searchParams.set("prefilled_email", USER.email);
        window.open(u.toString(), "_blank", "noopener");
      } else {
        location.href = "mailto:support@seven7invest.com?subject=" + encodeURIComponent("Manage subscription — " + USER.email);
      }
    };
  }

  /* ---- toggles (theme + language) ---- */
  function initToggles() {
    const th = $("#themeToggle");
    if (th) th.onclick = () => {
      const cur = document.documentElement.getAttribute("data-theme");
      document.documentElement.setAttribute("data-theme", cur === "dark" ? "light" : "dark");
      $$(".book-tabs").forEach(h => { const on = h.querySelector(".on"); if (on) on.click(); });
    };
    const lt = $("#langToggle");
    if (lt) lt.querySelectorAll(".lang-opt").forEach(b => {
      b.classList.toggle("on", b.dataset.lang === LANG);
      b.onclick = () => { if (b.dataset.lang === LANG) return; LANG = b.dataset.lang; localStorage.setItem("seven7-lang", LANG); CYCLE = "monthly"; render(); };
    });
  }

  /* ================= SVG CHARTS ================= */
  const W = 1000, H = 340, PAD = { t: 16, r: 16, b: 26, l: 46 };
  const NS = "http://www.w3.org/2000/svg";
  const mk = (tag, a) => { const e = document.createElementNS(NS, tag); for (const k in a) e.setAttribute(k, a[k]); return e; };
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
    const fmt = opt.asPctGrowth ? (v => nf((v - 1) * 100, 0) + "%") : (v => nf(v, 2));
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
      if (tip) { tip.innerHTML = rows; tip.hidden = false; tip.style.left = Math.min(ev.clientX + 14, window.innerWidth - 160) + "px"; tip.style.top = (ev.clientY - 10) + "px"; }
    });
    hit.addEventListener("pointerleave", () => { if (tip) tip.hidden = true; cross.setAttribute("opacity", 0); dot0.setAttribute("opacity", 0); });
    host.appendChild(svg);
  }
  function areaChart(host, pts, opt) {
    host.innerHTML = ""; if (!pts || pts.length < 2) return;
    const h2 = 200, minV = Math.min(...pts.map(p => p.e), -0.001);
    const yD = v => PAD.t + (1 - (v - minV) / (0 - minV)) * (h2 - PAD.t - PAD.b);
    const xD = i => PAD.l + (i / (pts.length - 1)) * (W - PAD.l - PAD.r), svg = svgEl(W, h2);
    [0, .25, .5, .75, 1].forEach(f => { const v = minV * f; svg.appendChild(mk("line", { x1: PAD.l, x2: W - PAD.r, y1: yD(v), y2: yD(v), class: "gridline" })); const tx = mk("text", { x: PAD.l - 8, y: yD(v) + 4, class: "axis-label", "text-anchor": "end" }); tx.textContent = nf(v * 100, 0) + "%"; svg.appendChild(tx); });
    let d = "M" + xD(0) + " " + yD(0); pts.forEach((p, i) => d += "L" + xD(i).toFixed(1) + " " + yD(p.e).toFixed(1)); d += "L" + xD(pts.length - 1) + " " + yD(0) + "Z";
    svg.appendChild(mk("path", { d, fill: opt.color, "fill-opacity": .18, stroke: opt.color, "stroke-width": 1.6, "vector-effect": "non-scaling-stroke" }));
    const step = Math.max(1, Math.floor(pts.length / 6));
    for (let i = 0; i < pts.length; i += step) { const tx = mk("text", { x: xD(i), y: h2 - 6, class: "axis-label", "text-anchor": "middle" }); tx.textContent = pts[i].d.slice(0, 4); svg.appendChild(tx); }
    host.appendChild(svg);
  }
  function heatmap(host, mr) {
    host.innerHTML = "";
    const scale = 12, months = MONTHS[LANG];
    const table = elh("table", "heat-table");
    let head = "<tr><th></th>" + months.map(m => `<th>${m}</th>`).join("") + `<th class="heat-ytd">${t("heatmap.year")}</th></tr>`, rows = "";
    mr.years.forEach((yr, ri) => {
      let tds = `<td class="yr">${yr}</td>`;
      mr.table[ri].forEach((v, mi) => {
        if (v == null) { tds += `<td><div class="heat-cell empty">·</div></td>`; return; }
        const mag = Math.min(1, Math.abs(v) / scale) * 78 + 8, base = v >= 0 ? "var(--heat-pos)" : "var(--heat-neg)";
        tds += `<td><div class="heat-cell" style="background:color-mix(in srgb, ${base} ${mag.toFixed(0)}%, var(--heat-mid))" title="${months[mi]} ${yr}: ${nf(v)}%">${nf(v, 0)}</div></td>`;
      });
      const yt = mr.ytd[ri], ym = Math.min(1, Math.abs(yt) / (scale * 2.5)) * 78 + 8;
      tds += `<td class="heat-ytd"><div class="heat-cell" style="background:color-mix(in srgb, ${yt >= 0 ? "var(--heat-pos)" : "var(--heat-neg)"} ${ym.toFixed(0)}%, var(--heat-mid))">${yt >= 0 ? "+" : ""}${nf(yt, 0)}</div></td>`;
      rows += `<tr>${tds}</tr>`;
    });
    table.innerHTML = head + rows; host.appendChild(table);
  }
})();
