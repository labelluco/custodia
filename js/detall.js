// Controlador de detall.html. L'id arriba per URL: detall.html?id=123
import { BaseDades } from './serveis/basedades.js';
import { Mapa } from './ui/mapa.js';
import { Mapa3D } from './ui/mapa3d.js';
import { ExportadorGpx } from './serveis/exportadorGpx.js';
import { ServeiOrientacio } from './serveis/orientacio.js';
import { ServeiRisc } from './serveis/risc.js';
import { inicialitzarAjudes, iconaAjuda } from './ui/ajuda.js';
import { crearAnellSvg, filaComponent } from './ui/risc-visual.js';
import { t, idiomaActual, aplicarTraduccions, inicialitzarSelectorIdioma } from './i18n.js';
import { inicialitzarMenu } from './ui/menu.js';
import { avisar, confirmar } from './ui/dialegs.js';

aplicarTraduccions();
inicialitzarSelectorIdioma('selector-idioma');
inicialitzarMenu();
inicialitzarAjudes();

const contenidorDades = document.getElementById('contingut-dades-parcela');
const seccioSubparceles = document.getElementById('seccio-subparceles');
const llistatSubparceles = document.getElementById('llistat-subparceles');
const seccioRiscCalculat = document.getElementById('seccio-risc-calculat');
const contingutRiscCalculat = document.getElementById('contingut-risc-calculat');
const seccioAccions = document.getElementById('accions-parcela');
const seccioFiltreMapa = document.getElementById('filtre-mapa');
const selectFiltreMapa = document.getElementById('select-filtre-mapa');
const seccioMapaLleaflet = document.getElementById('mapa-detall');
const seccioMapa3d = document.getElementById('mapa-detall-3d');
const botoMapa2d = document.getElementById('boto-mapa-2d');
const botoMapa3d = document.getElementById('boto-mapa-3d');

let mapa3d = null;
const botoPendentOrientacio = document.getElementById('boto-pendent-orientacio');
const botoExportarGpx = document.getElementById('boto-exportar-gpx');
const botoEsborrar = document.getElementById('boto-esborrar');

let bd;
let parcelaActual;

async function iniciar() {
  const parametres = new URLSearchParams(window.location.search);
  const id = parametres.get('id');
  const idAgrupacio = parametres.get('agrupacio');

  if (!id) {
    contenidorDades.textContent = t('No s\'ha indicat cap parcel·la.');
    return;
  }

  bd = await BaseDades.obrir();
  parcelaActual = await bd.llegirParcela(id);

  if (!parcelaActual) {
    contenidorDades.textContent = t('No s\'ha trobat aquesta parcel·la.');
    return;
  }

  // Si s'hi arriba des del detall d'una agrupació (via el paràmetre
  // "agrupacio" a la URL), l'enllaç de tornada hi porta de nou, en
  // lloc de portar al llistat general de parcel·les.
  if (idAgrupacio) {
    const enllacTornar = document.getElementById('enllac-tornar');
    enllacTornar.href = `detall-agrupacio.html?id=${encodeURIComponent(idAgrupacio)}`;
    enllacTornar.title = t('Tornar a l\'agrupació');
    enllacTornar.setAttribute('aria-label', enllacTornar.title);
  }

  document.title = `Custòdia — ${parcelaActual.poblacio}`;
  document.getElementById('titol-detall').textContent = parcelaActual.poblacio;
  document.getElementById('subtitol-detall').textContent =
    `${t('Polígon')} ${parcelaActual.poligon} · ${t('Parcel·la')} ${parcelaActual.parcelaCadastral}`;
  pintarFitxa(parcelaActual);

  // Es llegeixen un sol cop i es reutilitzen tant per al llistat com
  // per al càlcul de risc, en lloc de tornar-les a consultar dues vegades.
  const subparceles = await bd.llegirSubparcelesDe(parcelaActual.id);
  pintarSubparceles(subparceles);
  const color = pintarRisc(subparceles);

  const mapa = new Mapa('mapa-detall');
  mapa.afegirParcela(parcelaActual, null, color);
  mapa.ajustarVistaATotes();

  inicialitzarFiltreMapa(mapa, parcelaActual);

  seccioAccions.hidden = false;
}

/**
 * Mostra la caixa de filtre només si hi ha punts d'altimetria ja
 * calculats i desats (vegeu altitud.js) -- no es torna a calcular ni
 * a consultar res, només es pinta el que ja hi ha. L'opció
 * "Orientació" només es mostra si es va calcular amb el mètode de
 * malla (l'únic que la calcula).
 */
/**
 * Afegeix el pas de la graella (si es coneix) a cada punt, perquè
 * Mapa pugui dibuixar-hi un quadrat de cobertura en lloc d'un punt sol.
 */
