// Controlador d'altitud.html. Calcula i permet desar l'altitud
// màxima/mínima, el desnivell i el pendent mitjà d'una parcel·la, amb
// dos mètodes possibles: vèrtexs del perímetre, o una malla de punts
// interiors. Amb el mètode de malla, també es calcula l'orientació
// mitjana (reutilitza els mateixos gradients que el pendent). L'id
// arriba per URL: altitud.html?id=123
import { BaseDades } from './serveis/basedades.js';
import { Mapa } from './ui/mapa.js';
import { Parcela } from './model/parcela.js';
import { ServeiAltimetria } from './serveis/altimetria.js';
import { ServeiOrientacio } from './serveis/orientacio.js';
import { Malla } from './geometria/malla.js';
import { inicialitzarAjudes, iconaAjuda } from './ui/ajuda.js';
import { t, aplicarTraduccions, inicialitzarSelectorIdioma } from './i18n.js';
import { inicialitzarMenu } from './ui/menu.js';

aplicarTraduccions();
inicialitzarSelectorIdioma('selector-idioma');
inicialitzarMenu();
inicialitzarAjudes();

// Límit de punts per consultar en una sola crida a l'API, per evitar
// generar peticions desproporcionades si algú tria una distància molt
// petita en una parcel·la gran.
const LLINDAR_AVIS_PUNTS = 1000;

const instruccioMapa = document.getElementById('instruccio-mapa');
const resum = document.getElementById('resum-altimetria');
const contingutResum = document.getElementById('contingut-resum-altimetria');
const botoCalcular = document.getElementById('boto-calcular');
const botoDesar = document.getElementById('boto-desar-altimetria');
const missatgeEstat = document.getElementById('missatge-estat');
const campDistanciaMalla = document.getElementById('distancia-malla');

// Colors clars per al fons del resum -- verd per a missatges d'ajuda o
// d'estat (encara calculant, res calculat encara), roig per a errors.
// Els resultats calculats no porten color, es queden amb el blanc
// normal de la targeta (no és "un missatge", és la dada en si).
//
// Es reforça amb una vora lateral de color, més fàcil de notar que
// només un lleuger canvi de fons sobre una targeta que ja té vora i
// ombra pròpies.
const COLOR_FONS_INFO = '#e8f5e9';
const COLOR_VORA_INFO = '#66bb6a';
const COLOR_FONS_ERROR = '#ffebee';
const COLOR_VORA_ERROR = '#e57373';

function aplicarEstatMissatge(element, tipus) {
  element.style.backgroundColor = tipus === 'info' ? COLOR_FONS_INFO : tipus === 'error' ? COLOR_FONS_ERROR : '';
  element.style.borderLeft = tipus === 'info'
    ? `5px solid ${COLOR_VORA_INFO}`
    : tipus === 'error'
      ? `5px solid ${COLOR_VORA_ERROR}`
      : '';
}

function establirEstatResum(tipus) {
  aplicarEstatMissatge(resum, tipus);
}

let bd;
let parcelaActual;
let valorsCalculats = null;
let puntsCalculats = null;
let metodeCalculat = null;
let mapaActual = null;

async function iniciar() {
  const parametres = new URLSearchParams(window.location.search);
  const id = parametres.get('id');

  if (!id) {
    resum.hidden = false;
    establirEstatResum('error');
    contingutResum.textContent = t('No s\'ha indicat cap parcel·la.');
    return;
  }

  bd = await BaseDades.obrir();
  parcelaActual = await bd.llegirParcela(id);

  if (!parcelaActual) {
    resum.hidden = false;
    establirEstatResum('error');
    contingutResum.textContent = t('No s\'ha trobat aquesta parcel·la.');
    return;
  }

  document.title = `Custòdia — ${t('Altimetria')} (${parcelaActual.poblacio})`;
  document.getElementById('enllac-tornar').innerHTML =
    `<a href="detall.html?id=${encodeURIComponent(id)}" class="enllac-tornar">&larr; ${t('Tornar al detall')}</a>`;

  // El mapa amb el perímetre es mostra de seguida, com a la resta de
  // pàgines, sense esperar cap càlcul.
  const mapa = crearMapa();
  mapa.afegirParcela(parcelaActual);
  mapa.ajustarVistaATotes();

  mostrarValorsDesats(mapa);
}

