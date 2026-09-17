// Controlador de detall-geometria.html. L'id arriba per URL:
// detall-geometria.html?id=123
//
// Molt semblant a detall.js, però sense cap dada cadastral: no hi ha
// subparceles ni "ús", per això el risc de vegetació sempre surt
// "no disponible" (es calcula igualment amb pendent i orientació,
// redistribuint-ne els pesos -- vegeu ServeiRisc).
import { BaseDades } from './serveis/basedades.js';
import { Mapa } from './ui/mapa.js';
import { Geometria } from './model/geometria.js';
import { ExportadorGpx } from './serveis/exportadorGpx.js';
import { ServeiOrientacio } from './serveis/orientacio.js';
import { ServeiRisc } from './serveis/risc.js';
import { inicialitzarAjudes, iconaAjuda } from './ui/ajuda.js';
import { crearAnellSvg, filaComponent } from './ui/risc-visual.js';
import { t, idiomaActual, aplicarTraduccions, inicialitzarSelectorIdioma } from './i18n.js';
import { inicialitzarMenu } from './ui/menu.js';

aplicarTraduccions();
inicialitzarSelectorIdioma('selector-idioma');
inicialitzarMenu();
inicialitzarAjudes();

const contenidorDades = document.getElementById('contingut-dades-geometria');
const seccioRiscCalculat = document.getElementById('seccio-risc-calculat');
const contingutRiscCalculat = document.getElementById('contingut-risc-calculat');
const seccioAccions = document.getElementById('accions-geometria');
const seccioFiltreMapa = document.getElementById('filtre-mapa');
const selectFiltreMapa = document.getElementById('select-filtre-mapa');
const botoPendentOrientacio = document.getElementById('boto-pendent-orientacio');
const botoExportarGpx = document.getElementById('boto-exportar-gpx');
const botoEsborrar = document.getElementById('boto-esborrar');

let bd;
let geometriaActual;

async function iniciar() {
  const parametres = new URLSearchParams(window.location.search);
  const id = parametres.get('id');

  if (!id) {
    contenidorDades.textContent = t('No s\'ha indicat cap geometria.');
    return;
  }

  bd = await BaseDades.obrir();
  geometriaActual = await bd.llegirGeometria(id);

  if (!geometriaActual) {
    contenidorDades.textContent = t('No s\'ha trobat aquesta geometria.');
    return;
  }

  document.title = `Custòdia — ${geometriaActual.nom}`;
  pintarFitxa(geometriaActual);

  // A diferència d'una parcel·la, no hi ha subparceles -- es passa una
  // llista buida, i ServeiRisc ja sap redistribuir els pesos quan
  // falta el component de vegetació.
  const color = pintarRisc([]);

  const mapa = new Mapa('mapa-detall');
  mapa.afegirParcela(geometriaActual, null, color);
  mapa.ajustarVistaATotes();

  inicialitzarFiltreMapa(mapa, geometriaActual);

  seccioAccions.hidden = false;
}

/** Igual que a detall.js: només es mostra si ja hi ha punts d'altimetria desats. */
/**
 * Afegeix el pas de la graella (si es coneix) a cada punt, perquè
 * Mapa pugui dibuixar-hi un quadrat de cobertura en lloc d'un punt sol.
 */
function ambPas(punts, entitat) {
  return punts.map((p) => ({ ...p, pasLat: entitat.pasLatMalla, pasLng: entitat.pasLngMalla }));
}

function inicialitzarFiltreMapa(mapa, geometria) {
  if (!geometria.puntsAltitud?.length) return;

  seccioFiltreMapa.hidden = false;
  const opcioOrientacio = selectFiltreMapa.querySelector('option[value="orientacio"]');
  opcioOrientacio.hidden = geometria.metodeAltitud !== 'malla';
  const opcioPendent = selectFiltreMapa.querySelector('option[value="pendent"]');
  const opcioOmbres = selectFiltreMapa.querySelector('option[value="ombres"]');
  opcioPendent.hidden = geometria.metodeAltitud !== 'malla';
  opcioOmbres.hidden = geometria.metodeAltitud !== 'malla';

  selectFiltreMapa.addEventListener('change', () => {
    if (selectFiltreMapa.value === 'altitud') {
      mapa.afegirFiltreAltitud(ambPas(geometria.puntsAltitud, geometria));
    } else if (selectFiltreMapa.value === 'orientacio') {
      const punts = geometria.puntsAltitud.map((p) => ({
        ...p,
        etiqueta: p.orientacio == null ? null : t(ServeiOrientacio.etiquetaBruixola(p.orientacio)),
      }));
      mapa.afegirFiltreOrientacio(punts);
    } else if (selectFiltreMapa.value === 'cotes') {
      mapa.afegirFiltreCotes(geometria.puntsAltitud);
    } else if (selectFiltreMapa.value === 'pendent') {
      mapa.afegirFiltrePendent(ambPas(geometria.puntsAltitud, geometria));
    } else if (selectFiltreMapa.value === 'ombres') {
      mapa.afegirFiltreOmbres(ambPas(geometria.puntsAltitud, geometria));
    } else {
      mapa.netejarFiltre();
    }
  });
}

