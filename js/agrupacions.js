// Controlador d'agrupacions.html: llistat de les agrupacions ja
// creades, amb el mateix estil de llistat que el de parcel·les
// (nom, nombre de parcel·les, superfície total) -- no s'hi repeteix la
// població de cada parcel·la (si una agrupació en té deu del mateix
// municipi, sortiria deu vegades i no aportaria res).
//
// Igual que a parceles.html: tocar una parcel·la al mapa porta al
// detall de la seva agrupació; tocar una fila del llistat ressalta al
// mapa totes les parcel·les d'aquella agrupació. Amb cerca i ordenació.
import { BaseDades } from './serveis/basedades.js';
import { Mapa } from './ui/mapa.js';
import { inicialitzarOrdenacio } from './ui/ordenacio.js';
import { elementLlista, formatSuperficie, nombreParceles } from './ui/llista.js';
import { t, aplicarTraduccions, inicialitzarSelectorIdioma } from './i18n.js';
import { inicialitzarMenu } from './ui/menu.js';

aplicarTraduccions();
inicialitzarSelectorIdioma('selector-idioma');
inicialitzarMenu();

// Mateix ocre que fem servir a tot arreu per identificar el que forma
// part d'una agrupació (afegir-agrupacio.html), diferent de l'escala
// de risc perquè no es puguin confondre.
const COLOR_AGRUPACIO = '#a1552e';

const missatgeBuit = document.getElementById('missatge-buit');
const missatgeSenseResultats = document.getElementById('missatge-sense-resultats');
const llistatAgrupacions = document.getElementById('llistat-agrupacions');
const campCerca = document.getElementById('cerca-agrupacions');
const eines = document.getElementById('eines-llistat');

let mapa;
let termeCerca = '';

async function iniciar() {
  const bd = await BaseDades.obrir();
  const agrupacions = await bd.llegirTotesLesAgrupacions();
  // El mapa es mostra sempre (és el fons de la pantalla), encara que no
  // hi hagi cap agrupació.
  mapa = new Mapa('mapa-agrupacions');

  if (agrupacions.length === 0) {
    missatgeBuit.hidden = false;
    eines.hidden = true;
    return;
  }

  // Es necessita la superfície (i la geometria) de cada parcel·la --
  // es llegeixen totes un sol cop i s'indexen per id, en lloc de
  // consultar-les una a una per cada agrupació.
  const totesLesParceles = await bd.llegirTotesLesParceles();
  const parcelaPerId = new Map(totesLesParceles.map((p) => [p.id, p]));

  const files = agrupacions.map((agrupacio) => {
    const parceles = agrupacio.parcelaIds.map((id) => parcelaPerId.get(id)).filter(Boolean);
    const superficieTotal = parceles.reduce((acc, p) => acc + (p.superficie ?? 0), 0);
    return { agrupacio, parceles, superficieTotal };
  });

  function coincideix(fila) {
    if (!termeCerca) return true;
    return fila.agrupacio.nom.toLowerCase().includes(termeCerca);
  }

  function pintar() {
    const filesVisibles = files.filter(coincideix);
    missatgeSenseResultats.hidden = filesVisibles.length > 0;

    mapa.buidar();
    for (const { agrupacio, parceles } of filesVisibles) {
      for (const parcela of parceles) {
        mapa.afegirParcela(parcela, () => obrirDetall(agrupacio.id), COLOR_AGRUPACIO);
      }
    }
    if (filesVisibles.length > 0) {
      mapa.ajustarVistaATotes();
    }

    pintarLlistat(filesVisibles);
  }

  inicialitzarOrdenacio(
    document.getElementById('ordre-agrupacions'),
    document.getElementById('ordre-agrupacions-sentit'),
    files,
    {
      nom: (f) => f.agrupacio.nom,
      nombreParceles: (f) => f.agrupacio.parcelaIds.length,
      superficieTotal: (f) => f.superficieTotal,
    },
    pintar
  );

  campCerca.addEventListener('input', () => {
    termeCerca = campCerca.value.trim().toLowerCase();
    pintar();
  });

  pintar();
}

/** Pinta el llistat del panell (no el mapa) en l'ordre i filtre actuals. */
function pintarLlistat(files) {
  // Tocar una agrupació ressalta al mapa totes les seves parcel·les; el
  // botó "Detall" porta directament a la fitxa de l'agrupació.
  llistatAgrupacions.replaceChildren(
    ...files.map(({ agrupacio, superficieTotal }) =>
      elementLlista({
        titol: agrupacio.nom,
        detall: `${nombreParceles(agrupacio.parcelaIds.length)} · ${formatSuperficie(superficieTotal)}`,
        href: `detall-agrupacio.html?id=${encodeURIComponent(agrupacio.id)}`,
        onSeleccionar: () => mapa.ressaltarParceles(agrupacio.parcelaIds),
      })
    )
  );
}

function obrirDetall(idAgrupacio) {
  window.location.href = `detall-agrupacio.html?id=${encodeURIComponent(idAgrupacio)}`;
}

iniciar().catch((error) => {
  console.error(error);
});
