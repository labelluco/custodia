// Controlador de geometries.html: mapa + llistat, igual que
// parceles.js però amb geometries (sense dades cadastrals: només nom
// i risc, sense polígon/parcela/ús/superfície).
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
  const mapaSeccio = document.getElementById('mapa');
  const contenidorLlistat = document.getElementById('llistat-geometries');
  const missatgeBuit = document.getElementById('missatge-buit');
  const capcalera = document.getElementById('capcalera-geometries');

  const geometries = await bd.llegirTotesLesGeometries();

  if (geometries.length === 0) {
    missatgeBuit.hidden = false;
    return;
  }
  missatgeBuit.hidden = true;
  mapaSeccio.hidden = false;

  const mapa = new Mapa('mapa');

  const files = [];
  for (const geometria of geometries) {
    // Reutilitzat tal qual de ServeiRisc: encara que és pensat per a
    // parcel·les, funciona igual per a geometries (bd.llegirSubparcelesDe
    // hi retorna una llista buida, i el càlcul de risc ja sap
    // redistribuir els pesos quan falta la vegetació).
    const { color, index } = await ServeiRisc.colorIIndexDe(bd, geometria);
    mapa.afegirParcela(geometria, (g) => obrirDetall(g.id), color);
    files.push({ geometria, color, index });
  }
  mapa.ajustarVistaATotes();

  const pintar = () => pintarFiles(contenidorLlistat, files, mapa);

  inicialitzarOrdenacio(
    capcalera,
    files,
    {
      nom: (f) => f.geometria.nom,
      risc: (f) => f.index,
    },
    pintar
  );

  pintar();
}

/** Pinta les files en l'ordre actual de "files" -- es crida de nou cada vegada que es reordena. */
function pintarFiles(contenidorLlistat, files, mapa) {
  contenidorLlistat.innerHTML = '';

  for (const { geometria, color, index } of files) {
    const fila = document.createElement('tr');
    fila.className = 'fila-parcela';
    fila.dataset.id = geometria.id;
    fila.innerHTML = `
      <td>${geometria.nom}</td>
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
      <td><a href="detall-geometria.html?id=${encodeURIComponent(geometria.id)}" class="boto-taula">${t('Detall')}</a></td>
    `;
    fila.addEventListener('click', () => {
      mapa.ressaltarParcela(geometria.id);

      const anteriorSeleccionada = contenidorLlistat.querySelector('.fila-parcela--seleccionada');
      anteriorSeleccionada?.classList.remove('fila-parcela--seleccionada');
      fila.classList.add('fila-parcela--seleccionada');
    });
    fila.querySelector('.boto-taula').addEventListener('click', (event) => event.stopPropagation());
    contenidorLlistat.appendChild(fila);
  }
}

function obrirDetall(id) {
  window.location.href = `detall-geometria.html?id=${encodeURIComponent(id)}`;
}

iniciar().catch((error) => {
  console.error(error);
  alert(t('No s\'han pogut carregar les geometries. Revisa la consola per a més detalls.'));
});
