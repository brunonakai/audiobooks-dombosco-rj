// Cache estático + áudio (com limite) — simples e eficaz
const STATIC = "static-v1.2";
const AUDIO = "audio-v1.2";

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(STATIC)
      .then((c) =>
        c.addAll([
          "./",
          "index.html",
          "assets/css/styles.css",
          "assets/js/app.js",
          "assets/img/logo-colegio-db-neg.png",
          "assets/img/logo-colegio-db-neg.webp",
          "assets/img/logo-colegio-db-neg.avif",
          "assets/img/favicon.ico",
        ])
      )
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Cache-first para .mp3
  if (url.pathname.endsWith(".mp3")) {
    e.respondWith(
      (async () => {
        const c = await caches.open(AUDIO);
        const m = await c.match(e.request);
        if (m) return m;
        const r = await fetch(e.request);
        // mantém só 1 áudio no cache (o último)
        const keys = await c.keys();
        for (const k of keys) await c.delete(k);
        c.put(e.request, r.clone());
        return r;
      })()
    );
    return;
  }

  // Stale-while-revalidate para estáticos
  if (/\.(css|js|png|webp|avif|ico)$/i.test(url.pathname)) {
    e.respondWith(
      (async () => {
        const cache = await caches.open(STATIC);
        const cached = await cache.match(e.request);
        const fetchPromise = fetch(e.request).then((r) => {
          cache.put(e.request, r.clone());
          return r;
        });
        return cached || fetchPromise;
      })()
    );
  }
});
