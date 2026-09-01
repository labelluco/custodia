// Elements visuals reutilitzables per mostrar un índex de risc ja
// calculat (l'anell SVG i les barres per component) -- fets servir
// tant per detall.js (una parcel·la) com per detall-agrupacio.js (una
// agrupació), ja que tots dos mostren exactament el mateix tipus de
// resultat (vegeu ServeiRisc.calcularRiscTotal).
import { ServeiRisc } from '../serveis/risc.js';

/**
 * Anell de progrés en SVG (cercle amb stroke-dasharray/dashoffset),
 * acolorit amb el mateix gradient verd-roig que ja fem servir per a les
 * parcel·les al mapa.
 */
export function crearAnellSvg(index, color, etiquetaAria) {
  const radi = 52;
  const circumferencia = 2 * Math.PI * radi;
  const p = Math.min(Math.max(index, 0), 100);
  const offset = circumferencia * (1 - p / 100);

  return `
    <svg viewBox="0 0 120 120" role="img" aria-label="${etiquetaAria}: ${index.toFixed(0)}">
      <circle cx="60" cy="60" r="${radi}" fill="none" stroke="#e2ddd2" stroke-width="12"></circle>
      <circle cx="60" cy="60" r="${radi}" fill="none" stroke="${color}" stroke-width="12"
        stroke-linecap="round" stroke-dasharray="${circumferencia}" stroke-dashoffset="${offset}"
        transform="rotate(-90 60 60)"></circle>
    </svg>
  `;
}

/** Una fila d'un component del risc (etiqueta + barra acolorida segons el seu propi valor, o "no disponible"). */
export function filaComponent(etiqueta, valor01, textNoDisponible) {
  if (valor01 == null) {
    return `
      <div class="risc-component">
        <div class="risc-component__capcalera">
          <span>${etiqueta}</span>
          <span>${textNoDisponible}</span>
        </div>
        <div class="risc-component__barra"></div>
      </div>
    `;
  }

  const percentatge = valor01 * 100;
  const color = ServeiRisc.colorSegonsRisc(percentatge);

  return `
    <div class="risc-component">
      <div class="risc-component__capcalera">
        <span>${etiqueta}</span>
        <span>${percentatge.toFixed(0)} / 100</span>
      </div>
      <div class="risc-component__barra">
        <div class="risc-component__valor" style="width: ${percentatge}%; background-color: ${color};"></div>
      </div>
    </div>
  `;
}
