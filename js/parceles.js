// Controlador de parceles.html: mapa + llistat.
import { BaseDades } from './serveis/basedades.js';
import { Mapa } from './ui/mapa.js';
import { ServeiRisc } from './serveis/risc.js';
import { inicialitzarOrdenacio } from './ui/taula-ordenable.js';
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
  const capcalera = document.getElementById('capcalera-parceles');

  const parceles = await bd.llegirTotesLesParceles();

  if (parceles.length === 0) {
    missatgeBuit.hidden = false;
    return;
  }
  missatgeBuit.hidden = true;

  // Es calcula el color/índex de risc un sol cop per cada parcel·la, i
  // es guarda junt amb la resta de dades -- necessari per poder
  // reordenar-les sense haver de tornar a calcular-ho cada vegada que
  // es clica una capçalera.
  const files = [];
  for (const parcela of parceles) {
    const { color, index } = await ServeiRisc.colorIIndexDe(bd, parcela);
    mapa.afegirParcela(parcela, (p) => obrirDetall(p.id), color);
    files.push({ parcela, color, index });
  }
  mapa.ajustarVistaATotes();

  const pintar = () => pintarFiles(contenidorLlistat, files, mapa);

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

  pintar();
}

/** Pinta les files en l'ordre actual de "files" -- es crida de nou cada vegada que es reordena. */
function pintarFiles(contenidorLlistat, files, mapa) {
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
