// Controlador de detall.html. L'id arriba per URL: detall.html?id=123
import { BaseDades } from './serveis/basedades.js';
import { Mapa } from './ui/mapa.js';
import { Parcela } from './model/parcela.js';
import { ExportadorGpx } from './serveis/exportadorGpx.js';
import { ServeiOrientacio } from './serveis/orientacio.js';

const contenidorDades = document.getElementById('dades-parcela');
const seccioSubparceles = document.getElementById('seccio-subparceles');
const llistatSubparceles = document.getElementById('llistat-subparceles');
const seccioAccions = document.getElementById('accions-parcela');
const botoExportarGpx = document.getElementById('boto-exportar-gpx');
const botoEditar = document.getElementById('boto-editar');
const botoEsborrar = document.getElementById('boto-esborrar');
const formEditar = document.getElementById('form-editar');
const botoCancelarEditar = document.getElementById('boto-cancelar-editar');

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
  pintarSubparceles();

  const mapa = new Mapa('mapa-detall');
  mapa.afegirParcela(parcelaActual);
  mapa.ajustarVistaATotes();

  seccioAccions.hidden = false;
}

async function pintarSubparceles() {
  const subparceles = await bd.llegirSubparcelesDe(parcelaActual.id);
  if (subparceles.length === 0) return;

  llistatSubparceles.innerHTML = subparceles
    .map(
      (s) => `
        <tr>
          <td>${s.dcc ?? '—'}</td>
          <td>${s.ssp ? `${s.ssp} m²` : '—'}</td>
          <td>${s.ip ?? '—'}</td>
          <td>${s.ccc ?? '—'}</td>
        </tr>
      `
    )
    .join('');
  seccioSubparceles.hidden = false;
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

  const filaVegetacio = parcela.tipusVegetacio != null
    ? `<dt>Tipus de vegetació (MFE)</dt><dd>${parcela.tipusVegetacio}</dd>`
    : '';

  contenidorDades.innerHTML = `
    <dl class="fitxa-parcela">
      <dt>Població</dt><dd>${parcela.poblacio}</dd>
      <dt>Polígon</dt><dd>${parcela.poligon}</dd>
      <dt>Parcel·la</dt><dd>${parcela.parcelaCadastral}</dd>
      <dt>Referència cadastral</dt><dd>${parcela.referenciaCadastral ?? '—'}</dd>
      <dt>Superfície</dt><dd>${parcela.superficie ? `${parcela.superficie} m²` : '—'}</dd>
      <dt>Ús (segons el Cadastre)</dt><dd>${parcela.us ?? 'No disponible'}</dd>
      ${filaVegetacio}
      <dt>Risc d'incendi</dt><dd class="risc-${parcela.risc}">${parcela.risc}</dd>
      ${filaAltimetria}
      ${filaOrientacio}
    </dl>
  `;
}

botoExportarGpx.addEventListener('click', () => {
  ExportadorGpx.descarregar(parcelaActual);
});

botoEditar.addEventListener('click', () => {
  formEditar.elements.risc.value = parcelaActual.risc;
  formEditar.hidden = false;
  seccioAccions.hidden = true;
});

botoCancelarEditar.addEventListener('click', () => {
  formEditar.hidden = true;
  seccioAccions.hidden = false;
});

formEditar.addEventListener('submit', async (event) => {
  event.preventDefault();

  const parcelaActualitzada = new Parcela({
    ...parcelaActual,
    risc: formEditar.elements.risc.value,
  });

  await bd.afegirParcela(parcelaActualitzada);

  parcelaActual = parcelaActualitzada.toObject();
  pintarFitxa(parcelaActual);
  formEditar.hidden = true;
  seccioAccions.hidden = false;
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
