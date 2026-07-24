/* ============ Seven7 — multi-page app (bilingual EN/PT) ============ */
/* Static multi-page site. Shared nav/footer are injected here so they live in
   ONE place. Each page renders only the sections whose containers exist.
   Public data only (metrics.json): no signal levels, no method, no ETF name. */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const elh = (tag, c, h) => { const e = document.createElement(tag); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };

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
    BEGINNER: { monthly: "", annual: "" },
    PRO: { monthly: "", annual: "" },
    ELITE: { monthly: "", annual: "" },
  };

  /* ---------------- i18n dictionary ---------------- */
  const T = {
    "brand.tag": { en: "QUANTIFIED INVESTING", pt: "INVESTIMENTOS QUANTIFICADOS" },
    "nav.perf": { en: "Performance", pt: "Desempenho" },
    "nav.metrics": { en: "Metrics", pt: "Métricas" },
    "nav.signals": { en: "Signals", pt: "Sinais" },
    "nav.replay": { en: "Replay", pt: "Replay" },
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
    "mt.cagr.d": { en: "Total return {x} over the period.", pt: "Retorno total {x} no período." },
    "mt.sharpe.l": { en: "Annualized Sharpe", pt: "Sharpe anualizado" },
    "mt.sharpe.d": { en: "95% CI [{lo}, {hi}]. {sig}", pt: "IC95% [{lo}, {hi}]. {sig}" },
    "mt.sharpe.sig": { en: "Statistically significant.", pt: "Estatisticamente significativo." },
    "mt.sharpe.nsig": { en: "Wide CI: caution.", pt: "Cautela: IC amplo." },
    "mt.sortino.l": { en: "Sortino", pt: "Sortino" },
    "mt.sortino.d": { en: "Return per unit of downside risk. Calmar {x}.", pt: "Retorno por unidade de risco de queda. Calmar {x}." },
    "mt.maxdd.l": { en: "Max drawdown", pt: "Max drawdown" },
    "mt.maxdd.d": { en: "Worst peak-to-trough in 10 years.", pt: "Pior janela de pico a vale em 10 anos." },
    "mt.win.l": { en: "Win rate", pt: "Win rate" },
    "mt.win.d": { en: "{n} trades · profit factor {pf}.", pt: "{n} operações · profit factor {pf}." },
    "mt.vol.l": { en: "Annual volatility", pt: "Volatilidade anual" },
    "mt.vol.d": { en: "Stable across the history.", pt: "Estável ao longo do histórico." },
    "mt.pct.v": { en: "top {x}%", pt: "top {x}%" },
    "mt.pct.l": { en: "vs. 10,000 random", pt: "vs. 10 mil aleatórias" },
    "mt.pct.d": { en: "Better than {y}% of random strategies — not luck.", pt: "Melhor que {y}% de estratégias aleatórias — não é sorte." },
    "mt.adv.l": { en: "Adverse scenario (p95)", pt: "Cenário adverso (p95)" },
    "mt.adv.d": { en: "Max expected loss in the worst 5% of simulations.", pt: "Perda máxima esperada no pior 5% das simulações." },
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
  const NAV_HTML = `
    <header class="nav">
      <a class="brand" href="index.html">
        <span class="brand-mark">7</span>
        <span class="brand-wrap"><span class="brand-name">SEVEN7</span><span class="brand-tag" data-i18n="brand.tag"></span></span>
      </a>
      <nav class="nav-links">
        <a href="performance.html" data-page="performance" data-i18n="nav.perf"></a>
        <a href="metrics.html" data-page="metrics" data-i18n="nav.metrics"></a>
        <a href="signals.html" data-page="signals" data-i18n="nav.signals"></a>
        <a href="replay.html" data-page="replay" data-i18n="nav.replay"></a>
        <a href="plans.html" data-page="plans" data-i18n="nav.plans"></a>
      </nav>
      <div class="nav-cta">
        <div class="lang-toggle" id="langToggle">
          <button class="lang-opt" data-lang="en">EN</button>
          <button class="lang-opt" data-lang="pt">PT</button>
        </div>
        <button class="theme-toggle" id="themeToggle" title="Theme" aria-label="Theme">◐</button>
        <a class="btn btn-ghost" href="login.html" data-i18n="nav.login"></a>
        <a class="btn btn-primary" href="register.html" data-i18n="nav.trial"></a>
      </div>
    </header>`;
  const FOOTER_HTML = `
    <footer class="footer">
      <div class="footer-top">
        <div class="brand"><span class="brand-mark">7</span><span class="brand-name">SEVEN7</span></div>
        <div class="footer-links">
          <a href="metrics.html" data-i18n="nav.metrics"></a><a href="performance.html" data-i18n="nav.perf"></a><a href="plans.html" data-i18n="nav.plans"></a>
        </div>
      </div>
      <p class="disclaimer" id="disclaimer"></p>
      <p class="copy" id="copy"></p>
    </footer>`;

  let DATA = null;
  const boot = window.__DATA__ ? Promise.resolve(window.__DATA__) : fetch("data/metrics.json").then(r => r.json());
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
      guard("#hedgeHost", renderHedge);
      guard("#radarTabs", () => initSection(["US", "BR"], "#radarTabs", renderRadar));
      guard("#replayTabs", () => initSection(["US", "BR"], "#replayTabs", renderReplay));
      guard("#trustGrid", buildTrust);
      guard("#homeCards", buildHomeCards);
    }
    guard("#pricingGrid", () => { renderPricing(); initBilling(); });
    initAuthForms();
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
      { v: fmtPct(h.cagr), l: t("mt.cagr.l"), d: interp(t("mt.cagr.d"), { x: fmtPct(h.total_return) }) },
      { v: h.sharpe, l: t("mt.sharpe.l"), d: interp(t("mt.sharpe.d"), { lo: h.sharpe_ci[0], hi: h.sharpe_ci[1], sig: vp.sharpe_significant ? t("mt.sharpe.sig") : t("mt.sharpe.nsig") }) },
      { v: h.sortino, l: t("mt.sortino.l"), d: interp(t("mt.sortino.d"), { x: h.calmar }) },
      { v: "-" + nf(Math.abs(h.max_dd)) + "%", l: t("mt.maxdd.l"), d: t("mt.maxdd.d") },
      { v: nf(tr.win_rate) + "%", l: t("mt.win.l"), d: interp(t("mt.win.d"), { n: fmtNum(tr.total_trades), pf: tr.profit_factor }) },
      { v: nf(h.ann_vol) + "%", l: t("mt.vol.l"), d: t("mt.vol.d") },
      { v: interp(t("mt.pct.v"), { x: Math.max(1, Math.round(100 - vp.pf_percentile)) }), l: t("mt.pct.l"), d: interp(t("mt.pct.d"), { y: nf(vp.pf_percentile, 0) }) },
      { v: "-" + nf(vp.mc_p95_dd) + "%", l: t("mt.adv.l"), d: t("mt.adv.d") },
    ];
    $("#quantGrid").innerHTML = tiles.map(x => `<div class="qcard"><div class="qv">${x.v}</div><div class="ql">${x.l}</div><div class="qd">${x.d}</div></div>`).join("");
    guard("#monthlyHeatmap", () => heatmap($("#monthlyHeatmap"), b.monthly_returns));
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
    const maxAbs = Math.max(0.01, ...rows.map(r => Math.abs(r.avg_r)));
    const body = rows.map(r => {
      const pos = r.avg_r >= 0, w = Math.round(Math.abs(r.avg_r) / maxAbs * 90) + 6;
      return `<tr><td class="mr-mo">${moLabel(r.month)}</td><td class="num">${r.n_trades}</td><td class="num">${nf(r.win_rate, 0)}%</td>
        <td class="num"><span class="mr-r ${pos ? "pos" : "neg"}">${pos ? "+" : ""}${nf(r.avg_r, 2)}R</span></td>
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
  function subscribeHref(tier) { const l = STRIPE_LINKS[tier] && STRIPE_LINKS[tier][CYCLE]; return l ? l : `register.html?plan=${tier.toLowerCase()}&cycle=${CYCLE}`; }
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
        <a class="btn ${p.featured ? "btn-primary" : "btn-ghost"} btn-block" href="${subscribeHref(p.tier)}">${p.cta[LANG]}</a>
      </div>`;
    }).join("");
  }
  function initBilling() {
    const tg = $("#billingToggle"); if (!tg) return;
    tg.querySelectorAll(".bt-opt").forEach(b => b.onclick = () => {
      tg.querySelectorAll(".bt-opt").forEach(x => x.classList.remove("on")); b.classList.add("on"); CYCLE = b.dataset.cycle; renderPricing();
    });
  }

  /* ---- auth forms (UI stub — no backend yet) ---- */
  function initAuthForms() {
    $$(".auth-form").forEach(f => f.onsubmit = ev => {
      ev.preventDefault();
      const msg = f.querySelector(".auth-msg");
      if (msg) { msg.textContent = t("auth.soon"); msg.classList.add("show"); }
      f.querySelectorAll("input").forEach(i => { if (i.type === "password") i.value = ""; });
    });
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
