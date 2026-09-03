// Controlador d'afegir-agrupacio.html. Mostra totes les parcel·les al
// mapa (com parceles.js); en tocar-ne una, es pot afegir a l'agrupació
// que s'està creant, o treure-la si ja hi era. Al final, es desa
// l'agrupació amb el seu nom i la llista de parcel·les triades.
//
// La mateixa pàgina serveix per EDITAR una agrupació ja existent:
// arribant-hi amb ?id=X (per exemple, des del botó "Editar" del
// detall d'una agrupació), es carrega la seva composició actual en
// lloc de començar de zero, i en guardar s'actualitza en lloc de
// crear-ne una de nova.
import { BaseDades } from './serveis/basedades.js';
import { Mapa } from './ui/mapa.js';
import { Agrupacio } from './model/agrupacio.js';
import { t, aplicarTraduccions, inicialitzarSelectorIdioma } from './i18n.js';
import { inicialitzarMenu } from './ui/menu.js';

aplicarTraduccions();
inicialitzarSelectorIdioma('selector-idioma');
inicialitzarMenu();

// Verd primari per a les parcel·les encara no triades, ocre d'accent
// per a les que ja formen part de l'agrupació que s'està creant --
// deliberadament diferents de l'escala de risc (verd->roig), perquè no
// es puguin confondre amb un color de risc.
const COLOR_NORMAL = '#396a49';
const COLOR_TRIADA = '#a1552e';

const titolPagina = document.querySelector('main h2');
const enllacTornar = document.getElementById('enllac-tornar');
const seccioParcelaTriada = document.getElementById('parcela-triada');
const contingutParcelaTriada = document.getElementById('contingut-parcela-triada');
const botoAfegirTreure = document.getElementById('boto-afegir-treure');
const missatgeBuides = document.getElementById('missatge-buides');
const llistatTriades = document.getElementById('llistat-triades');
const campNom = document.getElementById('nom-agrupacio');
const botoGuardar = document.getElementById('boto-guardar');
const missatgeEstat = document.getElementById('missatge-estat');

let bd;
let totesLesParceles = [];
// Set amb els id (Number) de les parcel·les triades fins ara.
const idsTriats = new Set();
let parcelaMostrada = null;
let mapa;
// Si no és null, s'està editant aquesta agrupació (en lloc de crear-ne
// una de nova) -- conserva el seu id per desar-hi a sobre.
let agrupacioEnEdicio = null;

async function iniciar() {
  const parametres = new URLSearchParams(window.location.search);
  const id = parametres.get('id');

  bd = await BaseDades.obrir();

  if (id) {
    agrupacioEnEdicio = await bd.llegirAgrupacio(id);
    if (!agrupacioEnEdicio) {
      mostrarEstat(t('No s\'ha trobat aquesta agrupació.'), 'error');
      return;
    }
    for (const pid of agrupacioEnEdicio.parcelaIds) {
      idsTriats.add(pid);
    }
    campNom.value = agrupacioEnEdicio.nom;

    document.title = `Custòdia — ${t('Editar agrupació')}`;
    titolPagina.textContent = t('Editar agrupació');
    enllacTornar.innerHTML =
      `<a href="detall-agrupacio.html?id=${encodeURIComponent(id)}" class="enllac-tornar">&larr; ${t('Tornar al detall')}</a>`;
  }

  totesLesParceles = await bd.llegirTotesLesParceles();

  mapa = new Mapa('mapa-agrupacio');
  pintarMapa();
  mapa.ajustarVistaATotes();
  pintarLlistatTriades();
}

/**
 * Repinta les parcel·les al mapa amb el color que els correspon (triada
 * o no). No toca la vista (zoom/desplaçament) -- només es crida un cop
 * en carregar la pàgina per ajustar-la a totes les parcel·les.
 */
function pintarMapa() {
  mapa.buidar();
  for (const parcela of totesLesParceles) {
    const color = idsTriats.has(parcela.id) ? COLOR_TRIADA : COLOR_NORMAL;
    mapa.afegirParcela(parcela, (p) => mostrarParcela(p), color);
  }
}

