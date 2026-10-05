/* ChessQQ service worker — simpan engine + app di HP biar load instan & bisa offline.
   Tiap release: naikkan CACHE (samakan dengan ?v= di index.html). */
const CACHE = "chessqq-v18";
const PIECES = ["wK", "wQ", "wR", "wB", "wN", "wP", "bK", "bQ", "bR", "bB", "bN", "bP"];
const CORE = [
  "./",
  "./index.html",
  "./css/style.css?v=13",
  "./js/app.js?v=13",
  "./js/engine.js?v=13",
  "./js/mentor.js?v=13",
  "./js/chess.js?v=13",
  "./engine/stockfish.js",
  "./engine/stockfish.wasm",
  ...PIECES.map((p) => "./img/pieces/" + p + ".svg"),
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.ok) cache.put(req, res.clone());
  return res;
}

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    const hit = await cache.match(req);
    if (hit) return hit;
    // fallback: index.html untuk navigasi root
    const idx = await cache.match("./index.html");
    if (idx) return idx;
    throw e;
  }
}

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  if (e.request.method !== "GET") return;
  const p = url.pathname;
  const isDoc = p.endsWith("/") || p.endsWith(".html");
  e.respondWith(isDoc ? networkFirst(e.request) : cacheFirst(e.request));
});
