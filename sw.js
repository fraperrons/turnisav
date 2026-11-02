// v3 (02/11/2026): accessi personali. Cambiare questo nome e' cio' che fa
// riscaricare tutto ai telefoni che hanno gia' l'app — e qui serve davvero,
// perche' la versione v2 teneva in cache i turni senza chiedere niente a
// nessuno.
const CACHE_NAME = 'turni-sav-v3';

// SOLO IL GUSCIO, e non i dati.
//
// Fino alla v2 qui dentro c'era anche `turni_data.json`: il service worker lo
// scaricava all'installazione, cioe' PRIMA che qualcuno entrasse, e da quel
// momento i turni di 53 persone stavano sul telefono di chiunque avesse
// aperto l'indirizzo. Adesso il guscio e' pubblico e i dati arrivano solo
// dopo l'accesso, uno per uno, e finiscono in cache solo se il server li ha
// davvero consegnati.
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// I FILE DI DATI: quelli che il server difende con la sessione.
const DATI = ['turni_data.json', 'turni_avif_data.json', 'addestramenti_data.json', 'calendari.json', 'last_update.json'];
const eDati = (url) => DATI.some((n) => url.pathname.endsWith('/' + n));

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

// Strategia: prima la rete, poi la copia salvata.
//
// LA REGOLA NUOVA, E L'UNICA CHE CONTA QUI: una risposta di rifiuto non si
// mette in cache e non si sostituisce con la copia vecchia. Se il server dice
// 401 (non sei entrato) o 403 (la prova e' finita, l'accesso e' scaduto, sei
// stato disattivato), quel rifiuto deve arrivare alla pagina, che riporta al
// cancello. Dare la copia salvata al posto del rifiuto vorrebbe dire che una
// prova finita continua a mostrare i turni finche' il telefono ha memoria —
// cioe' per sempre.
//
// SENZA RETE invece la copia si da', ed e' il motivo per cui esiste: chi e'
// entrato vede l'ultimo quadro salvato anche in un vallone senza campo. La
// differenza fra le due cose e' che il primo e' un NO del server e il secondo
// e' il silenzio della rete.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;
  // Le chiamate di servizio non si salvano mai: accesso, stato, PEC, admin.
  if (url.pathname.includes('/api/')) return;

  event.respondWith(
    fetch(req)
      .then((response) => {
        if (!response || !response.ok) {
          // Un rifiuto passa com'e'. Di piu': se per quel file c'era una
          // copia salvata, la si butta — il server ha appena detto che chi
          // sta chiedendo non ha il diritto di vederla.
          if (eDati(url) && (response.status === 401 || response.status === 403)) {
            caches.open(CACHE_NAME).then((c) => c.delete(req)).catch(() => {});
          }
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(req))
  );
});
