// Controlador de detall-agrupacio.html. L'id arriba per URL:
// detall-agrupacio.html?id=123
//
// A diferència d'una parcel·la, aquí no es calcula res de nou (ni
// altitud ni risc): es combinen els valors ja calculats i desats a
// cada parcel·la que forma l'agrupació. Per això totes les parcel·les
// han d'estar calculades amb el mètode de malla (l'única que dona
// orientació) -- si en falta alguna, s'avisa clarament en lloc
// d'intentar combinar dades incompletes.
import { BaseDades } from './serveis/basedades.js';
import { Mapa } from './ui/mapa.js';
import { inicialitzarControlsMapa } from './ui/controlsMapa.js';
import { ServeiRisc } from './serveis/risc.js';
import { ServeiOrientacio } from './serveis/orientacio.js';
import { crearAnellSvg, filaComponent } from './ui/risc-visual.js';
import { calcularAgregatAgrupacio } from './serveis/agregacioAgrupacio.js';
import { inicialitzarAjudes, iconaAjuda } from './ui/ajuda.js';
import { t, aplicarTraduccions, inicialitzarSelectorIdioma } from './i18n.js';
import { inicialitzarMenu } from './ui/menu.js';
import { confirmar } from './ui/dialegs.js';
import { elementLlista, formatSuperficie, nombreParceles } from './ui/llista.js';

aplicarTraduccions();
inicialitzarSelectorIdioma('selector-idioma');
inicialitzarMenu();
inicialitzarAjudes();

const contenidorDades = document.getElementById('contingut-dades-agrupacio');
const seccioParceles = document.getElementById('seccio-parceles');
const llistatParceles = document.getElementById('llistat-parceles-agrupacio');
const seccioRisc = document.getElementById('seccio-risc-calculat');
const contingutRisc = document.getElementById('contingut-risc-calculat');
const seccioAccions = document.getElementById('accions-agrupacio');
const botoEditar = document.getElementById('boto-editar');
const botoPuntsAltitud = document.getElementById('boto-punts-altitud');
const botoEsborrar = document.getElementById('boto-esborrar');

let bd;
let agrupacioActual;
let parcelesAgrupacio = [];
let mapa;

async function iniciar() {
  const parametres = new URLSearchParams(window.location.search);
  const id = parametres.get('id');

  if (!id) {
    contenidorDades.textContent = t('No s\'ha indicat cap agrupació.');
    return;
  }

  bd = await BaseDades.obrir();
  agrupacioActual = await bd.llegirAgrupacio(id);

  if (!agrupacioActual) {
    contenidorDades.textContent = t('No s\'ha trobat aquesta agrupació.');
    return;
  }

  document.title = `Custòdia — ${agrupacioActual.nom}`;
  document.getElementById('titol-detall').textContent = agrupacioActual.nom;

  // filter(Boolean): si mai s'esborrés una parcel·la que forma part
  // d'una agrupació (l'app ho impedeix, però per si de cas), es
  // descarta en lloc de trencar la resta de la pàgina.
  parcelesAgrupacio = (
    await Promise.all(agrupacioActual.parcelaIds.map((pid) => bd.llegirParcela(pid)))
  ).filter(Boolean);
  document.getElementById('subtitol-detall').textContent = nombreParceles(parcelesAgrupacio.length);

  const agregat = await calcularAgregatAgrupacio(bd, parcelesAgrupacio);
  pintarDades(agregat);
  const color = pintarRisc(agregat);

  mapa = new Mapa('mapa-agrupacio');
  parcelesAgrupacio.forEach((p) => mapa.afegirParcela(p, (parcela) => obrirDetall(parcela.id), color));
  mapa.ajustarVistaATotes();

  inicialitzarControlsMapa({
    mapa,
    entitats: parcelesAgrupacio,
    // Cada punt porta el pas de la SEVA parcel·la, no un de compartit --
    // si es van calcular amb distàncies diferents, cada una dibuixa els
    // seus quadrats a la mida correcta.
    punts: parcelesAgrupacio.flatMap((p) =>
      (p.puntsAltitud ?? []).map((punt) => ({ ...punt, pasLat: p.pasLatMalla, pasLng: p.pasLngMalla }))
    ),
    potFerMalla: parcelesAgrupacio.every((p) => p.metodeAltitud === 'malla'),
    idMapa2d: 'mapa-agrupacio',
    idMapa3d: 'mapa-agrupacio-3d',
  });

  // Es pinta després de crear el mapa: cada fila necessita poder-hi
  // ressaltar la seva parcel·la en tocar-la.
  pintarParceles();

  seccioAccions.hidden = false;
}

/** Igual que a parceles.js: obre el detall, indicant que s'hi arriba des d'aquesta agrupació. */
function obrirDetall(idParcela) {
  window.location.href = `detall.html?id=${encodeURIComponent(idParcela)}&agrupacio=${encodeURIComponent(agrupacioActual.id)}`;
}

function pintarParceles() {
  // Tocar una parcel·la la ressalta al mapa (com al llistat de
  // parceles.html); el botó "Detall" porta directament a la seva fitxa.
  llistatParceles.replaceChildren(
    ...parcelesAgrupacio.map((p) =>
      elementLlista({
        titol: `${p.poblacio} · ${p.poligon}/${p.parcelaCadastral}`,
        detall: formatSuperficie(p.superficie),
        href: `detall.html?id=${encodeURIComponent(p.id)}&agrupacio=${encodeURIComponent(agrupacioActual.id)}`,
        onSeleccionar: () => mapa.ressaltarParcela(p.id),
      })
    )
  );
  seccioParceles.hidden = false;
}