function pintarRisc(subparceles) {
  seccioRiscCalculat.hidden = false;

  const textAjudaRisc = t(
    'Índex propi (0-100) que combina vegetació, pendent i orientació per comparar parcel·les entre elles. No representa una probabilitat ni una freqüència real d\'incendis.'
  );
  seccioRiscCalculat.querySelector('h2').innerHTML = `${t('Risc d\'incendi calculat')}${iconaAjuda(textAjudaRisc)}`;

  if (geometriaActual.pendentMitja == null) {
    seccioRiscCalculat.style.borderTopColor = '';
    contingutRiscCalculat.innerHTML = `
      <p>
        ${t('Cal fer primer els càlculs d\'')}<a href="altitud.html?id=${encodeURIComponent(geometriaActual.id)}&tipus=geometria">${t('Altimetria')}</a>.
      </p>
    `;
    return ServeiRisc.COLOR_NEUTRE;
  }

  const { indexPerillositat, riscVegetacio, riscPendent, riscOrientacio } = ServeiRisc.calcularRiscTotal({
    pendentMitja: geometriaActual.pendentMitja,
    orientacioMitjana: geometriaActual.orientacioMitjana,
    subparceles,
  });

  const colorTotal = ServeiRisc.colorSegonsRisc(indexPerillositat);
  seccioRiscCalculat.style.borderTopColor = colorTotal;

  contingutRiscCalculat.innerHTML = `
    <div class="risc-panell">
      <div class="risc-gauge">
        ${crearAnellSvg(indexPerillositat, colorTotal, t('Índex de perillositat'))}
        <div class="risc-gauge__valor">
          <span class="risc-gauge__numero">${indexPerillositat.toFixed(0)}</span>
          <span class="risc-gauge__escala">/ 100</span>
        </div>
      </div>
      <div class="risc-components">
        ${filaComponent(t('Component vegetació'), riscVegetacio, t('No disponible (sense dades cadastrals)'))}
        ${filaComponent(t('Component pendent'), riscPendent, '')}
        ${filaComponent(t('Component orientació'), riscOrientacio, t('No disponible (cal el mètode de malla)'))}
      </div>
    </div>
  `;

  return colorTotal;
}

function pintarFitxa(geometria) {
  const ajudaPendent = iconaAjuda(
    t('Inclinació mitjana del terreny, calculada a partir del model digital d\'elevacions de l\'IDEE (vèrtexs del perímetre o una malla de punts interiors).')
  );
  const filaAltimetria = `
    <dt>${t('Pendent mitjà')}${ajudaPendent}</dt>
    <dd>${geometria.pendentMitja != null ? `${geometria.pendentMitja.toFixed(1)} %` : '—'}</dd>
  `;

  const ajudaOrientacio = iconaAjuda(
    t('Direcció cap on "mira" el pendent del terreny. Només es calcula amb el mètode de malla, no amb els vèrtexs del perímetre.')
  );
  const filaOrientacio = `
    <dt>${t('Orientació mitjana')}${ajudaOrientacio}</dt>
    <dd>${geometria.orientacioMitjana != null ? `${geometria.orientacioMitjana.toFixed(0)}° (${t(ServeiOrientacio.etiquetaBruixola(geometria.orientacioMitjana))})` : '—'}</dd>
  `;

  const localeData = idiomaActual() === 'ca' ? 'ca-ES' : 'es-ES';
  const ajudaData = iconaAjuda(
    t('Dades desades a la base de dades local en el moment de crear la geometria. Per tornar-la a moure, cal esborrar-la i afegir-la de nou.')
  );
  const notaData = geometria.dataCreacio != null
    ? `<p class="nota">${t('Dades consultades el')}${ajudaData}: ${new Date(geometria.dataCreacio).toLocaleDateString(localeData)}</p>`
    : '';

  contenidorDades.innerHTML = `
    <h3>${t('Identificació')}</h3>
    <dl class="fitxa-parcela">
      <dt>${t('Nom')}</dt><dd>${geometria.nom}</dd>
    </dl>

    <h3>${t('Terreny')}</h3>
    <dl class="fitxa-parcela">
      ${filaAltimetria}
      ${filaOrientacio}
    </dl>

    ${notaData}
  `;
}

botoPendentOrientacio.addEventListener('click', () => {
  window.location.href = `altitud.html?id=${encodeURIComponent(geometriaActual.id)}&tipus=geometria`;
});

botoExportarGpx.addEventListener('click', () => {
  ExportadorGpx.descarregar(geometriaActual);
});

botoEsborrar.addEventListener('click', async () => {
  const confirmat = confirm(
    `${t('Segur que vols esborrar la geometria')} "${geometriaActual.nom}"? ${t('Aquesta acció no es pot desfer.')}`
  );
  if (!confirmat) return;

  await bd.esborrarGeometria(geometriaActual.id);
  window.location.href = 'geometries.html';
});

iniciar().catch((error) => {
  console.error(error);
  alert(t('No s\'ha pogut carregar el detall de la geometria.'));
});
