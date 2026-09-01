// Controlador de parceles.html: mapa + llistat.
import { BaseDades } from './serveis/basedades.js';
import { Mapa } from './ui/mapa.js';
import { ServeiRisc } from './serveis/risc.js';
import { t, aplicarTraduccions, inicialitzarSelectorIdioma } from './i18n.js';
import { inicialitzarMenu } from './ui/menu.js';

aplicarTraduccions();
inicialitzarSelectorIdioma('selector-idioma');
inicialitzarMenu();

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
    const { color, index } = await riscDeLaParcela(bd, parcela);

    mapa.afegirParcela(parcela, (p) => obrirDetall(p.id), color);

    const fila = document.createElement('tr');
    fila.className = 'fila-parcela';
    fila.dataset.id = parcela.id;
    fila.innerHTML = `
      <td>${parcela.poblacio}</td>
      <td>${parcela.poligon}</td>
      <td>${parcela.parcelaCadastral}</td>
      <td class="us">${parcela.us ?? '—'}</td>
      <td>${parcela.superficie ? `${parcela.superficie} m²` : '—'}</td>
      <td>
        ${
          index != null
            ? `
              <span class="taula-parceles__risc">
                <span class="taula-parceles__punt-risc" style="background-color: ${color};"></span>
                ${index.toFixed(0)} / 100
              </span>
            `
            : '—'
        }
      </td>
      <td><a href="detall.html?id=${encodeURIComponent(parcela.id)}" class="boto-taula">${t('Detall')}</a></td>
    `;
    // Tocar la fila la ressalta al mapa (per relacionar visualment
    // llistat i mapa); el botó "Detall" -- amb el seu propi clic, que
    // no interfereix amb el de la fila -- porta a la fitxa completa.
    fila.addEventListener('click', () => {
      mapa.ressaltarParcela(parcela.id);

      const anteriorSeleccionada = contenidorLlistat.querySelector('.fila-parcela--seleccionada');
      anteriorSeleccionada?.classList.remove('fila-parcela--seleccionada');
      fila.classList.add('fila-parcela--seleccionada');
    });
    fila.querySelector('.boto-taula').addEventListener('click', (event) => event.stopPropagation());
    contenidorLlistat.appendChild(fila);
  }

  mapa.ajustarVistaATotes();
}

/**
 * Neutre (sense índex) si encara no es pot calcular (falta el pendent
 * mitjà), o el color i l'índex reals si ja es pot.
 */
async function riscDeLaParcela(bd, parcela) {
  if (parcela.pendentMitja == null) {
    return { color: ServeiRisc.COLOR_NEUTRE, index: null };
  }

  const subparceles = await bd.llegirSubparcelesDe(parcela.id);
  const { indexPerillositat } = ServeiRisc.calcularRiscTotal({
    pendentMitja: parcela.pendentMitja,
    orientacioMitjana: parcela.orientacioMitjana,
    subparceles,
  });
  return { color: ServeiRisc.colorSegonsRisc(indexPerillositat), index: indexPerillositat };
}

function obrirDetall(id) {
  window.location.href = `detall.html?id=${encodeURIComponent(id)}`;
}

iniciar().catch((error) => {
  console.error(error);
  alert(t('No s\'han pogut carregar les parcel·les. Revisa la consola per a més detalls.'));
});
