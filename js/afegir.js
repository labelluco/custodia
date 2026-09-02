// Controlador d'afegir.html. Dos passos: primer es consulta el cadastre
// (geometria + ús tal com el retorna el Cadastre, no editable); després
// es desa. El risc d'incendi no es demana aquí: es calcula sempre
// automàticament (vegeu ServeiRisc), no és un valor manual.
//
// La consulta al Mapa Forestal d'Espanya (tipus de vegetació) es va
// provar aquí, però el servei mai ha arribat a funcionar (vegeu els
// avisos a js/serveis/vegetacio.js) -- es deixa el fitxer al
// repositori per si algun dia hi ha una alternativa, però no es crida
// des d'enlloc.
import { BaseDades } from './serveis/basedades.js';
import { ServeiCadastre } from './serveis/cadastre.js';
import { ServeiUbicacions } from './serveis/ubicacions.js';
import { Mapa } from './ui/mapa.js';
import { Parcela } from './model/parcela.js';
import { t, aplicarTraduccions, inicialitzarSelectorIdioma } from './i18n.js';
import { inicialitzarMenu } from './ui/menu.js';

aplicarTraduccions();
inicialitzarSelectorIdioma('selector-idioma');
inicialitzarMenu();

const formulari = document.getElementById('form-parcela');
const fieldsetCadastre = document.getElementById('dades-cadastre');
const fieldsetUsRisc = document.getElementById('dades-us-risc');
const botoConsultar = document.getElementById('boto-consultar');
const botoDesar = document.getElementById('boto-desar');
const missatgeEstat = document.getElementById('missatge-estat');
const valorUsCadastre = document.getElementById('valor-us-cadastre');
const campDesglossament = document.getElementById('camp-desglossament');
const llistatDesglossament = document.getElementById('llistat-desglossament');
const selectProvincia = document.getElementById('provincia');
const selectPoblacio = document.getElementById('poblacio');

let dadesCadastre = null;
let dadesFormulariConsultades = null;

/**
 * Carrega el desplegable de províncies en obrir la pàgina, per evitar
 * que l'usuari l'hagi d'escriure a mà (i s'equivoqui). Si falla, es
 * torna a deixar com a camp de text lliure -- millor que bloquejar
 * tot el formulari per un servei extern caigut.
 *
 * Es guarda el codi numèric de cada província/municipi com a
 * data-codi de cada opció -- no cal per a la consulta del Cadastre
 * (que va per nom), però sí per construir l'enllaç directe a la
 * cartografia del Cadastre en acabar (vegeu detall.js).
 */
async function carregarProvincies() {
  try {
    const provincies = await ServeiUbicacions.consultarProvincies();
    selectProvincia.innerHTML =
      `<option value="">${t('Tria una província')}</option>` +
      provincies.map((p) => `<option value="${p.nom}" data-codi="${p.codi}">${p.nom}</option>`).join('');
  } catch (error) {
    console.warn('No s\'han pogut carregar les províncies, es deixa com a camp de text:', error);
    selectProvincia.outerHTML =
      `<input type="text" id="provincia" name="provincia" required placeholder="${t('p. ex. Teruel')}">`;
  }
}

selectProvincia.addEventListener('change', async () => {
  const provincia = selectProvincia.value;
  selectPoblacio.disabled = true;
  selectPoblacio.innerHTML = `<option value="">${t('Carregant...')}</option>`;

  if (!provincia) {
    selectPoblacio.innerHTML = `<option value="">${t('Tria primer una província')}</option>`;
    return;
  }

  try {
    const municipis = await ServeiUbicacions.consultarMunicipis(provincia);
    selectPoblacio.innerHTML =
      `<option value="">${t('Tria un municipi')}</option>` +
      municipis.map((m) => `<option value="${m.nom}" data-codi="${m.codi}">${m.nom}</option>`).join('');
    selectPoblacio.disabled = false;
  } catch (error) {
    console.warn('No s\'han pogut carregar els municipis, es deixa com a camp de text:', error);
    selectPoblacio.outerHTML = '<input type="text" id="poblacio" name="poblacio" required>';
  }
});

carregarProvincies();

/**
 * Codi (data-codi) de l'opció triada d'un <select>, si encara ho és
 * (si el servei va fallar i s'ha convertit en un camp de text, no hi
 * ha cap codi disponible -- es torna null, no es trenca res).
 */
function codiSeleccionat(idElement) {
  const element = document.getElementById(idElement);
  if (!element || element.tagName !== 'SELECT') return null;
  return element.options[element.selectedIndex]?.dataset.codi ?? null;
}

