// Exportació d'una zona a una resolució triada i, si cal, en diverses
// peces (mosaic) que encaixen: una sola graella d'alçades de tota la zona
// (demanada a trossos si és gran), tallada en files i columnes. Totes les
// peces fan servir la mateixa graella, i per tant la mateixa escala
// vertical; l'app hi aplica la mateixa cota de base (vegeu rangAltituds).
//
// Les peces es tallen en el marc de la zona: el de la seva vora, si és un
// rectangle girat (zona.rotacio), de manera que les files van d'oest a
// est i les columnes de sud a nord un cop desfet el gir.
//  - Quadrilàter (rectangle, o una peça de quatre costats): es talla en
//    els paràmetres de la seva graella bilineal, i cada peça és un altre
//    quadrilàter, exacte i sense cap llibreria.
//  - Qualsevol altra forma: retall poligonal amb polygon-clipping (global
//    polygonClipping, carregada per <script>), que admet forats i peces
//    que queden partides en diversos trossos.
//
// Sense UI: l'app hi posa la finestra d'exportació i el progrés.

import { Terreny } from '../geometria/terreny.js';
import { construirModel, girarModel } from '../geometria/solid.js';
import { areaPart, limitsDeParts, netejarAnell, orientarAnell } from '../geometria/poligon.js';
import { fontIGN, fontMundial, fontPer } from './fontsDades.js';

// Costat màxim (en cel·les) de cada petició de la graella: el WCS de l'IGN
// retorna text (8,6 MB per a 1000 × 1000 cel·les, 140 MB per a 4000 ×
// 4000, comprovat el 2026-10-29); a trossos, la memòria no es dispara.
export const CELLES_MAXIMES_PETICIO = 1000;

// Si més d'aquesta part de la graella de l'IGN ve buida, la zona surt de
// la seva cobertura i es torna a demanar amb dades mundials.
const FRACCIO_BUIDA_MAXIMA = 0.05;

/** Superfície de la zona en m² (sense els forats). */
export function areaZona(parts) {
  return parts.reduce((acc, part) => acc + areaPart(part), 0);
}

/**
 * Cert si la zona és un sol quadrilàter convex sense forats (un rectangle):
 * es construeix com a graella directa, sense poly2tri, i admet molts més
 * punts amb la mateixa memòria.
 */
export function esZonaQuadrilater(parts) {
  if (parts.length !== 1 || (parts[0].interiors ?? []).length) return false;
  const anell = orientarAnell(netejarAnell(parts[0].exterior), true);
  if (anell.length !== 4) return false;
  return anell.every(([ax, ay], i) => {
    const [bx, by] = anell[(i + 1) % 4];
    const [cx, cy] = anell[(i + 2) % 4];
    return (bx - ax) * (cy - by) - (by - ay) * (cx - bx) > 0;
  });
}

/** El pas més fi que té sentit per a la zona (el de les dades del lloc). */
export function pasMinimZona(zona) {
  return fontPer(zona).pasMinim;
}

/**
 * Pas final i punts que tindrà el model. Els punts es compten com la
 * superfície dividida pel pas al quadrat; si passen del màxim, el pas
 * puja fins a quedar-s'hi (arrodonit a dècimes de metre, cap amunt).
 *
 * @returns {{pas: number, punts: number, retallat: boolean}}
 */
export function ajustarPas(parts, pasDemanat, maximPunts) {
  const area = areaZona(parts);
  let pas = pasDemanat;
  let retallat = false;
  if (area / (pas * pas) > maximPunts) {
    pas = Math.ceil(Math.sqrt(area / maximPunts) * 10) / 10;
    retallat = true;
  }
  return { pas, punts: Math.round(area / (pas * pas)), retallat };
}

/** Font de dades a partir del seu id ('ign' o 'mon'). */
export function fontDeId(id, crs) {
  return id === 'mon' ? fontMundial(crs) : fontIGN(crs);
}

/**
 * Graella d'altituds d'un requadre, demanada en trossos de com a molt
 * CELLES_MAXIMES_PETICIO per costat i ajuntada en una de sola (la primera
 * fila és la del nord, com la de ServeiMDT).
 */
