// Controlador d'agrupacions.html: llistat de les agrupacions ja
// creades, amb el mateix estil de taula que el llistat de parcel·les
// (nom, nombre de parcel·les, superfície total) -- no s'hi repeteix la
// població de cada parcel·la (si una agrupació en té deu del mateix
// municipi, sortiria deu vegades i no aportaria res).
//
// Igual que a parceles.html: tocar una parcel·la al mapa porta al
// detall de la seva agrupació; tocar una fila del llistat ressalta al
// mapa totes les parcel·les d'aquella agrupació.
import { BaseDades } from './serveis/basedades.js';
import { Mapa } from './ui/mapa.js';
import { t, aplicarTraduccions, inicialitzarSelectorIdioma } from './i18n.js';
import { inicialitzarMenu } from './ui/menu.js';

aplicarTraduccions();
inicialitzarSelectorIdioma('selector-idioma');
inicialitzarMenu();

// Mateix ocre que fem servir a tot arreu per identificar el que forma
// part d'una agrupació (afegir-agrupacio.html), diferent de l'escala
// de risc perquè no es puguin confondre.
const COLOR_AGRUPACIO = '#a1552e';

const seccioMapa = document.getElementById('mapa-agrupacions');
const missatgeBuit = document.getElementById('missatge-buit');
const llistatAgrupacions = document.getElementById('llistat-agrupacions');

let mapa;

async function iniciar() {
  const bd = await BaseDades.obrir();
  const agrupacions = await bd.llegirTotesLesAgrupacions();

  if (agrupacions.length === 0) {
    missatgeBuit.hidden = false;
    return;
  }

  // Es necessita la superfície (i la geometria) de cada parcel·la --
  // es llegeixen totes un sol cop i s'indexen per id, en lloc de
  // consultar-les una a una per cada agrupació.
  const totesLesParceles = await bd.llegirTotesLesParceles();
  const parcelaPerId = new Map(totesLesParceles.map((p) => [p.id, p]));

  seccioMapa.hidden = false;
  mapa = new Mapa('mapa-agrupacions');

  llistatAgrupacions.innerHTML = agrupacions
    .map((agrupacio) => {
      const parceles = agrupacio.parcelaIds.map((id) => parcelaPerId.get(id)).filter(Boolean);
      const superficieTotal = parceles.reduce((acc, p) => acc + (p.superficie ?? 0), 0);

      for (const parcela of parceles) {
        mapa.afegirParcela(parcela, () => obrirDetall(agrupacio.id), COLOR_AGRUPACIO);
      }

      return `
        <tr class="fila-parcela" data-id="${agrupacio.id}" data-parceles="${agrupacio.parcelaIds.join(',')}">
          <td>${agrupacio.nom}</td>
          <td>${agrupacio.parcelaIds.length}</td>
          <td>${superficieTotal ? `${superficieTotal} m²` : '—'}</td>
          <td><a href="detall-agrupacio.html?id=${encodeURIComponent(agrupacio.id)}" class="boto-taula">${t('Detall')}</a></td>
        </tr>
      `;
    })
    .join('');

  mapa.ajustarVistaATotes();

  // Tocar la fila ressalta al mapa totes les parcel·les de l'agrupació
  // (com al llistat de parceles.html); el botó "Detall" porta
  // directament a la fitxa de l'agrupació.
  llistatAgrupacions.querySelectorAll('.fila-parcela').forEach((fila) => {
    fila.addEventListener('click', () => {
      const ids = fila.dataset.parceles.split(',').filter(Boolean).map(Number);
      mapa.ressaltarParceles(ids);

      const anteriorSeleccionada = llistatAgrupacions.querySelector('.fila-parcela--seleccionada');
      anteriorSeleccionada?.classList.remove('fila-parcela--seleccionada');
      fila.classList.add('fila-parcela--seleccionada');
    });
    fila.querySelector('.boto-taula').addEventListener('click', (event) => event.stopPropagation());
  });
}

function obrirDetall(idAgrupacio) {
  window.location.href = `detall-agrupacio.html?id=${encodeURIComponent(idAgrupacio)}`;
}

iniciar().catch((error) => {
  console.error(error);
});