function ambPas(punts, entitat) {
  return punts.map((p) => ({ ...p, pasLat: entitat.pasLatMalla, pasLng: entitat.pasLngMalla }));
}

function inicialitzarFiltreMapa(mapa, parcela) {
  if (!parcela.puntsAltitud?.length) return;

  seccioFiltreMapa.hidden = false;
  const potFerMalla = parcela.metodeAltitud === 'malla';

  const opcioOrientacio = selectFiltreMapa.querySelector('option[value="orientacio"]');
  const opcioPendent = selectFiltreMapa.querySelector('option[value="pendent"]');
  const opcioOmbres = selectFiltreMapa.querySelector('option[value="ombres"]');
  opcioOrientacio.hidden = !potFerMalla;
  opcioPendent.hidden = !potFerMalla;
  opcioOmbres.hidden = !potFerMalla;

  // El mapa 3D també necessita el pendent per punt (mètode de malla) --
  // per això només es mostra el botó "3D" quan es pot fer servir,
  // igual que Pendent/Ombres al filtre 2D.
  botoMapa3d.hidden = !potFerMalla;

  let tipusMapaActual = '2d';

  function aplicarFiltre2D() {
    if (selectFiltreMapa.value === 'altitud') {
      mapa.afegirFiltreAltitud(ambPas(parcela.puntsAltitud, parcela));
    } else if (selectFiltreMapa.value === 'orientacio') {
      const punts = parcela.puntsAltitud.map((p) => ({
        ...p,
        etiqueta: p.orientacio == null ? null : t(ServeiOrientacio.etiquetaBruixola(p.orientacio)),
      }));
      mapa.afegirFiltreOrientacio(punts);
    } else if (selectFiltreMapa.value === 'cotes') {
      mapa.afegirFiltreCotes(parcela.puntsAltitud);
    } else if (selectFiltreMapa.value === 'pendent') {
      mapa.afegirFiltrePendent(ambPas(parcela.puntsAltitud, parcela));
    } else if (selectFiltreMapa.value === 'ombres') {
      mapa.afegirFiltreOmbres(ambPas(parcela.puntsAltitud, parcela));
    } else {
      mapa.netejarFiltre();
    }
  }

  function aplicarFiltre3D() {
    mapa3d?.amagarCotes();
    mapa3d?.amagarPerimetre();

    if (selectFiltreMapa.value === 'cotes') {
      mapa3d?.aplicarCapa('ombres');
      mapa3d?.mostrarCotes();
    } else if (selectFiltreMapa.value === 'cap') {
      mapa3d?.aplicarCapa('ombres');
      mapa3d?.mostrarPerimetre();
    } else {
      mapa3d?.aplicarCapa(selectFiltreMapa.value);
    }
  }

  selectFiltreMapa.addEventListener('change', () => {
    if (tipusMapaActual === '3d') {
      aplicarFiltre3D();
    } else {
      aplicarFiltre2D();
    }
  });

  function activar2D() {
    tipusMapaActual = '2d';
    botoMapa2d.setAttribute('aria-selected', 'true');
    botoMapa3d.setAttribute('aria-selected', 'false');

    mapa3d?.destruir();
    mapa3d = null;

    seccioMapa3d.hidden = true;
    seccioMapaLleaflet.hidden = false;
    // Leaflet s'ha quedat amb mida 0 mentre era amagat -- cal
    // avisar-lo que ara sí que té espai real, o es queda mig en blanc.
    mapa.leafletMap.invalidateSize();

    // Primer es mostren totes les opcions (en entrar a 3D es van amagar
    // totes menys Ombres/Cotes) i després es torna a amagar només les
    // que depenen del mètode de malla -- "Només el perímetre",
    // "Altitud" i "Cotes" sempre hi han de ser, siguem quin siguem el
    // mètode de càlcul.
    Array.from(selectFiltreMapa.options).forEach((opcio) => {
      opcio.hidden = false;
    });
    opcioOrientacio.hidden = !potFerMalla;
    opcioPendent.hidden = !potFerMalla;
    opcioOmbres.hidden = !potFerMalla;
    selectFiltreMapa.value = 'cap';
    mapa.netejarFiltre();
  }

  function activar3D() {
    tipusMapaActual = '3d';
    botoMapa3d.setAttribute('aria-selected', 'true');
    botoMapa2d.setAttribute('aria-selected', 'false');

    // De moment el 3D no sap mostrar l'orientació (calen fletxes 3D
    // pròpies, encara no fetes) -- es manté amagada mentre la resta
    // d'opcions ja funcionen.
    Array.from(selectFiltreMapa.options).forEach((opcio) => {
      opcio.hidden = opcio.value === 'orientacio';
    });
    selectFiltreMapa.value = 'ombres';

    seccioMapaLleaflet.hidden = true;
    seccioMapa3d.hidden = false;

    mapa3d = new Mapa3D('mapa-detall-3d');
    mapa3d.mostrarTerreny(parcela);
  }

  botoMapa2d.addEventListener('click', () => {
    if (tipusMapaActual !== '2d') activar2D();
  });
  botoMapa3d.addEventListener('click', () => {
    if (tipusMapaActual !== '3d') activar3D();
  });
}