export async function graellaPerTrossos(font, requadre, pas, onTros = () => {}) {
  const ncols = Math.max(2, Math.ceil((requadre.maxX - requadre.minX) / pas));
  const nrows = Math.max(2, Math.ceil((requadre.maxY - requadre.minY) / pas));
  const xll = requadre.minX;
  const yTop = requadre.minY + nrows * pas;
  const valors = new Float32Array(ncols * nrows);
  const passos = Math.ceil(ncols / CELLES_MAXIMES_PETICIO) * Math.ceil(nrows / CELLES_MAXIMES_PETICIO);
  let fets = 0;
  let buides = 0;

  for (let r0 = 0; r0 < nrows; r0 += CELLES_MAXIMES_PETICIO) {
    const r1 = Math.min(nrows, r0 + CELLES_MAXIMES_PETICIO);
    for (let c0 = 0; c0 < ncols; c0 += CELLES_MAXIMES_PETICIO) {
      const c1 = Math.min(ncols, c0 + CELLES_MAXIMES_PETICIO);
      const tros = await font.graella(
        { minX: xll + c0 * pas, maxX: xll + c1 * pas, minY: yTop - r1 * pas, maxY: yTop - r0 * pas },
        pas
      );
      // On cau el tros dins de la graella sencera (per les seves
      // coordenades, per si el servei hi ha afegit una cel·la de més).
      const dc = Math.round((tros.xll - xll) / pas);
      const dr = Math.round((yTop - (tros.yll + tros.nrows * tros.cellsize)) / pas);
      for (let f = 0; f < tros.nrows; f++) {
        const fila = dr + f;
        if (fila < 0 || fila >= nrows) continue;
        for (let c = 0; c < tros.ncols; c++) {
          const columna = dc + c;
          if (columna < 0 || columna >= ncols) continue;
          valors[fila * ncols + columna] = tros.valors[f * tros.ncols + c];
        }
      }
      buides += (tros.fraccioBuida ?? 0) * tros.ncols * tros.nrows;
      onTros(++fets, passos);
    }
  }
  return { ncols, nrows, xll, yll: yTop - nrows * pas, cellsize: pas, valors, fraccioBuida: buides / (ncols * nrows) };
}

/**
 * Prepara l'exportació: demana la graella de tota la zona i talla la zona
 * en peces. Les peces es construeixen després, d'una en una
 * (construirPeca), perquè no calgui tenir-les totes en memòria.
 *
 * @param {{parts: Array, crs?: string, rotacio?: number, coordenades?: Array}} zona
 * @param {{pas: number, files?: number, columnes?: number, fontId?: string,
 *   onProgres?: (fase: 'terreny', fet: number, total: number) => void}} opcions
 * @returns {Promise<{terreny: Terreny, pas: number, rotacio: number, font: object,
 *   peces: Array<{fila: number, columna: number, parts: Array}>, files: number, columnes: number}>}
 *   fila 1 és la del nord i columna 1 la de l'oest.
 */
export async function prepararMosaic(zona, { pas, files = 1, columnes = 1, fontId, onProgres = () => {} }) {
  const crs = zona.crs ?? 'EPSG:25830';
  let font = fontId ? fontDeId(fontId, crs) : fontPer(zona);
  const limits = limitsDeParts(zona.parts);
  const marge = pas * 2;
  const requadre = { minX: limits.minX - marge, minY: limits.minY - marge, maxX: limits.maxX + marge, maxY: limits.maxY + marge };
  const demanar = (f) => graellaPerTrossos(f, requadre, Math.max(pas, f.pasMinim), (fet, total) => onProgres('terreny', fet, total));

  let graella = await demanar(font).catch((error) => {
    if (font.id === 'mon') throw error;
    return null;
  });
  if (!graella || graella.fraccioBuida > FRACCIO_BUIDA_MAXIMA) {
    font = fontMundial(crs);
    graella = await demanar(font);
  }

  return {
    terreny: new Terreny(graella),
    pas: graella.cellsize,
    rotacio: zona.rotacio ?? 0,
    font: { id: font.id, etiqueta: font.etiqueta, atribucio: font.atribucio },
    peces: tallarEnPeces(zona.parts, zona.rotacio ?? 0, files, columnes),
    files,
    columnes,
  };
}

/** Model d'una peça (ja girat si la zona ho estava), llest per exportar. */
export function construirPeca(preparat, peca) {
  const model = construirModel(peca.parts, preparat.terreny, preparat.pas);
  return preparat.rotacio ? girarModel(model, -preparat.rotacio) : model;
}

/**
 * Mides de la zona en el seu marc (sense el gir), en metres: amplada
 * (oest-est) i fondària (sud-nord). Serveixen per a l'escala comuna.
 */
export function midesMarc(parts, rotacio = 0) {
  const { aMarc } = marc(parts, rotacio);
  const punts = parts.flatMap((p) => p.exterior).map(aMarc);
  const xs = punts.map(([x]) => x);
  const ys = punts.map(([, y]) => y);
  return { ample: Math.max(...xs) - Math.min(...xs), fons: Math.max(...ys) - Math.min(...ys) };
}

/**
 * Anells de la zona en el seu marc, en metres des de la cantonada
 * sud-oest (per dibuixar-ne el contorn en un pla, amb el nord amunt).
 */