/**
 * Si la parcel·la ja té valors desats (d'un càlcul anterior), es
 * mostren de seguida, sense haver de tornar a calcular-los -- i, si hi
 * ha punts individuals guardats, es pinten també al mapa (sense haver
 * de tornar a consultar l'IDEE).
 */
function mostrarValorsDesats(mapa) {
  const jaCalculat =
    parcelaActual.altitudMaxima != null &&
    parcelaActual.altitudMinima != null &&
    parcelaActual.desnivell != null &&
    parcelaActual.pendentMitja != null;

  resum.hidden = false;

  if (!jaCalculat) {
    establirEstatResum('info');
    contingutResum.textContent = t('Encara no s\'ha calculat l\'altimetria d\'aquesta parcel·la.');
    return;
  }

  if (parcelaActual.puntsAltitud?.length > 0) {
    pintarPuntsDesats(mapa, parcelaActual.puntsAltitud, parcelaActual.metodeAltitud);
  }

  pintarResum({
    minima: parcelaActual.altitudMinima,
    maxima: parcelaActual.altitudMaxima,
    desnivell: parcelaActual.desnivell,
    pendentMitja: parcelaActual.pendentMitja,
    // Si mai es va calcular amb el mètode de vèrtexs, aquest camp serà
    // null -- es mostra igualment (com "no calculada amb malla") en
    // lloc d'amagar la fila.
    orientacioMitjana: parcelaActual.orientacioMitjana ?? null,
  });
  contingutResum.insertAdjacentHTML(
    'afterbegin',
    `<p class="nota">${t('Valors ja desats d\'un càlcul anterior. Selecciona un mètode i prem "Calcular" per refer-los.')}</p>`
  );
}

/** Torna a pintar al mapa els punts d'un càlcul anterior, ja desats. */
function pintarPuntsDesats(mapa, punts, metode) {
  if (metode === 'vertexs') {
    mapa.afegirVertexsAmbAltitud(
      punts.map((p) => p.coordenades),
      punts.map((p) => p.altitud)
    );
  } else {
    mapa.afegirPuntsAmbOrientacio(
      punts.map((p) => ({
        ...p,
        etiqueta: p.orientacio == null ? null : t(ServeiOrientacio.etiquetaBruixola(p.orientacio)),
      }))
    );
  }
}

/**
 * Crea un mapa nou al contenidor, destruint primer l'anterior si n'hi
 * havia. Leaflet no permet inicialitzar dues vegades el mateix <div>
 * sense fer-ho -- necessari perquè es pugui recalcular (amb el mateix
 * mètode o canviant-lo) sense recarregar la pàgina.
 */
function crearMapa() {
  mapaActual?.leafletMap.remove();
  mapaActual = new Mapa('mapa-altitud');
  return mapaActual;
}

botoCalcular.addEventListener('click', async () => {
  const metode = document.querySelector('input[name="metode"]:checked').value;

  botoCalcular.disabled = true;
  resum.hidden = false;
  establirEstatResum('info');
  contingutResum.textContent = t('Calculant...');
  botoDesar.hidden = true;
  instruccioMapa.hidden = true;

  try {
    let calculat;
    if (metode === 'vertexs') {
      calculat = await calcularAmbVertexs();
      calculat = calculat !== false;
    } else {
      calculat = await calcularAmbMalla();
      calculat = calculat !== false;
    }

    if (!calculat) {
      // L'usuari ha cancel·lat l'avís de "massa punts" -- no és un
      // error, es torna a mostrar el que ja hi havia abans (desat o
      // "encara no calculat"), no es deixa la targeta buida.
      mostrarValorsDesats(mapaActual);
      return;
    }

    instruccioMapa.textContent = metode === 'vertexs'
      ? t('Toca un vèrtex del perímetre per veure la seva altitud.')
      : t('Toca un punt de la malla per veure la seva altitud i orientació.');
    aplicarEstatMissatge(instruccioMapa, 'info');
    instruccioMapa.hidden = false;
  } catch (error) {
    console.error(error);
    establirEstatResum('error');
    contingutResum.textContent = `${t('No s\'ha pogut calcular l\'altimetria:')} ${error.message}`;
  } finally {
    botoCalcular.disabled = false;
  }
});

