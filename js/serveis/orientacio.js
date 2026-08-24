// Calcula l'orientació (l'"aspecte") mitjana d'una parcel·la, a partir
// dels mateixos gradients (dz/dx, dz/dy) que fa servir el càlcul de
// pendent -- el pendent és la magnitud d'aquest vector, l'orientació
// n'és la direcció. Només té sentit amb el mètode de malla: amb només
// els vèrtexs del perímetre no hi ha prou estructura 2D per definir una
// orientació real.
import { calcularGradients } from '../geometria/gradient.js';

const ETIQUETES_BRUIXOLA = [
  'Nord', 'Nord-est', 'Est', 'Sud-est', 'Sud', 'Sud-oest', 'Oest', 'Nord-oest',
];

// Per sota d'aquest pendent (~1%) el terreny es considera pràcticament
// pla, i l'orientació hi queda matemàticament indefinida (com preguntar
// cap a on "mira" un terra horitzontal) -- aquests punts es descarten
// del càlcul en lloc de forçar-los a un valor arbitrari.
const LLINDAR_PLA = 0.01;

export class ServeiOrientacio {
  /**
   * @param {Array<Array<[number, number]|null>>} graella
   * @param {Array<Array<number|null>>} altitudsGraella Mateixa forma que graella
   * @param {number} distanciaMetres Separació entre punts de la malla
   * @returns {{orientacioMitjana: number|null, etiqueta: string|null}}
   *   orientacioMitjana en graus (0-360, 0 = Nord, sentit horari), o
   *   null si tot el terreny consultat surt pràcticament pla.
   */
  static calcularOrientacioMalla(graella, altitudsGraella, distanciaMetres) {
    const gradients = calcularGradients(graella, altitudsGraella, distanciaMetres);

    // La mitjana d'angles NO es pot fer amb una mitjana aritmètica
    // directa (350° i 10° haurien de fer 0°, no 180°): es converteix
    // cada orientació a un vector unitari, es fa la mitjana dels
    // vectors, i es torna a convertir a angle.
    let sumaSinus = 0;
    let sumaCosinus = 0;
    let comptador = 0;

    for (const { dzdx, dzdy } of gradients) {
      const modul = Math.sqrt(dzdx ** 2 + dzdy ** 2);
      if (modul < LLINDAR_PLA) continue;

      const graus = ServeiOrientacio._gradientAOrientacio(dzdx, dzdy);
      const rad = (graus * Math.PI) / 180;
      sumaSinus += Math.sin(rad);
      sumaCosinus += Math.cos(rad);
      comptador++;
    }

    if (comptador === 0) {
      return { orientacioMitjana: null, etiqueta: null };
    }

    let orientacioMitjana =
      (Math.atan2(sumaSinus / comptador, sumaCosinus / comptador) * 180) / Math.PI;
    if (orientacioMitjana < 0) orientacioMitjana += 360;

    return {
      orientacioMitjana,
      etiqueta: ServeiOrientacio.etiquetaBruixola(orientacioMitjana),
    };
  }

  /**
   * Converteix un gradient (dz/dx, dz/dy) a una orientació en graus
   * (0-360, 0 = Nord, sentit horari): és la direcció cap on "mira" el
   * pendent (cap on baixa el terreny), per això s'inverteix el signe
   * del gradient (que apunta cap amunt, no cap avall).
   *
   * Derivat directament en convenció (x=est, y=nord), no copiat d'una
   * fórmula de tercers, perquè la nostra graella creix cap al nord amb
   * "fila" (a diferència del conveni habitual d'un ràster, on la fila
   * sol créixer cap al sud) -- calia evitar heretar un signe equivocat.
   */
  static _gradientAOrientacio(dzdx, dzdy) {
    const componentEst = -dzdx;
    const componentNord = -dzdy;
    let graus = (Math.atan2(componentEst, componentNord) * 180) / Math.PI;
    if (graus < 0) graus += 360;
    return graus;
  }

  /** Etiqueta de bruixola (Nord, Nord-est...) a partir de graus (0-360). */
  static etiquetaBruixola(graus) {
    const index = Math.round(graus / 45) % 8;
    return ETIQUETES_BRUIXOLA[index];
  }

  /**
   * Orientació de cada punt individual de la malla (no la mitjana),
   * per poder-la representar punt a punt al mapa (per exemple, amb una
   * fletxa per punt).
   *
   * @returns {Array<{fila: number, columna: number, orientacio: number|null}>}
   *   orientacio en graus (0-360), o null si el terreny hi és massa pla.
   */
  static calcularOrientacionsPerPunt(graella, altitudsGraella, distanciaMetres) {
    const gradients = calcularGradients(graella, altitudsGraella, distanciaMetres);

    return gradients.map(({ fila, columna, dzdx, dzdy }) => {
      const modul = Math.sqrt(dzdx ** 2 + dzdy ** 2);
      const orientacio = modul < LLINDAR_PLA ? null : ServeiOrientacio._gradientAOrientacio(dzdx, dzdy);
      return { fila, columna, orientacio };
    });
  }
}
