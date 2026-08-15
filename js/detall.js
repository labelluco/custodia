// Controlador de detall.html. L'id arriba per URL: detall.html?id=123
import { BaseDades } from './serveis/basedades.js';
import { Mapa } from './ui/mapa.js';

async function iniciar() {
  const parametres = new URLSearchParams(window.location.search);
  const id = parametres.get('id');

  const contenidorDades = document.getElementById('dades-parcela');

  if (!id) {
    contenidorDades.textContent = 'No s\'ha indicat cap parcel·la.';
    return;
  }

  const bd = await BaseDades.obrir();
  const parcela = await bd.llegirParcela(id);

  if (!parcela) {
    contenidorDades.textContent = 'No s\'ha trobat aquesta parcel·la.';
    return;
  }

  document.title = `Custòdia — ${parcela.poblacio}`;

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

  const mapa = new Mapa('mapa-detall');
  mapa.afegirParcela(parcela);
  mapa.ajustarVistaATotes();
}

iniciar().catch((error) => {
  console.error(error);
  alert('No s\'ha pogut carregar el detall de la parcel·la.');
});
