// Controlador d'altitud.html. Calcula i permet desar l'altitud
// màxima/mínima, el desnivell i el pendent mitjà d'una parcel·la,
// amb dos mètodes possibles: vèrtexs del perímetre, o una malla de
// punts interiors. L'id arriba per URL: altitud.html?id=123
import { BaseDades } from './serveis/basedades.js';
import { Mapa } from './ui/mapa.js';
import { Parcela } from './model/parcela.js';
import { ServeiAltimetria } from './serveis/altimetria.js';
import { Malla } from './geometria/malla.js';

// Límit de punts per consultar en una sola crida a l'API, per evitar
// generar peticions desproporcionades si algú tria una distància molt
// petita en una parcel·la gran.
const MAXIM_PUNTS_MALLA = 400;

const seccioMapa = document.getElementById('mapa-altitud');
const instruccioMapa = document.getElementById('instruccio-mapa');
const resum = document.getElementById('resum-altimetria');
const botoCalcular = document.getElementById('boto-calcular');
const botoDesar = document.getElementById('boto-desar-altimetria');
const missatgeEstat = document.getElementById('missatge-estat');
const campDistanciaMalla = document.getElementById('distancia-malla');

let bd;
let parcelaActual;
let valorsCalculats = null;
let mapaActual = null;

async function iniciar() {
  const parametres = new URLSearchParams(window.location.search);
  const id = parametres.get('id');

  if (!id) {
    resum.hidden = false;
    resum.textContent = 'No s\'ha indicat cap parcel·la.';
    return;
  }

  bd = await BaseDades.obrir();
  parcelaActual = await bd.llegirParcela(id);

  if (!parcelaActual) {
    resum.hidden = false;
    resum.textContent = 'No s\'ha trobat aquesta parcel·la.';
    return;
  }

  document.title = `Custòdia — Altitud (${parcelaActual.poblacio})`;
  document.getElementById('enllac-tornar').innerHTML =
    `<a href="detall.html?id=${encodeURIComponent(id)}">&larr; Tornar al detall</a>`;

  mostrarValorsDesats();
}

/**
 * Si la parcel·la ja té valors d'altimetria desats (d'un càlcul
 * anterior), es mostren de seguida, sense haver de tornar a calcular-los
 * (ni tornar a gastar cap crida al servei extern). Si mai es prem
 * "Calcular", el resultat nou els substitueix igualment.
 */
function mostrarValorsDesats() {
  const jaCalculat =
    parcelaActual.altitudMaxima != null &&
    parcelaActual.altitudMinima != null &&
    parcelaActual.desnivell != null &&
    parcelaActual.pendentMitja != null;

  resum.hidden = false;

  if (!jaCalculat) {
    resum.textContent = 'Encara no s\'ha calculat l\'altimetria d\'aquesta parcel·la.';
    return;
  }

  pintarResum({
    minima: parcelaActual.altitudMinima,
    maxima: parcelaActual.altitudMaxima,
    desnivell: parcelaActual.desnivell,
    pendentMitja: parcelaActual.pendentMitja,
  });
  resum.insertAdjacentHTML(
    'afterbegin',
    '<p class="nota">Valors ja desats d\'un càlcul anterior. Selecciona un mètode i prem "Calcular" per refer-los.</p>'
  );
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
  seccioMapa.hidden = false;
  resum.hidden = false;
  resum.textContent = 'Calculant...';
  botoDesar.hidden = true;
  instruccioMapa.hidden = true;

  try {
    if (metode === 'vertexs') {
      await calcularAmbVertexs();
      instruccioMapa.textContent = 'Toca un vèrtex del perímetre per veure la seva altitud.';
    } else {
      await calcularAmbMalla();
      instruccioMapa.textContent = 'Toca un punt de la malla per veure la seva altitud.';
    }
    instruccioMapa.hidden = false;
  } catch (error) {
    console.error(error);
    resum.textContent = `No s'ha pogut calcular l'altimetria: ${error.message}`;
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

  valorsCalculats = ServeiAltimetria.calcularResum(parcelaActual.coordenades, altituds);
  pintarResum(valorsCalculats);
  botoDesar.hidden = false;
}

async function calcularAmbMalla() {
  const distanciaMetres = Number(campDistanciaMalla.value);
  if (!(distanciaMetres > 0)) {
    throw new Error('La distància entre punts ha de ser un número positiu');
  }

  const malla = Malla.generar(parcelaActual.coordenades, distanciaMetres);
  const { coordenades, posicions } = Malla.puntsPerConsultar(malla);

  if (coordenades.length === 0) {
    throw new Error('Cap punt de la malla cau dins del perímetre; prova amb una distància més petita');
  }
  if (coordenades.length > MAXIM_PUNTS_MALLA) {
    throw new Error(
      `La malla generaria ${coordenades.length} punts (màxim ${MAXIM_PUNTS_MALLA}); tria una distància més gran`
    );
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
  mapa.afegirVertexsAmbAltitud(coordenades, altituds);
  mapa.ajustarVistaATotes();

  valorsCalculats = ServeiAltimetria.calcularResumMalla(
    malla.graella,
    altitudsGraella,
    distanciaMetres
  );
  pintarResum(valorsCalculats);
  botoDesar.hidden = false;
}

function pintarResum({ minima, maxima, desnivell, pendentMitja }) {
  resum.innerHTML = `
    <dl class="fitxa-parcela">
      <dt>Altitud mínima</dt><dd>${minima.toFixed(0)} m</dd>
      <dt>Altitud màxima</dt><dd>${maxima.toFixed(0)} m</dd>
      <dt>Desnivell</dt><dd>${desnivell.toFixed(0)} m</dd>
      <dt>Pendent mitjà</dt><dd>${pendentMitja.toFixed(1)} %</dd>
    </dl>
  `;
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
    });

    await bd.afegirParcela(parcelaActualitzada);

    missatgeEstat.textContent = 'Dades desades a la parcel·la.';
    missatgeEstat.className = 'missatge-estat missatge-estat--exit';
    missatgeEstat.hidden = false;
  } catch (error) {
    console.error(error);
    missatgeEstat.textContent = `No s'ha pogut desar: ${error.message}`;
    missatgeEstat.className = 'missatge-estat missatge-estat--error';
    missatgeEstat.hidden = false;
  } finally {
    botoDesar.disabled = false;
  }
});

iniciar().catch((error) => {
  console.error(error);
  resum.hidden = false;
  resum.textContent = 'No s\'ha pogut carregar la parcel·la.';
});
