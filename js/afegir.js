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

const formulari = document.getElementById('form-parcela');
const fieldsetCadastre = document.getElementById('dades-cadastre');
const fieldsetUsRisc = document.getElementById('dades-us-risc');
const botoConsultar = document.getElementById('boto-consultar');
const botoDesar = document.getElementById('boto-desar');
const missatgeEstat = document.getElementById('missatge-estat');
const valorUsCadastre = document.getElementById('valor-us-cadastre');
const campDesglossament = document.getElementById('camp-desglossament');
const valorDesglossament = document.getElementById('valor-desglossament');
const selectProvincia = document.getElementById('provincia');
const selectPoblacio = document.getElementById('poblacio');

let dadesCadastre = null;
let dadesFormulariConsultades = null;

/**
 * Carrega el desplegable de províncies en obrir la pàgina, per evitar
 * que l'usuari l'hagi d'escriure a mà (i s'equivoqui). Si falla, es
 * torna a deixar com a camp de text lliure -- millor que bloquejar
 * tot el formulari per un servei extern caigut.
 */
async function carregarProvincies() {
  try {
    const provincies = await ServeiUbicacions.consultarProvincies();
    selectProvincia.innerHTML =
      '<option value="">Tria una província</option>' +
      provincies.map((p) => `<option value="${p.nom}">${p.nom}</option>`).join('');
  } catch (error) {
    console.warn('No s\'han pogut carregar les províncies, es deixa com a camp de text:', error);
    selectProvincia.outerHTML =
      '<input type="text" id="provincia" name="provincia" required placeholder="p. ex. Teruel">';
  }
}

selectProvincia.addEventListener('change', async () => {
  const provincia = selectProvincia.value;
  selectPoblacio.disabled = true;
  selectPoblacio.innerHTML = '<option value="">Carregant...</option>';

  if (!provincia) {
    selectPoblacio.innerHTML = '<option value="">Tria primer una província</option>';
    return;
  }

  try {
    const municipis = await ServeiUbicacions.consultarMunicipis(provincia);
    selectPoblacio.innerHTML =
      '<option value="">Tria un municipi</option>' +
      municipis.map((m) => `<option value="${m.nom}">${m.nom}</option>`).join('');
    selectPoblacio.disabled = false;
  } catch (error) {
    console.warn('No s\'han pogut carregar els municipis, es deixa com a camp de text:', error);
    selectPoblacio.outerHTML = '<input type="text" id="poblacio" name="poblacio" required>';
  }
});

carregarProvincies();

botoConsultar.addEventListener('click', async () => {
  const dadesFormulari = new FormData(formulari);
  const provincia = dadesFormulari.get('provincia').trim();
  const poblacio = dadesFormulari.get('poblacio').trim();
  const poligon = dadesFormulari.get('poligon').trim();
  const parcelaCadastral = dadesFormulari.get('parcela').trim();

  if (!provincia || !poblacio || !poligon || !parcelaCadastral) {
    mostrarEstat('Cal omplir provincia, polígon, parcel·la i població.', 'error');
    return;
  }

  botoConsultar.disabled = true;
  mostrarEstat('Consultant el Cadastre...', 'info');

  try {
    dadesCadastre = await ServeiCadastre.consultarParcela(
      provincia,
      poblacio,
      poligon,
      parcelaCadastral
    );
    // Es guarden aquí, no es tornen a llegir del formulari en desar: un cop
    // el fieldset queda disabled, FormData deixa d'incloure aquests camps.
    dadesFormulariConsultades = { poligon, parcelaCadastral, poblacio };

    valorUsCadastre.textContent = dadesCadastre.us ?? 'No disponible';

    if (dadesCadastre.subparceles.length > 0) {
      valorDesglossament.textContent = dadesCadastre.subparceles
        .map((s) => (s.ssp ? `${s.dcc} (${s.ssp} m²)` : s.dcc))
        .join(', ');
      campDesglossament.hidden = false;
    } else {
      campDesglossament.hidden = true;
    }

    fieldsetCadastre.disabled = true;
    fieldsetUsRisc.hidden = false;
    mostrarEstat('Cadastre consultat correctament.', 'exit');
  } catch (error) {
    console.error(error);
    mostrarEstat(`No s'ha pogut consultar el cadastre: ${error.message}`, 'error');
  } finally {
    botoConsultar.disabled = false;
  }
});

formulari.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!dadesCadastre || !dadesFormulariConsultades) {
    mostrarEstat('Primer cal consultar el cadastre.', 'error');
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

    mostrarEstat('Parcel·la desada correctament.', 'exit');
    window.location.href = 'index.html';
  } catch (error) {
    console.error(error);
    mostrarEstat(`No s'ha pogut desar la parcel·la: ${error.message}`, 'error');
  } finally {
    botoDesar.disabled = false;
  }
});

function mostrarEstat(text, tipus) {
  missatgeEstat.textContent = text;
  missatgeEstat.className = `missatge-estat missatge-estat--${tipus}`;
  missatgeEstat.hidden = false;
}
