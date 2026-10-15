// Service worker bàsic: cache dels fitxers estàtics per a ús offline.
// Actualitzar la llista si s'afegeixen pantalles noves.

const NOM_CACHE = 'custodia-v86';

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
  './geometries.html',
  './copia-seguretat.html',
  './afegir-geometria.html',
  './detall-geometria.html',
  './css/estils.css',
  './nucli/css/nucli.css',
  './nucli/js/exportadors/obj.js',
  './nucli/js/exportadors/stl.js',
  './nucli/js/geometria/poligon.js',
  './nucli/js/geometria/projeccio.js',
  './nucli/js/geometria/solid.js',
  './nucli/js/geometria/terreny.js',
  './nucli/js/i18n/es.js',
  './nucli/js/i18n/i18n.js',
  './nucli/js/model/zona.js',
  './nucli/js/pagaments/compres.js',
  './nucli/js/serveis/cadastre.js',
  './nucli/js/serveis/escalaColor.js',
  './nucli/js/serveis/generadorModel.js',
  './nucli/js/serveis/magatzem.js',
  './nucli/js/serveis/mdt.js',
  './nucli/js/serveis/ortofoto.js',
  './nucli/js/serveis/ubicacions.js',
  './nucli/js/ui/avisos.js',
  './nucli/js/ui/descarrega.js',
  './nucli/js/ui/dibuixPoligon.js',
  './nucli/js/ui/mapaBase.js',
  './nucli/js/ui/visor3d.js',
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
  './js/geometries.js',
  './js/copia-seguretat.js',
  './js/afegir-geometria.js',
  './js/detall-geometria.js',
  './js/model/parcela.js',
  './js/model/agrupacio.js',
  './js/model/geometria.js',
  './js/serveis/basedades.js',
  './js/serveis/exportadorDades.js',
  './js/serveis/exportadorGpx.js',
  './js/serveis/altimetria.js',
  './js/serveis/orientacio.js',
  './js/serveis/risc.js',
  './js/serveis/agregacioAgrupacio.js',
  './js/serveis/vegetacio.js',
  './js/i18n.js',
  './js/i18n/es.js',
  './js/geometria/malla.js',
  './js/geometria/gradient.js',
  './js/ui/mapa.js',
  './js/ui/mapa3d.js',
  './js/ui/ajuda.js',
  './js/ui/risc-visual.js',
  './js/ui/menu.js',
  './js/ui/icones.js',
  './js/ui/disposicio.js',
  './js/ui/dialegs.js',
  './js/ui/ordenacio.js',
  './js/ui/llista.js',
  './js/ui/pestanyes.js',
  './js/ui/vista3d.js',
  './js/ui/controlsMapa.js',
  './manifest.json',
  './icones/icona.svg',
  './icones/icona-192.png',
  './icones/icona-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    // cache: 'reload': cada fitxer es demana a la xarxa, saltant-se la
    // memòria cau HTTP del navegador. Codeberg Pages els serveix amb
    // stale-while-revalidate=3600: sense això, una versió nova del
    // service worker podia desar-se fitxers d'una hora abans (comprovat
    // el 2026-10-15: v81 amb l'index.html de v80).
    caches
      .open(NOM_CACHE)
      .then((cache) => cache.addAll(FITXERS_PER_CACHE.map((url) => new Request(url, { cache: 'reload' }))))
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
  // Només els fitxers de la pròpia app (mateix origen, GET), que són els
  // que hi ha a la cache. La resta -- tessel·les del mapa, CDN, Cadastre,
  // MDT, ortofoto -- va directament a la xarxa, sense passar per aquí
  // (no són a la cache: fer-les passar pel service worker només hi
  // afegia un pas).
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((respostaCache) => respostaCache || fetch(event.request))
  );
});
