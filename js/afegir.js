// Controlador d'afegir.html. Dos passos: primer es consulta el cadastre
// (geometria + us suggerit), després es revisen/confirmen us i risc i es
// desa. Fer-ho en dos passos, en lloc d'un de sol, és el que permet
// suggerir l'us abans que l'usuari l'hagi de triar.
import { BaseDades } from './serveis/basedades.js';
import { ServeiCadastre } from './serveis/cadastre.js';
import { Parcela } from './model/parcela.js';

const formulari = document.getElementById('form-parcela');
const fieldsetCadastre = document.getElementById('dades-cadastre');
const fieldsetUsRisc = document.getElementById('dades-us-risc');
const botoConsultar = document.getElementById('boto-consultar');
const botoDesar = document.getElementById('boto-desar');
const missatgeEstat = document.getElementById('missatge-estat');
const selectUs = document.getElementById('us');
const notaUsSuggerit = document.getElementById('nota-us-suggerit');

let dadesCadastre = null;
let dadesFormulariConsultades = null;

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

    if (dadesCadastre.usSuggerit) {
      selectUs.value = dadesCadastre.usSuggerit;
      notaUsSuggerit.textContent = 'Suggerit a partir de les dades del cadastre. Pots canviar-lo.';
      notaUsSuggerit.hidden = false;
    } else {
      notaUsSuggerit.hidden = true;
    }

    fieldsetCadastre.disabled = true;
    fieldsetUsRisc.hidden = false;
    mostrarEstat('Cadastre consultat correctament. Revisa l\'ús i el risc.', 'exit');
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

  const dadesFormulari = new FormData(formulari);

  botoDesar.disabled = true;

  try {
    const parcela = new Parcela({
      ...dadesCadastre,
      ...dadesFormulariConsultades,
      us: dadesFormulari.get('us'),
      risc: dadesFormulari.get('risc'),
    });

    const bd = await BaseDades.obrir();
    await bd.afegirParcela(parcela);

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