function pintarSubparceles(subparceles) {
  if (subparceles.length === 0) return;

  llistatSubparceles.innerHTML = subparceles
    .map((s) => {
      const risc = ServeiRisc.classificarSubparcela(s.dcc) * 100;
      const color = ServeiRisc.colorSegonsRisc(risc);
      return `
        <tr>
          <td>${s.dcc ?? '—'}</td>
          <td>${s.ssp ? `${s.ssp} m²` : '—'}</td>
          <td>
            <span class="taula-parceles__risc">
              <span class="taula-parceles__punt-risc" style="background-color: ${color};"></span>
              ${risc.toFixed(0)} / 100
            </span>
          </td>
          <td>${s.ip ?? '—'}</td>
          <td>${s.ccc ?? '—'}</td>
        </tr>
      `;
    })
    .join('');
  seccioSubparceles.hidden = false;
}

/**
 * Anell de progrés en SVG (cercle amb stroke-dasharray/dashoffset),
 * acolorit amb el mateix gradient verd-roig que ja fem servir per a les
 * parcel·les al mapa -- el "senyal" visual de l'índex de perillositat.
 */
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

  const textAjudaRisc = t(
    'Índex propi (0-100) que combina vegetació, pendent i orientació per comparar parcel·les entre elles. No representa una probabilitat ni una freqüència real d\'incendis.'
  );
  const titolAmbAjuda = `${t('Risc d\'incendi calculat')}${iconaAjuda(textAjudaRisc)}`;
  seccioRiscCalculat.querySelector('h2').innerHTML = titolAmbAjuda;

  if (parcelaActual.pendentMitja == null) {
    seccioRiscCalculat.style.borderTopColor = '';
    contingutRiscCalculat.innerHTML = `
      <p>
        ${t('Cal fer primer els càlculs d\'')}<a href="altitud.html?id=${encodeURIComponent(parcelaActual.id)}">${t('Altimetria')}</a>.
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

  const colorTotal = ServeiRisc.colorSegonsRisc(indexPerillositat);
  seccioRiscCalculat.style.borderTopColor = colorTotal;

  contingutRiscCalculat.innerHTML = `
    <div class="risc-panell">
      <div class="risc-gauge">
        ${crearAnellSvg(indexPerillositat, colorTotal, t('Índex de perillositat'))}
        <div class="risc-gauge__valor">
          <span class="risc-gauge__numero">${indexPerillositat.toFixed(0)}</span>
          <span class="risc-gauge__escala">/ 100</span>
        </div>
      </div>
      <div class="risc-components">
        ${filaComponent(t('Component vegetació'), riscVegetacio, t('No disponible (sense subparceles)'))}
        ${filaComponent(t('Component pendent'), riscPendent, '')}
        ${filaComponent(t('Component orientació'), riscOrientacio, t('No disponible (cal el mètode de malla)'))}
      </div>
    </div>
  `;

  return colorTotal;
}

function pintarFitxa(parcela) {
  // Les dades d'altimetria es calculen a part (pàgina altitud.html) i es
  // desen a la parcel·la; aquí només es mostren si ja hi són, o un
  // enllaç per calcular-les si encara no.
  const ajudaPendent = iconaAjuda(
    t('Inclinació mitjana del terreny, calculada a partir del model digital d\'elevacions de l\'IDEE (vèrtexs del perímetre o una malla de punts interiors).')
  );
  const filaAltimetria = `
    <dt>${t('Pendent mitjà')}${ajudaPendent}</dt>
    <dd>${parcela.pendentMitja != null ? `${parcela.pendentMitja.toFixed(1)} %` : '—'}</dd>
  `;

  const ajudaOrientacio = iconaAjuda(
    t('Direcció cap on "mira" el pendent del terreny. Només es calcula amb el mètode de malla, no amb els vèrtexs del perímetre.')
  );
  const filaOrientacio = `
    <dt>${t('Orientació mitjana')}${ajudaOrientacio}</dt>
    <dd>${parcela.orientacioMitjana != null ? `${parcela.orientacioMitjana.toFixed(0)}° (${t(ServeiOrientacio.etiquetaBruixola(parcela.orientacioMitjana))})` : '—'}</dd>
  `;

  const localeData = idiomaActual() === 'ca' ? 'ca-ES' : 'es-ES';
  const ajudaData = iconaAjuda(
    t('Dades desades a la base de dades local en el moment de crear la parcel·la. Per tornar a consultar-les, cal esborrar la parcel·la i afegir-la de nou.')
  );
  const notaData = parcela.dataCreacio != null
    ? `<p class="nota">${t('Dades consultades el')}${ajudaData}: ${new Date(parcela.dataCreacio).toLocaleDateString(localeData)}</p>`
    : '';

  contenidorDades.innerHTML = `
    <h3>${t('Identificació')}</h3>
    <dl class="fitxa-parcela">
      <dt>${t('Població')}</dt><dd>${parcela.poblacio}</dd>
      <dt>${t('Polígon')}</dt><dd>${parcela.poligon}</dd>
      <dt>${t('Parcel·la')}</dt><dd>${parcela.parcelaCadastral}</dd>
      <dt>${t('Referència cadastral')}</dt><dd>${referenciaAmbEnllac(parcela)}</dd>
      <dt>${t('Superfície')}</dt><dd>${parcela.superficie ? `${parcela.superficie} m²` : '—'}</dd>
      <dt>${t('Ús (segons el Cadastre)')}</dt><dd>${parcela.us ?? t('No disponible')}</dd>
    </dl>

    <h3>${t('Terreny')}</h3>
    <dl class="fitxa-parcela">
      ${filaAltimetria}
      ${filaOrientacio}
    </dl>

    ${notaData}
  `;
}

/**
 * Enllaç directe a la cartografia del Cadastre, amb polígon i parcel·la
 * ja inclosos -- construït a partir d'un exemple real (l'usuari va
 * navegar al cadastre i em va passar la URL resultant), no d'una
 * documentació oficial de l'API. Només es mostra si la parcel·la té
 * els codis numèrics de província/municipi (calen per a la URL): les
 * creades abans d'aquest camp no els tindran, i es mostra només el
 * text de la referència, sense enllaç.
 */
function referenciaAmbEnllac(parcela) {
  if (parcela.referenciaCadastral == null) return '—';
  if (!parcela.codiProvincia || !parcela.codiMunicipi) return parcela.referenciaCadastral;

  const parametres = new URLSearchParams({
    pol: parcela.poligon,
    par: parcela.parcelaCadastral,
    MuniAgr: '',
    ZCon: '',
    DescProv: (parcela.provincia ?? '').toUpperCase(),
    prov: parcela.codiProvincia,
    muni: parcela.codiMunicipi,
    DescMuni: parcela.poblacio.toUpperCase(),
    TipUR: 'R',
    pest: 'rustica',
    from: 'OVCBusqueda',
    ZV: 'NO',
    ZR: 'NO',
    anyoZV: '',
    tematicos: '',
    anyotem: '',
    historica: '',
    coordinadas: '',
    antecedentes: '',
    cartografia: 'True',
    ListaBienes: 'TRUE',
  });
  const url = `https://www1.sedecatastro.gob.es/Cartografia/mapa.aspx?${parametres.toString()}`;

  return `${parcela.referenciaCadastral} (<a href="${url}" target="_blank" rel="noopener">${t('veure al Cadastre')}</a>)`;
}

