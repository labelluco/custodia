// Controlador de index.html: la pantalla d'inici, amb la mateixa
// interfície que la resta (mapa a pantalla completa + panell flotant).
// El mapa mostra tot el territori desat (parcel·les amb el color del
// risc, geometries) i el panell, quantes n'hi ha de cada i els accessos.
// Tocar un perímetre porta al seu detall.
import { BaseDades } from './serveis/basedades.js';
import { Mapa } from './ui/mapa.js';
import { ServeiRisc } from './serveis/risc.js';
import { nombreParceles } from './ui/llista.js';
import { t, aplicarTraduccions, inicialitzarSelectorIdioma } from './i18n.js';
import { inicialitzarMenu } from './ui/menu.js';

aplicarTraduccions();
inicialitzarSelectorIdioma('selector-idioma');
inicialitzarMenu();

const escriure = (id, text) => {
  document.getElementById(id).textContent = text;
};

async function iniciar() {
  const mapa = new Mapa('mapa-inici');
  const bd = await BaseDades.obrir();
  const [parceles, agrupacions, geometries] = await Promise.all([
    bd.llegirTotesLesParceles(),
    bd.llegirTotesLesAgrupacions(),
    bd.llegirTotesLesGeometries(),
  ]);

  escriure('nombre-parceles', nombreParceles(parceles.length));
  escriure('nombre-agrupacions', `${agrupacions.length} ${agrupacions.length === 1 ? t('agrupació') : t('agrupacions')}`);
  escriure('nombre-geometries', `${geometries.length} ${geometries.length === 1 ? t('geometria') : t('geometries')}`);
  escriure('nombre-copia', 'CSV');

  for (const parcela of parceles) {
    const { color } = await ServeiRisc.colorIIndexDe(bd, parcela);
    mapa.afegirParcela(parcela, (p) => obrir(`detall.html?id=${encodeURIComponent(p.id)}`), color);
  }
  for (const geometria of geometries) {
    const { color } = await ServeiRisc.colorIIndexDe(bd, geometria, { esGeometria: true });
    mapa.afegirParcela(geometria, (g) => obrir(`detall-geometria.html?id=${encodeURIComponent(g.id)}`), color);
  }
  mapa.ajustarVistaATotes();
}

function obrir(url) {
  window.location.href = url;
}

iniciar().catch((error) => {
  console.error(error);
});
