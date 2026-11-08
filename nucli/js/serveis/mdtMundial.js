// Relleu de qualsevol lloc del món a partir de les "Terrain Tiles"
// públiques d'AWS (format Terrarium): tessel·les PNG de 256 px en Web
// Mercator, on cada píxel codifica una altitud en metres:
//     altitud = R × 256 + G + B / 256 − 32768
// Gratuïtes, sense clau i amb CORS (comprovat el 2026-10-17), fins al
// zoom 15. Combinen diverses fonts (SRTM, ASTER, EU-DEM, 3DEP als EUA,
// GEBCO al mar...): la resolució real és d'uns 30 m a la major part del
// món, millor en alguns països. Al mar hi ha la batimetria (altituds
// negatives), i es deixa tal qual: és el relleu real.
//
// El resultat és la mateixa graella que dona ServeiMDT (l'IGN), en el
// sistema UTM de la zona: cada node de la graella es converteix a lat/lng,
// i se'n mostreja l'altitud de les tessel·les amb interpolació bilineal.

import { utmALatLng } from '../geometria/projeccio.js';

const URL_TESSELES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium';
const MIDA_TESSELA = 256;
const ZOOM_MAXIM = 15;
const MAXIM_TESSELES = 64;
const CIRCUMFERENCIA_TERRA = 40075016.686;

export function alcadaTerrarium(r, g, b) {
  return r * 256 + g + b / 256 - 32768;
}

/** Posició global en píxels (no enters) d'un punt a un zoom, en Web Mercator. */
export function latLngAPixel([lat, lng], zoom) {
  const mida = MIDA_TESSELA * 2 ** zoom;
  const latLimitada = Math.max(-85.0511, Math.min(85.0511, lat));
  const sinus = Math.sin((latLimitada * Math.PI) / 180);
  return [
    ((lng + 180) / 360) * mida,
    (0.5 - Math.log((1 + sinus) / (1 - sinus)) / (4 * Math.PI)) * mida,
  ];
}

/** El zoom més baix amb píxels d'una mida igual o inferior al pas (a aquesta latitud). */
export function zoomPer(pasMetres, lat) {
  const metresPerPixelZoom0 = (CIRCUMFERENCIA_TERRA * Math.cos((lat * Math.PI) / 180)) / MIDA_TESSELA;
  const zoom = Math.ceil(Math.log2(metresPerPixelZoom0 / pasMetres));
  return Math.max(0, Math.min(ZOOM_MAXIM, zoom));
}

