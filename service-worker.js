// Service worker bàsic: cache dels fitxers estàtics per a ús offline.
// Actualitzar la llista si s'afegeixen pantalles noves.

const NOM_CACHE = 'custodia-v1';

const FITXERS_PER_CACHE = [
  './',
  './index.html',
  './afegir.html',
  './detall.html',
  './css/estils.css',
  './js/inici.js',
  './js/afegir.js',
  './js/detall.js',
  './js/model/parcela.js',
  './js/serveis/cadastre.js',
  './js/serveis/basedades.js',
  './js/serveis/exportadorGpx.js',
  './js/ui/mapa.js',
  './manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(NOM_CACHE).then((cache) => cache.addAll(FITXERS_PER_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((noms) =>
      Promise.all(noms.filter((nom) => nom !== NOM_CACHE).map((nom) => caches.delete(nom)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Les crides al cadastre sempre van a xarxa, no es cachegen.
  if (event.request.url.includes('catastro')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((respostaCache) => respostaCache || fetch(event.request))
  );
});