export function contornMarc(parts, rotacio = 0) {
  const { aMarc } = marc(parts, rotacio);
  const anells = parts.flatMap((p) => [p.exterior, ...(p.interiors ?? [])]).map((anell) => anell.map(aMarc));
  const punts = anells.flat();
  const minU = Math.min(...punts.map(([u]) => u));
  const minV = Math.min(...punts.map(([, v]) => v));
  return anells.map((anell) => anell.map(([u, v]) => [u - minU, v - minV]));
}

/** Transformacions entre UTM i el marc de la zona (gir al voltant del seu centre). */
function marc(parts, rotacio) {
  const { minX, minY, maxX, maxY } = limitsDeParts(parts);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cos = Math.cos(rotacio);
  const sin = Math.sin(rotacio);
  return {
    // UTM -> marc: es desfà el gir.
    aMarc: ([x, y]) => [(x - cx) * cos + (y - cy) * sin, -(x - cx) * sin + (y - cy) * cos],
    // Marc -> UTM.
    aUtm: ([u, v]) => [cx + u * cos - v * sin, cy + u * sin + v * cos],
  };
}

/** Talla la zona en files × columnes; les peces buides (zones còncaves) no hi són. */
export function tallarEnPeces(parts, rotacio, files, columnes) {
  if (files === 1 && columnes === 1) return [{ fila: 1, columna: 1, parts }];
  const { aMarc, aUtm } = marc(parts, rotacio);

  // Quadrilàter: es talla en els paràmetres de la seva graella bilineal.
  if (parts.length === 1 && !(parts[0].interiors ?? []).length) {
    const anell = orientarAnell(netejarAnell(parts[0].exterior), true).map(aMarc);
    if (anell.length === 4) {
      // Cantonada sud-oest (en el marc) primer, i després en sentit antihorari.
      const inici = anell.reduce((millor, [x, y], i) => (x + y < anell[millor][0] + anell[millor][1] ? i : millor), 0);
      const [p0, p1, p2, p3] = [0, 1, 2, 3].map((k) => anell[(inici + k) % 4]);
      const punt = (s, t) => [
        (1 - s) * (1 - t) * p0[0] + s * (1 - t) * p1[0] + s * t * p2[0] + (1 - s) * t * p3[0],
        (1 - s) * (1 - t) * p0[1] + s * (1 - t) * p1[1] + s * t * p2[1] + (1 - s) * t * p3[1],
      ];
      const peces = [];
      for (let f = 0; f < files; f++) {
        // f = 0 és la fila del nord.
        const t0 = (files - f - 1) / files;
        const t1 = (files - f) / files;
        for (let c = 0; c < columnes; c++) {
          const s0 = c / columnes;
          const s1 = (c + 1) / columnes;
          const exterior = [punt(s0, t0), punt(s1, t0), punt(s1, t1), punt(s0, t1)].map(aUtm);
          peces.push({ fila: f + 1, columna: c + 1, parts: [{ exterior, interiors: [] }] });
        }
      }
      return peces;
    }
  }

  // Qualsevol altra forma: retall poligonal en el marc.
  const pc = globalThis.polygonClipping;
  if (!pc) throw new Error('tallarEnPeces: cal carregar polygon-clipping');
  const tancar = (anell) => [...anell, anell[0]];
  const enMarc = parts.map((p) => [tancar(p.exterior.map(aMarc)), ...(p.interiors ?? []).map((a) => tancar(a.map(aMarc)))]);
  const punts = enMarc.flat(2);
  const minU = Math.min(...punts.map(([u]) => u));
  const maxU = Math.max(...punts.map(([u]) => u));
  const minV = Math.min(...punts.map(([, v]) => v));
  const maxV = Math.max(...punts.map(([, v]) => v));
  const ample = (maxU - minU) / columnes;
  const alt = (maxV - minV) / files;

  const peces = [];
  for (let f = 0; f < files; f++) {
    const v1 = maxV - f * alt;
    const v0 = f === files - 1 ? minV : v1 - alt;
    for (let c = 0; c < columnes; c++) {
      const u0 = minU + c * ample;
      const u1 = c === columnes - 1 ? maxU : u0 + ample;
      const cella = [[[u0, v0], [u1, v0], [u1, v1], [u0, v1], [u0, v0]]];
      const resultat = pc.intersection(enMarc, cella);
      const partsPeca = resultat.map(([exterior, ...interiors]) => ({
        exterior: exterior.slice(0, -1).map(aUtm),
        interiors: interiors.map((anell) => anell.slice(0, -1).map(aUtm)),
      }));
      if (partsPeca.length) peces.push({ fila: f + 1, columna: c + 1, parts: partsPeca });
    }
  }
  return peces;
}
