// v2 (28/10/2026): veste Prusik — carattere, colori e icone nuovi. Cambiare
// questo nome e' cio' che fa riscaricare tutto ai telefoni che hanno gia' l'app.
const CACHE_NAME = 'turni-sav-v2';
const CORE_ASSETS = [
  './',
  './index.html',
  './turni_data.json',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Strategia: prova prima la rete (dati sempre aggiornati quando c'è connessione),
// se non disponibile usa la copia salvata in cache (funziona offline in montagna).
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
