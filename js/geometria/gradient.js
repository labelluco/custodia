// Calcula el gradient (dz/dx, dz/dy) de cada punt d'una graella
// d'altituds mitjançant el mètode de Horn (1981) -- la mateixa base
// matemàtica que fan servir QGIS/ArcGIS tant per al pendent com per a
// l'orientació d'un model de terreny. Es calcula un sol cop aquí i
// ServeiAltimetria (pendent) i ServeiOrientacio (orientació) en
// reutilitzen el resultat, en lloc de recalcular els mateixos veïns
// cadascun pel seu compte.

/**
 * @param {Array<Array<[number, number]|null>>} graella
 * @param {Array<Array<number|null>>} altitudsGraella Mateixa forma que graella
 * @param {number} distanciaMetres Separació entre punts de la malla
 * @returns {Array<{fila: number, columna: number, dzdx: number, dzdy: number}>}
 *   Un gradient per cada punt vàlid (dins del perímetre). "fila" creix
 *   cap al nord i "columna" cap a l'est (vegeu Malla.generar): dzdx és,
 *   doncs, la variació d'altitud cap a l'est, i dzdy cap al nord.
 */
export function calcularGradients(graella, altitudsGraella, distanciaMetres) {
  const altitudA = (f, c, perDefecte) => {
    const valor = altitudsGraella[f]?.[c];
    return valor == null ? perDefecte : valor;
  };

  const gradients = [];
  for (let f = 0; f < graella.length; f++) {
    for (let c = 0; c < graella[f].length; c++) {
      const centre = altitudsGraella[f]?.[c];
      if (centre == null) continue;

      // Quan un veí no existeix (vora de la malla o fora del
      // perímetre), es fa servir el propi valor central -- conveni
      // habitual en processament de models de terreny per no introduir
      // cap biaix als límits.
      const nord = altitudA(f + 1, c, centre);
      const sud = altitudA(f - 1, c, centre);
      const est = altitudA(f, c + 1, centre);
      const oest = altitudA(f, c - 1, centre);
      const nordEst = altitudA(f + 1, c + 1, centre);
      const nordOest = altitudA(f + 1, c - 1, centre);
      const sudEst = altitudA(f - 1, c + 1, centre);
      const sudOest = altitudA(f - 1, c - 1, centre);

      const dzdx =
        (nordEst + 2 * est + sudEst - (nordOest + 2 * oest + sudOest)) / (8 * distanciaMetres);
      const dzdy =
        (nordOest + 2 * nord + nordEst - (sudOest + 2 * sud + sudEst)) / (8 * distanciaMetres);

      gradients.push({ fila: f, columna: c, dzdx, dzdy });
    }
  }
  return gradients;
}