async function calcularAmbVertexs() {
  const mapa = crearMapa();
  mapa.afegirParcela(parcelaActual);

  const altituds = await ServeiAltimetria.consultarAltituds(parcelaActual.coordenades);
  mapa.afegirVertexsAmbAltitud(parcelaActual.coordenades, altituds);
  mapa.ajustarVistaATotes();

  // orientacioMitjana no s'inclou (queda undefined): amb els vèrtexs no
  // hi ha prou estructura 2D per calcular-la, i el valor absent (en
  // lloc de null) indica a l'hora de desar que no s'ha de tocar el que
  // ja hi hagués desat abans.
  valorsCalculats = ServeiAltimetria.calcularResum(parcelaActual.coordenades, altituds);
  puntsCalculats = parcelaActual.coordenades.map((coordenades, i) => ({
    coordenades,
    altitud: altituds[i],
    orientacio: null,
  }));
  metodeCalculat = 'vertexs';
  pintarResum(valorsCalculats);
  botoDesar.hidden = false;
}

async function calcularAmbMalla() {
  const distanciaMetres = Number(campDistanciaMalla.value);
  if (!(distanciaMetres > 0)) {
    throw new Error(t('La distància entre punts ha de ser un número positiu'));
  }

  const malla = Malla.generar(parcelaActual.coordenades, distanciaMetres);
  const { coordenades, posicions } = Malla.puntsPerConsultar(malla);

  if (coordenades.length === 0) {
    throw new Error(t('Cap punt de la malla cau dins del perímetre; prova amb una distància més petita'));
  }
  // A partir d'un cert nombre de punts, la consulta pot trigar una mica
  // -- s'avisa i es deixa triar, en lloc de bloquejar-ho: forçar una
  // distància diferent només per quedar per sota d'un límit fixe donaria
  // precisions inconsistents entre parcel·les (10 m en una, 30 m en
  // una altra de més gran), cosa que no té sentit.
  if (coordenades.length > LLINDAR_AVIS_PUNTS) {
    const continuar = confirm(
      t('La malla generarà {n} punts; la consulta pot trigar una mica. Vols continuar?').replace(
        '{n}',
        coordenades.length
      )
    );
    if (!continuar) {
      return false;
    }
  }

  const altituds = await ServeiAltimetria.consultarAltituds(coordenades);

  // Es torna a col·locar cada altitud a la mateixa posició (fila, columna)
  // que el seu punt a la graella, per poder-hi buscar veïns després.
  const altitudsGraella = malla.graella.map((fila) => fila.map(() => null));
  posicions.forEach(([f, c], i) => {
    altitudsGraella[f][c] = altituds[i];
  });

  const mapa = crearMapa();
  mapa.afegirParcela(parcelaActual);

  const orientacionsPerPunt = ServeiOrientacio.calcularOrientacionsPerPunt(
    malla.graella,
    altitudsGraella,
    distanciaMetres
  );
  const orientacioPerPosicio = new Map(
    orientacionsPerPunt.map(({ fila, columna, orientacio }) => [`${fila},${columna}`, orientacio])
  );

  const puntsPerAlMapa = coordenades.map((coord, i) => {
    const [f, c] = posicions[i];
    const orientacio = orientacioPerPosicio.get(`${f},${c}`) ?? null;
    return {
      coordenades: coord,
      altitud: altituds[i],
      orientacio,
      etiqueta: orientacio == null ? null : t(ServeiOrientacio.etiquetaBruixola(orientacio)),
    };
  });
  mapa.afegirPuntsAmbOrientacio(puntsPerAlMapa);
  mapa.ajustarVistaATotes();

  const resumPendent = ServeiAltimetria.calcularResumMalla(
    malla.graella,
    altitudsGraella,
    distanciaMetres
  );
  const { orientacioMitjana } = ServeiOrientacio.calcularOrientacioMalla(
    malla.graella,
    altitudsGraella,
    distanciaMetres
  );

  valorsCalculats = { ...resumPendent, orientacioMitjana };
  puntsCalculats = puntsPerAlMapa.map(({ coordenades, altitud, orientacio }) => ({
    coordenades,
    altitud,
    orientacio,
  }));
  metodeCalculat = 'malla';
  pintarResum(valorsCalculats);
  botoDesar.hidden = false;
  return true;
}

