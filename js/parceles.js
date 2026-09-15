// Controlador de parceles.html: mapa + llistat, amb cerca i ordenació.
import { BaseDades } from './serveis/basedades.js';
import { Mapa } from './ui/mapa.js';
import { ServeiRisc } from './serveis/risc.js';
import { inicialitzarOrdenacio } from './ui/taula-ordenable.js';
import { t, aplicarTraduccions, inicialitzarSelectorIdioma } from './i18n.js';
import { inicialitzarMenu } from './ui/menu.js';

aplicarTraduccions();
inicialitzarSelectorIdioma('selector-idioma');
inicialitzarMenu();

let termeCerca = '';

async function iniciar() {
  const bd = await BaseDades.obrir();
  const mapa = new Mapa('mapa');
  const contenidorLlistat = document.getElementById('llistat-parceles');
  const missatgeBuit = document.getElementById('missatge-buit');
  const missatgeSenseResultats = document.getElementById('missatge-sense-resultats');
  const campCerca = document.getElementById('cerca-parceles');
  const capcalera = document.getElementById('capcalera-parceles');

  const parceles = await bd.llegirTotesLesParceles();

  if (parceles.length === 0) {
    missatgeBuit.hidden = false;
    return;
  }
  missatgeBuit.hidden = true;

  // Es calcula el color/índex de risc un sol cop per cada parcel·la, i
  // es guarda junt amb la resta de dades -- necessari per poder
  // reordenar-les i filtrar-les sense haver de tornar a calcular-ho
  // cada vegada.
  const files = [];
  for (const parcela of parceles) {
    const { color, index } = await ServeiRisc.colorIIndexDe(bd, parcela);
    files.push({ parcela, color, index });
  }

  /** Cert si la fila coincideix amb el terme de cerca actual (o si no hi ha cap cerca). */
  function coincideix(fila) {
    if (!termeCerca) return true;
    const { parcela } = fila;
    const text = [parcela.poblacio, parcela.poligon, parcela.parcelaCadastral, parcela.us]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return text.includes(termeCerca);
  }

  /**
   * Pinta mapa i taula junts, a partir de l'ordre actual de "files" i
   * del terme de cerca vigent -- es crida de nou en reordenar o en
   * escriure a la cerca.
   */
  function pintar() {
    const filesVisibles = files.filter(coincideix);
    missatgeSenseResultats.hidden = filesVisibles.length > 0;

    mapa.buidar();
    for (const { parcela, color } of filesVisibles) {
      mapa.afegirParcela(parcela, (p) => obrirDetall(p.id), color);
    }
    if (filesVisibles.length > 0) {
      mapa.ajustarVistaATotes();
    }

    pintarFilesTaula(contenidorLlistat, filesVisibles, mapa);
  }

  inicialitzarOrdenacio(
    capcalera,
    files,
    {
      poblacio: (f) => f.parcela.poblacio,
      poligon: (f) => f.parcela.poligon,
      parcela: (f) => f.parcela.parcelaCadastral,
      us: (f) => f.parcela.us,
      superficie: (f) => f.parcela.superficie,
      risc: (f) => f.index,
    },
    pintar
  );

  campCerca.addEventListener('input', () => {
    termeCerca = campCerca.value.trim().toLowerCase();
    pintar();
  });

  pintar();
}

/** Pinta les files de la taula (no el mapa) en l'ordre i filtre actuals. */
function pintarFilesTaula(contenidorLlistat, files, mapa) {
  contenidorLlistat.innerHTML = '';

  for (const { parcela, color, index } of files) {
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
}

function obrirDetall(id) {
  window.location.href = `detall.html?id=${encodeURIComponent(id)}`;
}

iniciar().catch((error) => {
  console.error(error);
  alert(t('No s\'han pogut carregar les parcel·les. Revisa la consola per a més detalls.'));
});
