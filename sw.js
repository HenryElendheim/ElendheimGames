/* Service worker — cache-first shell so the library works offline.
   Bump CACHE when you ship changes so clients pick them up. */

const CACHE = "elendheim-games-v3";
const ASSETS = [
  "./",
  "index.html",
  "css/theme.css",
  "js/main.js",
  "js/core/dom.js",
  "js/core/storage.js",
  "js/core/registry.js",
  "js/core/screens.js",
  "js/core/shell.js",
  "js/games/tictactoe.js",
  "js/games/connect4.js",
  "js/games/whack-a-mole.js",
  "js/games/tetris.js",
  "js/games/tile-tap.js",
  "js/games/block-blast.js",
  "manifest.json",
  "assets/icons/icon.svg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then(
      (hit) =>
        hit ||
        fetch(e.request)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
            return res;
          })
          .catch(() => caches.match("index.html"))
    )
  );
});
