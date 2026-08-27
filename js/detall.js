// Controlador de detall.html. L'id arriba per URL: detall.html?id=123
import { BaseDades } from './serveis/basedades.js';
import { Mapa } from './ui/mapa.js';
import { ExportadorGpx } from './serveis/exportadorGpx.js';
import { ServeiOrientacio } from './serveis/orientacio.js';
import { ServeiRisc } from './serveis/risc.js';

const contenidorDades = document.getElementById('contingut-dades-parcela');
const seccioSubparceles = document.getElementById('seccio-subparceles');
const llistatSubparceles = document.getElementById('llistat-subparceles');
const seccioRiscCalculat = document.getElementById('seccio-risc-calculat');
const contingutRiscCalculat = document.getElementById('contingut-risc-calculat');
const seccioAccions = document.getElementById('accions-parcela');
const botoExportarGpx = document.getElementById('boto-exportar-gpx');
const botoEsborrar = document.getElementById('boto-esborrar');

let bd;
let parcelaActual;

async function iniciar() {
  const parametres = new URLSearchParams(window.location.search);
  const id = parametres.get('id');

  if (!id) {
    contenidorDades.textContent = 'No s\'ha indicat cap parcel·la.';
    return;
  }

  bd = await BaseDades.obrir();
  parcelaActual = await bd.llegirParcela(id);

  if (!parcelaActual) {
    contenidorDades.textContent = 'No s\'ha trobat aquesta parcel·la.';
    return;
  }

  document.title = `Custòdia — ${parcelaActual.poblacio}`;
  pintarFitxa(parcelaActual);

  // Es llegeixen un sol cop i es reutilitzen tant per al llistat com
  // per al càlcul de risc, en lloc de tornar-les a consultar dues vegades.
  const subparceles = await bd.llegirSubparcelesDe(parcelaActual.id);
  pintarSubparceles(subparceles);
  const color = pintarRisc(subparceles);

  const mapa = new Mapa('mapa-detall');
  mapa.afegirParcela(parcelaActual, null, color);
  mapa.ajustarVistaATotes();

  seccioAccions.hidden = false;
}

function pintarSubparceles(subparceles) {
  if (subparceles.length === 0) return;

  llistatSubparceles.innerHTML = subparceles
    .map(
      (s) => `
        <tr>
          <td>${s.dcc ?? '—'}</td>
          <td>${s.ssp ? `${s.ssp} m²` : '—'}</td>
          <td>${(ServeiRisc.classificarSubparcela(s.dcc) * 100).toFixed(0)} / 100</td>
          <td>${s.ip ?? '—'}</td>
          <td>${s.ccc ?? '—'}</td>
        </tr>
      `
    )
    .join('');
  seccioSubparceles.hidden = false;
}

/**
 * A diferència de l'altimetria, aquest càlcul no consulta cap servei
 * extern (només combina dades ja desades: pendent, orientació,
 * subparceles), així que es fa a l'instant cada vegada, sense
 * necessitat de "Calcular" ni de desar-ho enlloc.
 *
 * @returns {string} El color (segons el risc, o neutre si encara no es
 *   pot calcular) per pintar la parcel·la al mapa.
 */
