// Diàlegs i avisos amb l'estil del nucli, en lloc dels alert()/confirm()
// del navegador: aquells no es poden traduir ni donar estil, bloquegen
// tota la pàgina, i alguns navegadors els deixen silenciar.
import { t } from '../i18n.js';
export { mostrarAvis } from '../../nucli/js/ui/avisos.js';

function obrirDialeg(missatge, botons) {
  return new Promise((resolve) => {
    const dialeg = document.createElement('dialog');
    dialeg.className = 'dialeg';
    const form = document.createElement('form');
    form.method = 'dialog';
    form.className = 'dialeg__cos';

    const text = document.createElement('p');
    text.className = 'dialeg__text';
    text.textContent = missatge;

    const accions = document.createElement('div');
    accions.className = 'dialeg__accions';
    for (const { text: etiqueta, valor, classe } of botons) {
      const boto = document.createElement('button');
      boto.type = 'submit';
      boto.value = valor;
      boto.className = `boto ${classe}`;
      boto.textContent = etiqueta;
      accions.appendChild(boto);
    }

    form.append(text, accions);
    dialeg.appendChild(form);
    document.body.appendChild(dialeg);
    // Esc o tancar-lo sense botó compten com a "no".
    dialeg.addEventListener('close', () => {
      resolve(dialeg.returnValue === 'si');
      dialeg.remove();
    });
    dialeg.showModal();
  });
}

/**
 * @param {string} missatge
 * @param {{accio?: string, perillos?: boolean}} [opcions]
 * @returns {Promise<boolean>} cert si s'ha confirmat
 */
export function confirmar(missatge, { accio = t('Continuar'), perillos = false } = {}) {
  return obrirDialeg(missatge, [
    { text: t('Cancel·lar'), valor: 'no', classe: 'boto--secundari' },
    { text: accio, valor: 'si', classe: perillos ? 'boto--perill' : 'boto--primari' },
  ]);
}

/** Missatge que cal llegir abans de continuar (substitueix alert()). */
export async function avisar(missatge) {
  await obrirDialeg(missatge, [{ text: t("D'acord"), valor: 'si', classe: 'boto--primari' }]);
}
