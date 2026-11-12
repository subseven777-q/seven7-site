/* Seven7 — service worker do app instalável (PWA).
   Regra de ouro: NUNCA servir dado velho quando há internet.
     · páginas (HTML) e /data/*.json  -> rede primeiro; cache só se a rede falhar (offline)
     · arquivos estáticos (js/css/png, versionados com ?v=) -> cache na hora + atualização em segundo plano
     · outros domínios (Supabase, TradingView, CDNs) -> não toca: vão direto à rede
   Subiu versão do site? Troque CACHE abaixo: os caches antigos são apagados na ativação. */
const CACHE = "seven7-v1";
const OFFLINE = "offline.html";
const BASICO = [OFFLINE, "styles.css", "icons/icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BASICO)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

const guarda = (req, res) => { if (res && res.ok && res.type === "basic") { const c = res.clone(); caches.open(CACHE).then((x) => x.put(req, c)); } return res; };

async function redePrimeiro(req, pagina) {
  try {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 6000);
    const res = await fetch(req, { signal: ctl.signal }); clearTimeout(t);
    return guarda(req, res);
  } catch (err) {
    const c = await caches.match(req, { ignoreSearch: pagina });
    if (c) return c;
    if (pagina) return (await caches.match(OFFLINE)) || Response.error();
    return Response.error();
  }
}
async function cachePrimeiro(req) {
  const c = await caches.match(req);
  const rede = fetch(req).then((res) => guarda(req, res)).catch(() => null);
  return c || (await rede) || Response.error();
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const u = new URL(req.url);
  if (u.origin !== self.location.origin) return;                 // Supabase, TradingView, CDNs: direto
  if (req.mode === "navigate" || u.pathname.endsWith(".html") || u.pathname === "/") { e.respondWith(redePrimeiro(req, true)); return; }
  if (u.pathname.startsWith("/data/") || u.pathname.endsWith(".json") || u.pathname.endsWith(".webmanifest")) { e.respondWith(redePrimeiro(req, false)); return; }
  e.respondWith(cachePrimeiro(req));
});