botoConsultar.addEventListener('click', async () => {
  const dadesFormulari = new FormData(formulari);
  const provincia = dadesFormulari.get('provincia').trim();
  const poblacio = dadesFormulari.get('poblacio').trim();
  const poligon = dadesFormulari.get('poligon').trim();
  const parcelaCadastral = dadesFormulari.get('parcela').trim();

  if (!provincia || !poblacio || !poligon || !parcelaCadastral) {
    mostrarEstat(t('Cal omplir provincia, polígon, parcel·la i població.'), 'error');
    return;
  }

  botoConsultar.disabled = true;
  mostrarEstat(t('Consultant el Cadastre...'), 'info');

  try {
    dadesCadastre = await ServeiCadastre.consultarParcela(
      provincia,
      poblacio,
      poligon,
      parcelaCadastral
    );
    // Es guarden aquí, no es tornen a llegir del formulari en desar: un cop
    // el fieldset queda disabled, FormData deixa d'incloure aquests camps.
    dadesFormulariConsultades = {
      poligon,
      parcelaCadastral,
      poblacio,
      provincia,
      codiProvincia: codiSeleccionat('provincia'),
      codiMunicipi: codiSeleccionat('poblacio'),
    };

    valorUsCadastre.textContent = dadesCadastre.us ?? t('No disponible');

    if (dadesCadastre.subparceles.length > 0) {
      // Sense columna de risc: encara no s'ha desat la parcel·la, i el
      // risc es calcula a partir de dades ja guardades (vegeu
      // ServeiRisc) -- no té sentit calcular-lo aquí.
      llistatDesglossament.innerHTML = dadesCadastre.subparceles
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
      campDesglossament.hidden = false;
    } else {
      campDesglossament.hidden = true;
    }

    fieldsetCadastre.disabled = true;
    fieldsetUsRisc.hidden = false;
    mostrarEstat(t('Cadastre consultat correctament.'), 'exit');
  } catch (error) {
    console.error(error);
    mostrarEstat(`${t('No s\'ha pogut consultar el cadastre:')} ${error.message}`, 'error');
  } finally {
    botoConsultar.disabled = false;
  }
});

formulari.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!dadesCadastre || !dadesFormulariConsultades) {
    mostrarEstat(t('Primer cal consultar el cadastre.'), 'error');
    return;
  }

  botoDesar.disabled = true;

  try {
    const parcela = new Parcela({
      ...dadesCadastre,
      ...dadesFormulariConsultades,
      dataCreacio: new Date().toISOString(),
    });

    const bd = await BaseDades.obrir();
    const id = await bd.afegirParcela(parcela);

    if (dadesCadastre.subparceles.length > 0) {
      await bd.afegirSubparceles(id, dadesCadastre.subparceles);
    }

    mostrarEstat(t('Parcel·la desada correctament.'), 'exit');
    window.location.href = 'parceles.html';
  } catch (error) {
    console.error(error);
    mostrarEstat(`${t('No s\'ha pogut desar la parcel·la:')} ${error.message}`, 'error');
  } finally {
    botoDesar.disabled = false;
  }
});

function mostrarEstat(text, tipus) {
  missatgeEstat.textContent = text;
  missatgeEstat.className = `missatge-estat missatge-estat--${tipus}`;
  missatgeEstat.hidden = false;
}

// --- Mapa de selecció directa al Cadastre ---
//
// Alternativa a escriure polígon i parcel·la a mà: es mostren totes
// les parcel·les del Cadastre visibles al requadre del mapa (consulta
// WFS per BBOX, vegeu ServeiCadastre.consultarParcelesEnBBOX), i en
// tocar-ne una s'omplen tots els camps automàticament (província,
// població, polígon i parcel·la -- els dos primers, resolts a partir
// dels codis que ja porta la pròpia referència cadastral) i es llança
// la consulta de seguida, sense necessitat del pas manual.
//
// Es manté el formulari manual tal com estava: no tothom sap
// identificar la seva finca en un mapa, però sí en pot conèixer el
// polígon i la parcel·la de memòria.
let mapaSeleccio = null;
let capaIndicadorArea = null;
const missatgeCarregantMapa = document.getElementById('carregant-parceles-mapa');
// Es guarda un número de "generació" de cada consulta: si arriba la
// resposta d'una consulta que ja no és la més recent (per exemple,
// perquè l'usuari ha tornat a moure el mapa abans que arribés), es
// descarta en lloc de pintar-la -- evita que una resposta antiga
// "guanyi" per pura casualitat de temps a una de més nova.
let generacioActual = 0;
let referenciaTemporitzador = null;