function pintarRisc(subparceles) {
  seccioRiscCalculat.hidden = false;

  if (parcelaActual.pendentMitja == null) {
    contingutRiscCalculat.innerHTML = `
      <p>
        Cal calcular primer el pendent mitjà
        (<a href="altitud.html?id=${encodeURIComponent(parcelaActual.id)}">calcular-ho</a>).
      </p>
    `;
    return ServeiRisc.COLOR_NEUTRE;
  }

  const { indexPerillositat, riscVegetacio, riscPendent, riscOrientacio } =
    ServeiRisc.calcularRiscTotal({
      pendentMitja: parcelaActual.pendentMitja,
      orientacioMitjana: parcelaActual.orientacioMitjana,
      subparceles,
    });

  contingutRiscCalculat.innerHTML = `
    <dl class="fitxa-parcela">
      <dt>Índex de perillositat</dt><dd><strong>${indexPerillositat.toFixed(0)} / 100</strong></dd>
      <dt>Component vegetació</dt><dd>${riscVegetacio != null ? `${(riscVegetacio * 100).toFixed(0)} / 100` : 'No disponible (sense subparceles)'}</dd>
      <dt>Component pendent</dt><dd>${(riscPendent * 100).toFixed(0)} / 100</dd>
      <dt>Component orientació</dt><dd>${riscOrientacio != null ? `${(riscOrientacio * 100).toFixed(0)} / 100` : 'No disponible (cal el mètode de malla)'}</dd>
    </dl>
    <p class="nota">
      Model propi, no un estàndard oficial — pensat per ajustar-lo amb l'ús real.
      És un índex per <strong>comparar parcel·les entre elles</strong> segons el
      mateix criteri, no una probabilitat ni una freqüència d'incendis: un 62
      no vol dir "62% de possibilitats de cremar-se", ni "es crema 6 anys de cada 10".
    </p>
  `;

  return ServeiRisc.colorSegonsRisc(indexPerillositat);
}

function pintarFitxa(parcela) {
  // Les dades d'altimetria es calculen a part (pàgina altitud.html) i es
  // desen a la parcel·la; aquí només es mostren si ja hi són, o un
  // enllaç per calcular-les si encara no.
  const filaAltimetria = parcela.pendentMitja != null
    ? `
      <dt>Pendent mitjà</dt>
      <dd>
        ${parcela.pendentMitja.toFixed(1)} %
        (<a href="altitud.html?id=${encodeURIComponent(parcela.id)}">Calcular de nou</a>)
      </dd>
    `
    : `
      <dt>Pendent mitjà</dt>
      <dd><a href="altitud.html?id=${encodeURIComponent(parcela.id)}">Calcular-ho</a></dd>
    `;

  const filaOrientacio = parcela.orientacioMitjana != null
    ? `
      <dt>Orientació mitjana</dt>
      <dd>
        ${parcela.orientacioMitjana.toFixed(0)}° (${ServeiOrientacio.etiquetaBruixola(parcela.orientacioMitjana)})
        (<a href="altitud.html?id=${encodeURIComponent(parcela.id)}">Calcular de nou</a>)
      </dd>
    `
    : `
      <dt>Orientació mitjana</dt>
      <dd><a href="altitud.html?id=${encodeURIComponent(parcela.id)}">Calcular-ho (mètode de malla)</a></dd>
    `;

  const filaData = parcela.dataCreacio != null
    ? `<dt>Dades consultades el</dt><dd>${new Date(parcela.dataCreacio).toLocaleDateString('ca-ES')}</dd>`
    : '';

  contenidorDades.innerHTML = `
    <dl class="fitxa-parcela">
      <dt>Població</dt><dd>${parcela.poblacio}</dd>
      <dt>Polígon</dt><dd>${parcela.poligon}</dd>
      <dt>Parcel·la</dt><dd>${parcela.parcelaCadastral}</dd>
      <dt>Referència cadastral</dt><dd>${parcela.referenciaCadastral ?? '—'}</dd>
      <dt>Superfície</dt><dd>${parcela.superficie ? `${parcela.superficie} m²` : '—'}</dd>
      <dt>Ús (segons el Cadastre)</dt><dd>${parcela.us ?? 'No disponible'}</dd>
      ${filaAltimetria}
      ${filaOrientacio}
      ${filaData}
    </dl>
  `;
}

botoExportarGpx.addEventListener('click', () => {
  ExportadorGpx.descarregar(parcelaActual);
});

botoEsborrar.addEventListener('click', async () => {
  const confirmat = confirm(
    `Segur que vols esborrar la parcel·la de ${parcelaActual.poblacio}? Aquesta acció no es pot desfer.`
  );
  if (!confirmat) return;

  await bd.esborrarSubparcelesDe(parcelaActual.id);
  await bd.esborrarParcela(parcelaActual.id);
  window.location.href = 'index.html';
});

iniciar().catch((error) => {
  console.error(error);
  alert('No s\'ha pogut carregar el detall de la parcel·la.');
});
