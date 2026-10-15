// Notificacions breus (toast) que desapareixen soles. Cal un contenidor
// amb la classe "toasts" a la pàgina (vegeu nucli.css).

/**
 * @param {string} text
 * @param {{tipus?: 'info'|'error', durada?: number, contenidor?: string}} [opcions]
 */
export function mostrarAvis(text, { tipus = 'info', durada = 3500, contenidor = 'toasts' } = {}) {
  const pare = document.getElementById(contenidor);
  if (!pare) return;
  const avis = document.createElement('div');
  avis.className = `toast${tipus === 'error' ? ' toast--error' : ''}`;
  avis.setAttribute('role', tipus === 'error' ? 'alert' : 'status');
  avis.textContent = text;
  pare.appendChild(avis);
  setTimeout(() => avis.remove(), durada);
}
