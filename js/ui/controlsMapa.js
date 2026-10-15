// Controls de la vista del mapa a les pàgines de detall (parcel·la,
// geometria, agrupació), amb l'estil de Terra 3D: pestanyes 2D/3D
// flotants i, al panell, pestanyes per triar què es mostra.
//  - 2D (Leaflet): perímetre, altitud, pendent, ombres, orientació o
//    cotes, a partir dels punts d'altimetria ja desats (no es consulta
//    res). Pendent, ombres i orientació només amb el mètode de malla.
//  - 3D (Vista3D): ortofoto, altitud, pendent o maqueta, cotes i detall.
//    No depèn de l'altimetria desada: es genera del MDT al moment.
// Abans aquesta lògica era copiada a cada detall*.js.
import { t } from '../i18n.js';
import { ServeiOrientacio } from '../serveis/orientacio.js';
import { Vista3D } from './vista3d.js';
import { mostrarAvis } from './dialegs.js';

const CAPES_NOMES_MALLA = ['pendent', 'ombres', 'orientacio'];

/**
 * @param {object} opcions
 * @param {import('./mapa.js').Mapa} opcions.mapa
 * @param {Array<object>} opcions.entitats Parcel·les o geometries (per al 3D)
 * @param {Array<object>} opcions.punts Punts d'altimetria desats, amb pasLat/pasLng
 * @param {boolean} opcions.potFerMalla Si tots es van calcular amb el mètode de malla
 * @param {string} opcions.idMapa2d
 * @param {string} opcions.idMapa3d
 */
