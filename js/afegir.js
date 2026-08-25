// Controlador d'afegir.html. Dos passos: primer es consulta el cadastre
// (geometria + ús tal com el retorna el Cadastre, no editable) i, en
// paral·lel, el Mapa Forestal d'Espanya (tipus de vegetació); després
// es confirma el risc i es desa.
import { BaseDades } from './serveis/basedades.js';
import { ServeiCadastre } from './serveis/cadastre.js';
import { ServeiVegetacio } from './serveis/vegetacio.js';
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

let dadesCadastre = null;
let dadesFormulariConsultades = null;
let tipusVegetacio = null;

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
    mostrarEstat('Cadastre consultat correctament. Revisa el risc.', 'exit');

    // Consulta al Mapa Forestal d'Espanya, a partir d'un punt
    // representatiu de la parcel·la. No bloqueja el formulari si falla
    // (és informació complementària, no imprescindible): si no s'aconsegueix,
    // la parcel·la es desa igualment, sense aquesta dada.
    consultarVegetacio();
  } catch (error) {
    console.error(error);
    mostrarEstat(`No s'ha pogut consultar el cadastre: ${error.message}`, 'error');
  } finally {
    botoConsultar.disabled = false;
  }
});

async function consultarVegetacio() {
  try {
    const [lat, lng] = ServeiVegetacio.centroideAproximat(dadesCadastre.coordenades);
    tipusVegetacio = await ServeiVegetacio.consultarTipus(lat, lng);
  } catch (error) {
    // No es mostra com a error a l'usuari: és una dada complementària,
    // i aquest servei concret és el menys fiable dels que fem servir
    // (vegeu els avisos a js/serveis/vegetacio.js).
    console.warn('No s\'ha pogut consultar el Mapa Forestal d\'Espanya:', error);
    tipusVegetacio = null;
  }
}

formulari.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!dadesCadastre || !dadesFormulariConsultades) {
    mostrarEstat('Primer cal consultar el cadastre.', 'error');
    return;
  }

  const dadesFormulari = new FormData(formulari);

  botoDesar.disabled = true;

  try {
    const parcela = new Parcela({
      ...dadesCadastre,
      ...dadesFormulariConsultades,
      risc: dadesFormulari.get('risc'),
      tipusVegetacio,
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