botoPendentOrientacio.addEventListener('click', () => {
  window.location.href = `altitud.html?id=${encodeURIComponent(parcelaActual.id)}`;
});

botoExportarGpx.addEventListener('click', () => {
  ExportadorGpx.descarregar(parcelaActual);
});

botoEsborrar.addEventListener('click', async () => {
  const agrupacions = await bd.llegirAgrupacionsAmbParcela(parcelaActual.id);
  if (agrupacions.length > 0) {
    const noms = agrupacions.map((a) => a.nom).join(', ');
    await avisar(
      `${t('Aquesta parcel·la forma part de')} ${agrupacions.length === 1 ? t('l\'agrupació') : t('les agrupacions')} "${noms}". ${t('Cal treure-la de l\'agrupació abans de poder esborrar-la.')}`
    );
    return;
  }

  const confirmat = await confirmar(
    `${t('Segur que vols esborrar la parcel·la de')} ${parcelaActual.poblacio}? ${t('Aquesta acció no es pot desfer.')}`,
    { accio: t('Esborrar'), perillos: true }
  );
  if (!confirmat) return;

  await bd.esborrarSubparcelesDe(parcelaActual.id);
  await bd.esborrarParcela(parcelaActual.id);
  window.location.href = 'parceles.html';
});

iniciar().catch((error) => {
  console.error(error);
  avisar(t('No s\'ha pogut carregar el detall de la parcel·la.'));
});
