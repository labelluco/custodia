// Controlador de detall.html. L'id arriba per URL: detall.html?id=123
import { BaseDades } from './serveis/basedades.js';
import { Mapa } from './ui/mapa.js';
import { Parcela } from './model/parcela.js';

const contenidorDades = document.getElementById('dades-parcela');
const seccioAccions = document.getElementById('accions-parcela');
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

  const mapa = new Mapa('mapa-detall');
  mapa.afegirParcela(parcelaActual);
  mapa.ajustarVistaATotes();

  seccioAccions.hidden = false;
}

function pintarFitxa(parcela) {
  contenidorDades.innerHTML = `
    <dl class="fitxa-parcela">
      <dt>Població</dt><dd>${parcela.poblacio}</dd>
      <dt>Polígon</dt><dd>${parcela.poligon}</dd>
      <dt>Parcel·la</dt><dd>${parcela.parcelaCadastral}</dd>
      <dt>Referència cadastral</dt><dd>${parcela.referenciaCadastral ?? '—'}</dd>
      <dt>Superfície</dt><dd>${parcela.superficie ? `${parcela.superficie} m²` : '—'}</dd>
      <dt>Ús</dt><dd>${parcela.us}</dd>
      <dt>Risc d'incendi</dt><dd class="risc-${parcela.risc}">${parcela.risc}</dd>
    </dl>
  `;
}

botoEditar.addEventListener('click', () => {
  formEditar.elements.us.value = parcelaActual.us;
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
    us: formEditar.elements.us.value,
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

  await bd.esborrarParcela(parcelaActual.id);
  window.location.href = 'index.html';
});

iniciar().catch((error) => {
  console.error(error);
  alert('No s\'ha pogut carregar el detall de la parcel·la.');
});