async function carregarTesselaPerDefecte(z, x, y) {
  const resposta = await fetch(`${URL_TESSELES}/${z}/${x}/${y}.png`);
  if (!resposta.ok) throw new Error(`tessel·la ${z}/${x}/${y}: ${resposta.status}`);
  const imatge = await createImageBitmap(await resposta.blob());
  const llenc =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(MIDA_TESSELA, MIDA_TESSELA)
      : Object.assign(document.createElement('canvas'), { width: MIDA_TESSELA, height: MIDA_TESSELA });
  const context = llenc.getContext('2d', { willReadFrequently: true });
  context.drawImage(imatge, 0, 0);
  const { data } = context.getImageData(0, 0, MIDA_TESSELA, MIDA_TESSELA);
  const alcades = new Float32Array(MIDA_TESSELA * MIDA_TESSELA);
  for (let i = 0; i < alcades.length; i++) {
    alcades[i] = alcadaTerrarium(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
  }
  return alcades;
}

export class ServeiMDTMundial {
  /**
   * Mateixa interfície que ServeiMDT.consultarGraella, més el sistema de
   * coordenades del requadre.
   *
   * @param {{minX: number, minY: number, maxX: number, maxY: number}} requadre
   * @param {number} pasMetres
   * @param {string} crs
   * @param {{carregarTessela?: (z: number, x: number, y: number) => Promise<Float32Array>}} [opcions]
   *   carregarTessela: només per a les proves (permet passar tessel·les sintètiques).
   */
  static async consultarGraella(requadre, pasMetres, crs, { carregarTessela = carregarTesselaPerDefecte } = {}) {
    const ncols = Math.max(2, Math.ceil((requadre.maxX - requadre.minX) / pasMetres));
    const nrows = Math.max(2, Math.ceil((requadre.maxY - requadre.minY) / pasMetres));
    const yTop = requadre.minY + nrows * pasMetres;

    // Lat/lng del centre de cada cel·la (fila 0 = nord, com a l'ASCII Grid).
    const nodes = new Array(ncols * nrows);
    for (let f = 0; f < nrows; f++) {
      for (let c = 0; c < ncols; c++) {
        nodes[f * ncols + c] = utmALatLng(
          [requadre.minX + (c + 0.5) * pasMetres, yTop - (f + 0.5) * pasMetres],
          crs
        );
      }
    }
    const latMitjana = nodes.reduce((acc, [lat]) => acc + lat, 0) / nodes.length;

    // Zoom: el que dona píxels prou petits, rebaixat si calen massa tessel·les.
    let zoom = zoomPer(pasMetres, latMitjana);
    let rang;
    for (;;) {
      // Amb un bucle i no amb Math.min(...xs): una graella gran (Terra
      // Visibilitat en demana de 600 × 600) passa del límit d'arguments
      // d'una crida i llança un RangeError.
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const node of nodes) {
        const [x, y] = latLngAPixel(node, zoom);
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      rang = {
        tx0: Math.floor((minX - 1) / MIDA_TESSELA),
        tx1: Math.floor((maxX + 1) / MIDA_TESSELA),
        ty0: Math.floor((minY - 1) / MIDA_TESSELA),
        ty1: Math.floor((maxY + 1) / MIDA_TESSELA),
      };
      const nombre = (rang.tx1 - rang.tx0 + 1) * (rang.ty1 - rang.ty0 + 1);
      if (nombre <= MAXIM_TESSELES || zoom === 0) break;
      zoom--;
    }

    // Mosaic de totes les tessel·les en una sola matriu.
    const tessellesAmple = rang.tx1 - rang.tx0 + 1;
    const tessellesAlt = rang.ty1 - rang.ty0 + 1;
    const ampleMosaic = tessellesAmple * MIDA_TESSELA;
    const altMosaic = tessellesAlt * MIDA_TESSELA;
    const mosaic = new Float32Array(ampleMosaic * altMosaic);
    const totalX = 2 ** zoom;
    const peticions = [];
    for (let ty = rang.ty0; ty <= rang.ty1; ty++) {
      for (let tx = rang.tx0; tx <= rang.tx1; tx++) {
        // Al voltant de l'antimeridià, la x de la tessel·la dona la volta.
        const xReal = ((tx % totalX) + totalX) % totalX;
        peticions.push(
          carregarTessela(zoom, xReal, ty).then((alcades) => {
            const ox = (tx - rang.tx0) * MIDA_TESSELA;
            const oy = (ty - rang.ty0) * MIDA_TESSELA;
            for (let f = 0; f < MIDA_TESSELA; f++) {
              mosaic.set(alcades.subarray(f * MIDA_TESSELA, (f + 1) * MIDA_TESSELA), (oy + f) * ampleMosaic + ox);
            }
          })
        );
      }
    }
    try {
      await Promise.all(peticions);
    } catch (error) {
      throw new Error(`ServeiMDTMundial: no s'ha pogut consultar el relleu (${error.message})`);
    }

    // Mostreig bilineal: el valor d'un píxel correspon al seu centre.
    const valor = (px, py) => {
      const x = Math.max(0, Math.min(ampleMosaic - 1, px));
      const y = Math.max(0, Math.min(altMosaic - 1, py));
      return mosaic[y * ampleMosaic + x];
    };
    const valors = new Float32Array(ncols * nrows);
    nodes.forEach((node, i) => {
      const [gx, gy] = latLngAPixel(node, zoom);
      const fx = gx - rang.tx0 * MIDA_TESSELA - 0.5;
      const fy = gy - rang.ty0 * MIDA_TESSELA - 0.5;
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const tx = fx - x0;
      const ty = fy - y0;
      valors[i] =
        valor(x0, y0) * (1 - tx) * (1 - ty) +
        valor(x0 + 1, y0) * tx * (1 - ty) +
        valor(x0, y0 + 1) * (1 - tx) * ty +
        valor(x0 + 1, y0 + 1) * tx * ty;
    });

    return { ncols, nrows, xll: requadre.minX, yll: requadre.minY, cellsize: pasMetres, valors, fraccioBuida: 0, zoom };
  }
}
