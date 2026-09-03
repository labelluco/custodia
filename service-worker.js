// Service worker bàsic: cache dels fitxers estàtics per a ús offline.
// Actualitzar la llista si s'afegeixen pantalles noves.

const NOM_CACHE = 'custodia-v37';

const FITXERS_PER_CACHE = [
  './',
  './index.html',
  './parceles.html',
  './afegir.html',
  './detall.html',
  './detall-agrupacio.html',
  './altitud.html',
  './altitud-agrupacio.html',
  './agrupacions.html',
  './afegir-agrupacio.html',
  './css/estils.css',
  './js/registrar-sw.js',
  './js/inici.js',
  './js/parceles.js',
  './js/afegir.js',
  './js/detall.js',
  './js/detall-agrupacio.js',
  './js/altitud.js',
  './js/altitud-agrupacio.js',
  './js/agrupacions.js',
  './js/afegir-agrupacio.js',
  './js/model/parcela.js',
  './js/model/agrupacio.js',
  './js/serveis/cadastre.js',
  './js/serveis/basedades.js',
  './js/serveis/exportadorGpx.js',
  './js/serveis/altimetria.js',
  './js/serveis/orientacio.js',
  './js/serveis/risc.js',
  './js/serveis/agregacioAgrupacio.js',
  './js/serveis/vegetacio.js',
  './js/serveis/ubicacions.js',
  './js/i18n.js',
  './js/i18n/es.js',
  './js/geometria/malla.js',
  './js/geometria/gradient.js',
  './js/ui/mapa.js',
  './js/ui/ajuda.js',
  './js/ui/risc-visual.js',
  './js/ui/menu.js',
  './manifest.json',
  './icones/icona.svg',
  './icones/icona-192.png',
  './icones/icona-512.png',
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
