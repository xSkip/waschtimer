// Service Worker: speichert alle Dateien, damit die App auch offline startet.
// Bei jeder Änderung an den Dateien VERSION erhöhen, dann holt sich die App das Update.
const VERSION = 'v5';
const CACHE = `waschtimer-${VERSION}`;
const DATEIEN = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './calc.js',
  './ics.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(DATEIEN)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((namen) => Promise.all(namen.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

// Erst Netz (damit Updates sofort ankommen), bei Offline aus dem Speicher.
// Kalendereintrag für iPhone: ./termin.ics?d=<Termin> wird hier beantwortet, als wäre es eine echte
// Datei vom Server. iOS zeigt dann „Zum Kalender hinzufügen“ (Blob- und data:-Links blockiert iOS).
function kalenderAntwort(url) {
  const ics = url.searchParams.get('d') || 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//WaschTimer//DE\r\nEND:VCALENDAR\r\n';
  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="waesche-fertig.ics"',
      'Cache-Control': 'no-store',
    },
  });
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin === self.location.origin && url.pathname.endsWith('/termin.ics')) {
    event.respondWith(kalenderAntwort(url));
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then((antwort) => {
        if (antwort.ok && new URL(event.request.url).origin === self.location.origin) {
          const kopie = antwort.clone();
          caches.open(CACHE).then((c) => c.put(event.request, kopie));
        }
        return antwort;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true })),
  );
});