export function inicialitzarControlsMapa({ mapa, entitats, punts, potFerMalla, idMapa2d, idMapa3d }) {
  const contenidor2d = document.getElementById(idMapa2d);
  const contenidor3d = document.getElementById(idMapa3d);
  const boto2d = document.getElementById('boto-mapa-2d');
  const boto3d = document.getElementById('boto-mapa-3d');
  const controls2d = document.getElementById('controls-2d');
  const controls3d = document.getElementById('controls-3d');
  const pista2d = document.getElementById('pista-capes-2d');
  const pistaAntic = document.getElementById('pista-3d-antic');
  const carrega3d = document.getElementById('carrega-3d');
  const botoCotes = document.getElementById('boto-cotes-3d');

  document.getElementById('controls-mapa').hidden = false;

  // --- 2D ---
  const teAltimetria = punts.length > 0;
  controls2d.querySelectorAll('[data-capa2d]').forEach((boto) => {
    const capa = boto.dataset.capa2d;
    boto.hidden = capa !== 'cap' && (!teAltimetria || (CAPES_NOMES_MALLA.includes(capa) && !potFerMalla));
  });
  // Sense altimetria només hi hauria "Perímetre": no cal mostrar la
  // graella de capes, n'hi ha prou amb l'explicació.
  controls2d.querySelector('.pestanyes').hidden = !teAltimetria;
  pista2d.hidden = teAltimetria && potFerMalla;
  pista2d.textContent = teAltimetria
    ? t("Pendent, ombres i orientació necessiten l'altimetria calculada amb el mètode de malla.")
    : t("Calcula l'altimetria per veure-hi l'altitud, el pendent i les cotes.");

  function aplicarCapa2D(capa) {
    if (capa === 'altitud') mapa.afegirFiltreAltitud(punts);
    else if (capa === 'pendent') mapa.afegirFiltrePendent(punts);
    else if (capa === 'ombres') mapa.afegirFiltreOmbres(punts);
    else if (capa === 'cotes') mapa.afegirFiltreCotes(punts);
    else if (capa === 'orientacio') {
      mapa.afegirFiltreOrientacio(
        punts.map((p) => ({
          ...p,
          etiqueta: p.orientacio == null ? null : t(ServeiOrientacio.etiquetaBruixola(p.orientacio)),
        }))
      );
    } else mapa.netejarFiltre();
  }
  marcarGrup(controls2d, 'capa2d', 'cap', aplicarCapa2D);

  // --- 3D ---
  let vista3d = null;

  marcarGrup(controls3d.querySelector('#selector-capa-3d'), 'capa3d', 'ortofoto', (capa) => vista3d?.aplicarCapa(capa));
  marcarGrup(controls3d.querySelector('#selector-detall-3d'), 'detall3d', 'mitja', async (detall) => {
    if (!vista3d) return;
    carrega3d.hidden = false;
    try {
      await vista3d.canviarDetall(detall);
    } catch (error) {
      console.error(error);
      mostrarAvis(t("No s'ha pogut generar el model 3D."), { tipus: 'error' });
    } finally {
      carrega3d.hidden = true;
    }
  });
  botoCotes.addEventListener('click', () => {
    const actiu = botoCotes.getAttribute('aria-pressed') !== 'true';
    botoCotes.setAttribute('aria-pressed', String(actiu));
    vista3d?.mostrarCotes(actiu);
  });

  function marcarVista(vista) {
    boto2d.setAttribute('aria-selected', String(vista === '2d'));
    boto3d.setAttribute('aria-selected', String(vista === '3d'));
    controls2d.hidden = vista !== '2d';
    controls3d.hidden = vista !== '3d';
    contenidor2d.hidden = vista !== '2d';
    contenidor3d.hidden = vista !== '3d';
  }

  async function activar3D() {
    marcarVista('3d');
    carrega3d.hidden = false;
    vista3d = new Vista3D(idMapa3d);
    vista3d.estat = {
      capa: valorActiu(controls3d, 'capa3d') ?? 'ortofoto',
      detall: valorActiu(controls3d, 'detall3d') ?? 'mitja',
      cotes: botoCotes.getAttribute('aria-pressed') === 'true',
    };
    try {
      const mode = await vista3d.mostrar(entitats);
      // El visor antic no té ortofoto ni nivells de detall.
      pistaAntic.hidden = mode !== 'antic';
      controls3d.querySelector('#selector-detall-3d').closest('.camp').hidden = mode === 'antic';
    } catch (error) {
      console.error(error);
      mostrarAvis(
        t("No s'ha pogut generar el model 3D: cal connexió (o l'altimetria calculada amb el mètode de malla)."),
        { tipus: 'error', durada: 7000 }
      );
      activar2D();
    } finally {
      carrega3d.hidden = true;
    }
  }

  function activar2D() {
    vista3d?.destruir();
    vista3d = null;
    marcarVista('2d');
    // Leaflet s'ha quedat amb mida 0 mentre era amagat -- cal avisar-lo
    // que ara sí que té espai real, o es queda mig en blanc.
    mapa.leafletMap.invalidateSize();
  }

  boto2d.addEventListener('click', () => {
    if (boto2d.getAttribute('aria-selected') !== 'true') activar2D();
  });
  boto3d.addEventListener('click', () => {
    if (boto3d.getAttribute('aria-selected') !== 'true') activar3D();
  });
}

/** Pestanyes [data-<atribut>] dins del contenidor: una d'activa alhora. */
function marcarGrup(contenidor, atribut, inicial, onCanvi) {
  const botons = Array.from(contenidor.querySelectorAll(`[data-${atribut}]`));
  const clau = atribut.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  const marcar = (valor) => botons.forEach((b) => b.setAttribute('aria-selected', String(b.dataset[clau] === valor)));
  marcar(inicial);
  botons.forEach((boto) =>
    boto.addEventListener('click', () => {
      if (boto.getAttribute('aria-selected') === 'true') return;
      marcar(boto.dataset[clau]);
      onCanvi(boto.dataset[clau]);
    })
  );
}

function valorActiu(contenidor, atribut) {
  const clau = atribut.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  return contenidor.querySelector(`[data-${atribut}][aria-selected="true"]`)?.dataset[clau] ?? null;
}