// Es va confirmar provant-ho en directe que el propi servei del
// Cadastre no respon (zero resultats, sense cap error) si el requadre
// de la consulta és massa gran -- per això no es fa servir tota la
// zona visible del mapa (que pot ser molt gran si l'usuari s'allunya
// per tenir context), sinó sempre una àrea fixa i petita al voltant
// del centre, per sota d'aquest límit. L'usuari pot allunyar-se tant
// com vulgui per orientar-se; només cal que desplaci el mapa perquè la
// seva parcel·la caigui dins del requadre marcat.
const COSTAT_AREA_CONSULTA_METRES = 700;

// Temps mínim que es manté visible el missatge de "Carregant..." --
// sense això, si la consulta respon molt ràpid (l'àrea és petita),
// pot arribar a desaparèixer abans que l'ull humà l'arribi a notar.
const DURADA_MINIMA_MISSATGE_CARREGA_MS = 300;

function inicialitzarMapaSeleccio() {
  mapaSeleccio = new Mapa('mapa-seleccio-cadastre');
  // Es retarda una mica cada consulta (i es descarta l'anterior si
  // encara no havia saltat): així, si l'usuari fa zoom o es desplaça
  // diverses vegades seguides molt ràpid, només es llança una consulta
  // per al punt final, no una per cada micro-moviment intermedi.
  mapaSeleccio.leafletMap.on('moveend', () => {
    clearTimeout(referenciaTemporitzador);
    referenciaTemporitzador = setTimeout(actualitzarParcelesVisibles, 400);
  });
  actualitzarParcelesVisibles();
}

async function actualitzarParcelesVisibles() {
  const generacioDAquestaConsulta = ++generacioActual;

  const centre = mapaSeleccio.leafletMap.getCenter();
  const bounds = centre.toBounds(COSTAT_AREA_CONSULTA_METRES);

  if (capaIndicadorArea) {
    mapaSeleccio.leafletMap.removeLayer(capaIndicadorArea);
  }
  capaIndicadorArea = L.rectangle(bounds, {
    color: '#a1552e',
    weight: 2,
    fill: false,
    dashArray: '6 4',
  }).addTo(mapaSeleccio.leafletMap);

  console.log('[mapa-cadastre] BBOX de consulta (lat/lng):', bounds.toBBoxString());
  missatgeCarregantMapa.hidden = false;
  const inicimostraCarrega = Date.now();
  // Sense això, el navegador pot no arribar mai a repintar el canvi
  // anterior (hidden = false) abans que comenci la feina llarga i
  // seguida de sota (consultar + pintar centenars de polígons) -- es
  // força explícitament un moment de respir perquè el missatge
  // arribi a veure's de debò.
  await new Promise(requestAnimationFrame);
  try {
    const parceles = await ServeiCadastre.consultarParcelesEnBBOX(
      bounds.getSouth(),
      bounds.getWest(),
      bounds.getNorth(),
      bounds.getEast()
    );

    if (generacioDAquestaConsulta !== generacioActual) {
      console.log('[mapa-cadastre] resposta descartada (ja no és la consulta més recent)');
      return;
    }

    console.log('[mapa-cadastre] parcel·les rebudes:', parceles.length, parceles);
    mapaSeleccio.buidar();
    for (const p of parceles) {
      if (p.coordenades.length === 0) {
        console.log('[mapa-cadastre] parcel·la sense geometria, ignorada:', p.referenciaCadastral);
        continue;
      }
      mapaSeleccio.afegirParcelaCandidata(p.coordenades, p.referenciaCadastral, () =>
        seleccionarParcelaCandidata(p)
      );
    }
  } catch (error) {
    console.error('[mapa-cadastre] error en consultar les parcel·les:', error);
  } finally {
    // Sempre s'amaga en acabar (èxit, error, o resposta descartada per
    // haver-n'hi una de més recent) -- mai es queda penjat. Com que la
    // consulta pot ser molt ràpida (l'àrea és petita), es garanteix un
    // temps mínim visible perquè no passi desapercebut.
    if (generacioDAquestaConsulta === generacioActual) {
      const tempsTranscorregut = Date.now() - inicimostraCarrega;
      const esperaRestant = Math.max(0, DURADA_MINIMA_MISSATGE_CARREGA_MS - tempsTranscorregut);
      setTimeout(() => {
        if (generacioDAquestaConsulta === generacioActual) {
          missatgeCarregantMapa.hidden = true;
        }
      }, esperaRestant);
    }
  }
}