/** Mostra la fitxa bàsica de la parcel·la tocada, amb el botó d'afegir/treure. */
function mostrarParcela(parcela) {
  parcelaMostrada = parcela;

  contingutParcelaTriada.innerHTML = `
    <dl class="fitxa-parcela">
      <dt>${t('Població')}</dt><dd>${parcela.poblacio}</dd>
      <dt>${t('Polígon')}</dt><dd>${parcela.poligon}</dd>
      <dt>${t('Parcel·la')}</dt><dd>${parcela.parcelaCadastral}</dd>
      <dt>${t('Superfície')}</dt><dd>${parcela.superficie ? `${parcela.superficie} m²` : '—'}</dd>
    </dl>
  `;

  actualitzarBotoAfegirTreure();
  seccioParcelaTriada.hidden = false;
}

function actualitzarBotoAfegirTreure() {
  const jaTriada = idsTriats.has(parcelaMostrada.id);
  botoAfegirTreure.textContent = jaTriada
    ? t('Treure de l\'agrupació')
    : t('Afegir a l\'agrupació');
  botoAfegirTreure.className = jaTriada ? 'boto-estret boto-secundari' : 'boto-estret';
}

botoAfegirTreure.addEventListener('click', () => {
  if (!parcelaMostrada) return;

  if (idsTriats.has(parcelaMostrada.id)) {
    idsTriats.delete(parcelaMostrada.id);
  } else {
    idsTriats.add(parcelaMostrada.id);
  }

  actualitzarBotoAfegirTreure();
  pintarMapa();
  pintarLlistatTriades();
});

/** Llistat de les parcel·les ja triades, amb un botó per treure-les. */
function pintarLlistatTriades() {
  const triades = totesLesParceles.filter((p) => idsTriats.has(p.id));

  missatgeBuides.hidden = triades.length > 0;

  llistatTriades.innerHTML = triades
    .map(
      (p) => `
        <li>
          <span>${p.poblacio} — ${t('Polígon')} ${p.poligon}, ${t('Parcel·la')} ${p.parcelaCadastral}</span>
          <button type="button" class="boto-treure-triada" data-id="${p.id}" aria-label="${t('Treure')}">&times;</button>
        </li>
      `
    )
    .join('');

  llistatTriades.querySelectorAll('.boto-treure-triada').forEach((boto) => {
    boto.addEventListener('click', () => {
      idsTriats.delete(Number(boto.dataset.id));
      if (parcelaMostrada?.id === Number(boto.dataset.id)) {
        actualitzarBotoAfegirTreure();
      }
      pintarMapa();
      pintarLlistatTriades();
    });
  });
}

botoGuardar.addEventListener('click', async () => {
  const nom = campNom.value.trim();

  if (!nom) {
    mostrarEstat(t('Cal indicar un nom per a l\'agrupació.'), 'error');
    return;
  }
  if (idsTriats.size === 0) {
    mostrarEstat(t('Cal afegir-hi almenys una parcel·la.'), 'error');
    return;
  }

  botoGuardar.disabled = true;
  try {
    const agrupacio = new Agrupacio({
      id: agrupacioEnEdicio?.id ?? null,
      nom,
      parcelaIds: Array.from(idsTriats),
    });
    await bd.afegirAgrupacio(agrupacio);
    window.location.href = agrupacioEnEdicio
      ? `detall-agrupacio.html?id=${encodeURIComponent(agrupacioEnEdicio.id)}`
      : 'agrupacions.html';
  } catch (error) {
    console.error(error);
    mostrarEstat(`${t('No s\'ha pogut desar l\'agrupació:')} ${error.message}`, 'error');
  } finally {
    botoGuardar.disabled = false;
  }
});

function mostrarEstat(text, tipus) {
  missatgeEstat.textContent = text;
  missatgeEstat.className = `missatge-estat missatge-estat--${tipus}`;
  missatgeEstat.hidden = false;
}

iniciar().catch((error) => {
  console.error(error);
  mostrarEstat(t('No s\'han pogut carregar les parcel·les.'), 'error');
});
