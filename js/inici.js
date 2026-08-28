// Controlador de index.html: mapa + llistat.
import { BaseDades } from './serveis/basedades.js';
import { Mapa } from './ui/mapa.js';
import { ServeiRisc } from './serveis/risc.js';
import { t, aplicarTraduccions, inicialitzarSelectorIdioma } from './i18n.js';

aplicarTraduccions();
inicialitzarSelectorIdioma('selector-idioma');

async function iniciar() {
  const bd = await BaseDades.obrir();
  const mapa = new Mapa('mapa');
  const contenidorLlistat = document.getElementById('llistat-parceles');
  const missatgeBuit = document.getElementById('missatge-buit');

  const parceles = await bd.llegirTotesLesParceles();

  if (parceles.length === 0) {
    missatgeBuit.hidden = false;
    return;
  }
  missatgeBuit.hidden = true;

  contenidorLlistat.innerHTML = '';

  for (const parcela of parceles) {
    const color = await colorDeLaParcela(bd, parcela);

    mapa.afegirParcela(parcela, (p) => obrirDetall(p.id), color);

    const fila = document.createElement('tr');
    fila.className = 'fila-parcela';
    fila.style.borderLeftColor = color;
    fila.dataset.id = parcela.id;
    fila.innerHTML = `
      <td>${parcela.poblacio}</td>
      <td>${parcela.poligon}</td>
      <td>${parcela.parcelaCadastral}</td>
      <td class="us">${parcela.us ?? '—'}</td>
    `;
    // Tocar el llistat ressalta la parcel·la al mapa (no obre el detall);
    // per al detall, cal tocar la parcel·la pintada al mapa.
    fila.addEventListener('click', () => {
      mapa.ressaltarParcela(parcela.id);

      const anteriorSeleccionada = contenidorLlistat.querySelector('.fila-parcela--seleccionada');
      anteriorSeleccionada?.classList.remove('fila-parcela--seleccionada');
      fila.classList.add('fila-parcela--seleccionada');
    });
    contenidorLlistat.appendChild(fila);
  }

  mapa.ajustarVistaATotes();
}

/**
 * Neutre si encara no es pot calcular (falta el pendent mitjà), o el
 * color segons el percentatge de risc si ja es pot.
 */
async function colorDeLaParcela(bd, parcela) {
  if (parcela.pendentMitja == null) {
    return ServeiRisc.COLOR_NEUTRE;
  }

  const subparceles = await bd.llegirSubparcelesDe(parcela.id);
  const { indexPerillositat } = ServeiRisc.calcularRiscTotal({
    pendentMitja: parcela.pendentMitja,
    orientacioMitjana: parcela.orientacioMitjana,
    subparceles,
  });
  return ServeiRisc.colorSegonsRisc(indexPerillositat);
}

function obrirDetall(id) {
  window.location.href = `detall.html?id=${encodeURIComponent(id)}`;
}

iniciar().catch((error) => {
  console.error(error);
  alert(t('No s\'han pogut carregar les parcel·les. Revisa la consola per a més detalls.'));
});