function pintarDades(agregat) {
  const totalSuperficie = parcelesAgrupacio.reduce((acc, p) => acc + (p.superficie ?? 0), 0);

  const filaTerreny = agregat.ok
    ? `
      <dt>${t('Altitud mínima')}</dt><dd>${agregat.altitudMinima.toFixed(0)} m</dd>
      <dt>${t('Altitud màxima')}</dt><dd>${agregat.altitudMaxima.toFixed(0)} m</dd>
      <dt>${t('Desnivell')}</dt><dd>${agregat.desnivell.toFixed(0)} m</dd>
      <dt>${t('Pendent mitjà')}</dt><dd>${agregat.pendentMitja.toFixed(1)} %</dd>
      <dt>${t('Orientació mitjana')}</dt><dd>${agregat.orientacioMitjana.toFixed(0)}° (${t(ServeiOrientacio.etiquetaBruixola(agregat.orientacioMitjana))})</dd>
    `
    : `<dt>${t('Terreny')}</dt><dd>${t('Cal calcular primer l\'altitud (mètode de malla) de totes les parcel·les de l\'agrupació.')}</dd>`;

  contenidorDades.innerHTML = `
    <h3>${t('Identificació')}</h3>
    <dl class="fitxa-parcela">
      <dt>${t('Nom')}</dt><dd>${agrupacioActual.nom}</dd>
      <dt>${t('Nombre de parcel·les')}</dt><dd>${parcelesAgrupacio.length}</dd>
      <dt>${t('Superfície total')}</dt><dd>${totalSuperficie ? `${totalSuperficie} m²` : '—'}</dd>
    </dl>

    <h3>${t('Terreny (agregat)')}</h3>
    <dl class="fitxa-parcela">
      ${filaTerreny}
    </dl>
  `;
}

function pintarRisc(agregat) {
  seccioRisc.hidden = false;

  const textAjudaRisc = t(
    'Índex propi (0-100) que combina vegetació, pendent i orientació per comparar parcel·les entre elles. No representa una probabilitat ni una freqüència real d\'incendis.'
  );
  seccioRisc.querySelector('h2').innerHTML = `${t('Risc d\'incendi calculat')}${iconaAjuda(textAjudaRisc)}`;

  if (!agregat.ok) {
    seccioRisc.style.borderTopColor = '';
    const enllacos = agregat.senseCalcular
      .map(
        (p) =>
          `<a href="altitud.html?id=${encodeURIComponent(p.id)}">${p.poblacio} (${p.poligon}/${p.parcelaCadastral})</a>`
      )
      .join(', ');
    contingutRisc.innerHTML = `
      <p>
        ${t('Cal calcular l\'altitud amb el mètode de malla per a totes les parcel·les de l\'agrupació abans de poder-ne calcular el risc conjunt. Falta per a:')}
        ${enllacos}.
      </p>
    `;
    return ServeiRisc.COLOR_NEUTRE;
  }

  const { indexPerillositat, riscVegetacio, riscPendent, riscOrientacio } = agregat.risc;
  const colorTotal = ServeiRisc.colorSegonsRisc(indexPerillositat);
  seccioRisc.style.borderTopColor = colorTotal;

  contingutRisc.innerHTML = `
    <div class="risc-panell">
      <div class="risc-gauge">
        ${crearAnellSvg(indexPerillositat, colorTotal, t('Índex de perillositat'))}
        <div class="risc-gauge__valor">
          <span class="risc-gauge__numero">${indexPerillositat.toFixed(0)}</span>
          <span class="risc-gauge__escala">/ 100</span>
        </div>
      </div>
      <div class="risc-components">
        ${filaComponent(t('Component vegetació'), riscVegetacio, t('No disponible (sense subparceles)'))}
        ${filaComponent(t('Component pendent'), riscPendent, '')}
        ${filaComponent(t('Component orientació'), riscOrientacio, t('No disponible (cal el mètode de malla)'))}
      </div>
    </div>
  `;

  return colorTotal;
}

botoEditar.addEventListener('click', () => {
  window.location.href = `afegir-agrupacio.html?id=${encodeURIComponent(agrupacioActual.id)}`;
});

botoPuntsAltitud.addEventListener('click', () => {
  window.location.href = `altitud-agrupacio.html?id=${encodeURIComponent(agrupacioActual.id)}`;
});

botoEsborrar.addEventListener('click', async () => {
  const confirmat = await confirmar(
    `${t('Segur que vols esborrar l\'agrupació')} "${agrupacioActual.nom}"? ${t('Aquesta acció no es pot desfer (les parcel·les que la formen no s\'esborraran).')}`,
    { accio: t('Esborrar'), perillos: true }
  );
  if (!confirmat) return;

  await bd.esborrarAgrupacio(agrupacioActual.id);
  window.location.href = 'agrupacions.html';
});

iniciar().catch((error) => {
  console.error(error);
  contenidorDades.textContent = t('No s\'ha pogut carregar l\'agrupació.');
});