function pintarResum({ minima, maxima, desnivell, pendentMitja, orientacioMitjana }) {
  const ajudaPendent = iconaAjuda(
    t('Inclinació mitjana del terreny, calculada a partir del model digital d\'elevacions de l\'IDEE (vèrtexs del perímetre o una malla de punts interiors).')
  );
  const ajudaOrientacio = iconaAjuda(
    t('Direcció cap on "mira" el pendent del terreny. Només es calcula amb el mètode de malla, no amb els vèrtexs del perímetre.')
  );

  const filaOrientacio =
    orientacioMitjana !== undefined
      ? `<dt>${t('Orientació mitjana')}${ajudaOrientacio}</dt><dd>${formatarOrientacio(orientacioMitjana)}</dd>`
      : '';

  establirEstatResum(null);
  contingutResum.innerHTML = `
    <dl class="fitxa-parcela">
      <dt>${t('Altitud mínima')}</dt><dd>${minima.toFixed(0)} m</dd>
      <dt>${t('Altitud màxima')}</dt><dd>${maxima.toFixed(0)} m</dd>
      <dt>${t('Desnivell')}</dt><dd>${desnivell.toFixed(0)} m</dd>
      <dt>${t('Pendent mitjà')}${ajudaPendent}</dt><dd>${pendentMitja.toFixed(1)} %</dd>
      ${filaOrientacio}
    </dl>
  `;
}

function formatarOrientacio(graus) {
  if (graus == null) return t('No calculada (terreny massa pla, o cal el mètode de malla)');
  return `${graus.toFixed(0)}° (${t(ServeiOrientacio.etiquetaBruixola(graus))})`;
}

botoDesar.addEventListener('click', async () => {
  if (!valorsCalculats) return;

  botoDesar.disabled = true;
  try {
    const parcelaActualitzada = new Parcela({
      ...parcelaActual,
      altitudMaxima: valorsCalculats.maxima,
      altitudMinima: valorsCalculats.minima,
      desnivell: valorsCalculats.desnivell,
      pendentMitja: valorsCalculats.pendentMitja,
      // Si aquest càlcul no ha tocat l'orientació (mètode de vèrtexs),
      // es manté la que ja hi hagués desada, en lloc de sobreescriure-la.
      orientacioMitjana:
        valorsCalculats.orientacioMitjana !== undefined
          ? valorsCalculats.orientacioMitjana
          : (parcelaActual.orientacioMitjana ?? null),
      puntsAltitud: puntsCalculats,
      metodeAltitud: metodeCalculat,
    });

    await bd.afegirParcela(parcelaActualitzada);

    missatgeEstat.textContent = t('Dades desades a la parcel·la.');
    missatgeEstat.className = 'missatge-estat missatge-estat--exit';
    missatgeEstat.hidden = false;
  } catch (error) {
    console.error(error);
    missatgeEstat.textContent = `${t('No s\'ha pogut desar:')} ${error.message}`;
    missatgeEstat.className = 'missatge-estat missatge-estat--error';
    missatgeEstat.hidden = false;
  } finally {
    botoDesar.disabled = false;
  }
});

iniciar().catch((error) => {
  console.error(error);
  resum.hidden = false;
  establirEstatResum('error');
  contingutResum.textContent = t('No s\'ha pogut carregar la parcel·la.');
});