/**
 * En tocar una parcel·la del mapa: se n'obtenen província i municipi
 * directament del Cadastre (Consulta_DNPRC_Codigos, amb els codis que
 * ja porta la pròpia referència -- vegeu ServeiCadastre.consultarNomsPerCodis),
 * s'omplen tots els camps del formulari, i es llança la consulta de seguida.
 */
async function seleccionarParcelaCandidata(parcelaCandidata) {
  console.log(
    '[mapa-cadastre] parcel·la triada -- referència en brut:', parcelaCandidata.referenciaCadastral,
    '| polígon/parcel·la desglossats:', parcelaCandidata.poligon, '/', parcelaCandidata.parcelaCadastral
  );

  if (!parcelaCandidata.poligon || !parcelaCandidata.parcelaCadastral) {
    alert(t('No s\'ha pogut identificar el polígon i la parcel·la d\'aquesta finca.'));
    return;
  }

  // Es reinicia l'estat del formulari abans d'omplir-hi les dades
  // noves: si ja s'havia consultat una altra parcel·la abans (des del
  // mapa o a mà), el primer bloc del formulari -- amb el botó de
  // "Consultar cadastre" inclòs -- va quedar deshabilitat, i un botó
  // deshabilitat no dispara el seu clic ni que es cridi per codi. Sense
  // aquest reinici, tocar una segona parcel·la al mapa no feia res, i
  // es quedaven mostrats sempre els resultats de la primera.
  fieldsetCadastre.disabled = false;
  fieldsetUsRisc.hidden = true;
  missatgeEstat.hidden = true;
  dadesCadastre = null;
  dadesFormulariConsultades = null;

  const codiProvinciaRef = parcelaCandidata.referenciaCadastral.slice(0, 2);
  const codiMunicipiRef = parcelaCandidata.referenciaCadastral.slice(2, 5);

  try {
    // Es demanen els noms directament al Cadastre amb els codis que ja
    // porta la pròpia referència (Consulta_DNPRC_Codigos), en lloc de
    // passar per ConsultaMunicipio -- un servei que s'ha demostrat que
    // no llegim correctament per a algun municipi (vegeu
    // ServeiCadastre.consultarNomsPerCodis).
    const { provincia, municipi } = await ServeiCadastre.consultarNomsPerCodis(
      codiProvinciaRef,
      codiMunicipiRef,
      parcelaCandidata.referenciaCadastral
    );
    console.log('[mapa-cadastre] provincia/municipi resolts pel Cadastre:', provincia, '/', municipi);

    establirValorUbicacio('provincia', provincia);
    // Encara no tenim la llista sencera de municipis d'aquesta
    // província (no calia demanar-la) -- n'hi ha prou de crear-hi
    // només l'opció d'aquest municipi concret.
    establirValorUbicacio('poblacio', municipi, [{ codi: codiMunicipiRef, nom: municipi }]);
    document.getElementById('poligon').value = parcelaCandidata.poligon;
    document.getElementById('parcela').value = parcelaCandidata.parcelaCadastral;

    botoConsultar.click();
  } catch (error) {
    console.error(error);
    alert(
      t(
        'No s\'ha pogut identificar automàticament la província i el municipi d\'aquesta parcel·la. Selecciona\'ls manualment i escriu el polígon i la parcel·la a mà.'
      )
    );
  }
}

/**
 * Estableix el valor d'un camp de província/població, tant si encara
 * és un <select> (cas normal) com si ha caigut a un <input> de text
 * (si ServeiUbicacions va fallar en carregar la pàgina). Si calen
 * opcions noves (per exemple, la població, que només es poblen quan
 * es tria una província a mà), es passen a "opcions".
 */
function establirValorUbicacio(idElement, nom, opcions) {
  const element = document.getElementById(idElement);
  if (!element) return;

  if (element.tagName === 'SELECT') {
    if (opcions) {
      element.innerHTML = opcions
        .map((o) => `<option value="${o.nom}" data-codi="${o.codi}">${o.nom}</option>`)
        .join('');
      element.disabled = false;
    }
  }
  element.value = nom;

  // Si el navegador no ha trobat cap <option> amb aquest valor exacte,
  // el camp es queda buit (o amb el valor anterior) sense cap avís --
  // es detecta i es registra, en lloc de deixar-ho passar en silenci.
  if (element.value !== nom) {
    console.error(
      `[mapa-cadastre] "${nom}" no coincideix amb cap opció de #${idElement}` +
        (opcions ? ` -- opcions disponibles: ${opcions.map((o) => o.nom).join(', ')}` : '')
    );
  }
}

inicialitzarMapaSeleccio();
