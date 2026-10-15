// Element d'un llistat del panell (parcel·les, agrupacions, geometries):
// substitueix les files de taula, que no cabien en un panell de 390 px.
// Tocar-lo el marca com a seleccionat i crida onSeleccionar (ressaltar al
// mapa); el botó "Detall" porta a la fitxa, sense disparar la selecció.
import { t } from '../i18n.js';

/**
 * @param {{titol: string, detall?: string, risc?: {color: string, index: number|null}|null, href: string, onSeleccionar?: () => void}} dades
 * @returns {HTMLLIElement}
 */
export function elementLlista({ titol, detall = '', risc = null, href, onSeleccionar }) {
  const li = document.createElement('li');
  li.className = 'element-llista';

  const principal = document.createElement('button');
  principal.type = 'button';
  principal.className = 'element-llista__principal';
  const spanTitol = document.createElement('span');
  spanTitol.className = 'element-llista__titol';
  spanTitol.textContent = titol;
  principal.appendChild(spanTitol);
  if (detall) {
    const spanDetall = document.createElement('span');
    spanDetall.className = 'element-llista__detall';
    spanDetall.textContent = detall;
    principal.appendChild(spanDetall);
  }

  li.appendChild(principal);

  if (risc && risc.index != null) {
    const xip = document.createElement('span');
    xip.className = 'xip xip--risc';
    xip.title = t('Risc');
    xip.innerHTML = `<span class="xip__punt" style="background-color: ${risc.color};"></span>${risc.index.toFixed(0)}`;
    li.appendChild(xip);
  }

  const enllac = document.createElement('a');
  enllac.href = href;
  enllac.className = 'boto boto--secundari boto--petit';
  enllac.textContent = t('Detall');
  li.appendChild(enllac);

  principal.addEventListener('click', () => {
    li.parentElement?.querySelector('.element-llista--seleccionat')?.classList.remove('element-llista--seleccionat');
    li.classList.add('element-llista--seleccionat');
    onSeleccionar?.();
  });

  return li;
}

/** "1 parcel·la" / "3 parcel·les". */
export function nombreParceles(n) {
  return `${n} ${n === 1 ? t('parcel·la') : t('parcel·les')}`;
}

/** "454700 m²", o "—" si no se sap (mateix format que la resta de l'app). */
export function formatSuperficie(superficie) {
  return superficie ? `${superficie} m²` : '—';
}
