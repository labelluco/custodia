// Controlador d'afegir.html: formulari per afegir una parcel·la nova.
import { BaseDades } from './serveis/basedades.js';
import { ServeiCadastre } from './serveis/cadastre.js';
import { Parcela } from './model/parcela.js';

const formulari = document.getElementById('form-parcela');
const botoDesar = document.getElementById('boto-desar');
const missatgeEstat = document.getElementById('missatge-estat');

formulari.addEventListener('submit', async (event) => {
  event.preventDefault();

  const dadesFormulari = new FormData(formulari);
  const provincia = dadesFormulari.get('provincia').trim();
  const poblacio = dadesFormulari.get('poblacio').trim();
  const poligon = dadesFormulari.get('poligon').trim();
  const parcelaCadastral = dadesFormulari.get('parcela').trim();
  const us = dadesFormulari.get('us');
  const risc = dadesFormulari.get('risc');

  botoDesar.disabled = true;
  mostrarEstat('Consultant el Cadastre...', 'info');

  try {
    const dadesCadastre = await ServeiCadastre.consultarParcela(
      provincia,
      poblacio,
      poligon,
      parcelaCadastral
    );

    const parcela = new Parcela({
      ...dadesCadastre,
      poligon,
      parcelaCadastral,
      poblacio,
      us,
      risc,
    });

    const bd = await BaseDades.obrir();
    await bd.afegirParcela(parcela);

    mostrarEstat('Parcel·la desada correctament.', 'exit');
    formulari.reset();
    window.location.href = 'index.html';
  } catch (error) {
    console.error(error);
    mostrarEstat(`No s'ha pogut afegir la parcel·la: ${error.message}`, 'error');
  } finally {
    botoDesar.disabled = false;
  }
});

function mostrarEstat(text, tipus) {
  missatgeEstat.textContent = text;
  missatgeEstat.className = `missatge-estat missatge-estat--${tipus}`;
  missatgeEstat.hidden = false;
}
