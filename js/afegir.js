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
    window.location.href = 'index.html';
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
