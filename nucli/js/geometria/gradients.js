// Pendent i orientació de cada cel·la d'una graella d'altituds (la del MDT,
// vegeu serveis/mdt.js), amb el mètode de Horn (1981): el mateix que fan
// servir QGIS, GDAL i ArcGIS. Càlcul pur, sense UI ni serveis externs;
// compartit per Terra Anàlisi i, més endavant, Visibilitat i Sol.
//
// Per a cada cel·la es miren les 8 veïnes, amb el doble de pes per a les
// quatre del costat (N, S, E, O) que per a les de la diagonal:
//
//     a b c        dz/dx (cap a l'est)  = ((c + 2f + i) - (a + 2d + g)) / (8·pas)
//     d e f        dz/dy (cap al nord)  = ((a + 2b + c) - (g + 2h + i)) / (8·pas)
//     g h i
//
// La fila 0 de la graella és la del NORD (com l'ESRI ASCII Grid), per això
// "a b c" són les veïnes de la fila de dalt (al nord) i "g h i" les de sota.
// A la vora de la graella, la veïna que falta es substitueix per la cel·la
// mateixa; les apps demanen la graella amb marge perquè no passi dins la zona.

// Per sota d'aquest pendent (%) una cel·la es considera plana: no té
// orientació. És el mateix criteri que fan servir molts SIG (alguns hi posen
// 0 exacte, cosa que deixa sense sentit l'orientació de cel·les gairebé
// planes on mana el soroll del MDT).
export const PENDENT_PLA = 2;

/**
 * @param {{ncols: number, nrows: number, cellsize: number, valors: ArrayLike<number>}} graella
 * @returns {{pendents: Float32Array, orientacions: Float32Array}}
 *   pendents en %, orientacions en graus des del nord en sentit horari (cap
 *   on "mira" la pendent, és a dir, cap on baixa l'aigua); NaN si és plana.
 */
export function gradientsHorn({ ncols, nrows, cellsize, valors }) {
  const pendents = new Float32Array(ncols * nrows);
  const orientacions = new Float32Array(ncols * nrows);
  const z = (fila, columna) =>
    valors[Math.max(0, Math.min(nrows - 1, fila)) * ncols + Math.max(0, Math.min(ncols - 1, columna))];

  for (let f = 0; f < nrows; f++) {
    for (let c = 0; c < ncols; c++) {
      const a = z(f - 1, c - 1);
      const b = z(f - 1, c);
      const cc = z(f - 1, c + 1);
      const d = z(f, c - 1);
      const ff = z(f, c + 1);
      const g = z(f + 1, c - 1);
      const h = z(f + 1, c);
      const i = z(f + 1, c + 1);
      const dzdx = (cc + 2 * ff + i - (a + 2 * d + g)) / (8 * cellsize);
      const dzdy = (a + 2 * b + cc - (g + 2 * h + i)) / (8 * cellsize);
      const pendent = Math.hypot(dzdx, dzdy) * 100;
      const k = f * ncols + c;
      pendents[k] = pendent;
      // L'aigua baixa en el sentit contrari al gradient: (-dzdx, -dzdy).
      // atan2(est, nord) dona l'azimut des del nord en sentit horari.
      orientacions[k] = pendent < PENDENT_PLA ? NaN : (Math.atan2(-dzdx, -dzdy) * 180) / Math.PI + 360;
      if (orientacions[k] >= 360) orientacions[k] -= 360;
    }
  }
  return { pendents, orientacions };
}

/** Les 8 orientacions principals, en l'ordre de la rosa dels vents. */
export const ORIENTACIONS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];

/** Índex (0-7) de l'orientació principal d'un azimut en graus; -1 si és pla (NaN). */
export function sectorOrientacio(graus) {
  if (Number.isNaN(graus)) return -1;
  return Math.floor((((graus + 22.5) % 360) + 360) % 360 / 45);
}
