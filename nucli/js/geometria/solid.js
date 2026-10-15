// Construeix el model 3D d'una zona (una o diverses parts, amb forats si
// n'hi ha) a partir del seu perímetre i d'un Terreny. Pura geometria:
// res de Three.js ni del DOM, perquè el mateix model serveixi tant per
// al visor com per als exportadors (STL, OBJ).
//
// Per què una triangulació restringida (poly2tri) i no la malla de
// quadrats que fa servir Custòdia: la malla de quadrats acaba en
// "escala" a la vora i no coincideix amb el perímetre real. Aquí la
// superfície superior es triangula fent servir COM A VORA el perímetre
// exacte (densificat) i, com a punts interiors, els nodes d'una graella
// regular. Resultat: el contorn és el del Cadastre/dibuix, i l'interior
// segueix el relleu amb el pas triat.
//
// Sòlid tancat (imprimible): la superfície superior, una paret vertical
// per cada costat del perímetre (i de cada forat) i una base plana. La
// paret i la superfície comparteixen exactament els mateixos vèrtexs, i
// la base es triangula amb els mateixos punts del perímetre, de manera
// que no queda cap escletxa: cada aresta pertany a dos triangles i
// prou (es comprova a les proves).
//
// Conveni de coordenades del model: x = est, y = nord, z = amunt
// (metres UTM i altitud real). La conversió a l'espai de Three.js
// (Y amunt, Z = -nord) la fa el visor, no aquest mòdul.

import {
  netejarAnell,
  orientarAnell,
  densificarAnell,
  puntDinsPart,
  distanciaAAnell,
} from './poligon.js';

// Un node de la graella massa a prop del perímetre crearia triangles
// gairebé degenerats (molt prims) entre ell i la vora: es descarta.
const MARGE_RELATIU_VORA = 0.3;

/**
 * @param {Array<{exterior: Array<[number, number]>, interiors?: Array<Array<[number, number]>>}>} parts En metres UTM
 * @param {import('./terreny.js').Terreny} terreny
 * @param {number} pasMetres Separació dels punts interiors (i màxima entre punts del perímetre)
 * @param {object} [p2t] Llibreria poly2tri (per defecte, la global carregada per <script>)
 * @returns {{vertexs: Float64Array, superior: Uint32Array, inferior: Uint32Array, anells: Uint32Array[], altitudMinima: number, altitudMaxima: number, limits: {minX: number, minY: number, maxX: number, maxY: number}}}
 */
export function construirModel(parts, terreny, pasMetres, p2t = globalThis.poly2tri) {
  if (!p2t) throw new Error('construirModel: cal carregar poly2tri');
  if (!(pasMetres > 0)) throw new Error('construirModel: el pas ha de ser positiu');

  const vertexs = [];
  const superior = [];
  const inferior = [];
  const anells = [];

  const nouVertex = (x, y) => {
    vertexs.push(x, y, terreny.altitud(x, y));
    return vertexs.length / 3 - 1;
  };

  for (const part of parts) {
    const exterior = densificarAnell(orientarAnell(netejarAnell(part.exterior), true), pasMetres);
    const interiors = (part.interiors ?? [])
      .map((anell) => netejarAnell(anell))
      .filter((anell) => anell.length >= 3)
      .map((anell) => densificarAnell(orientarAnell(anell, false), pasMetres));
    if (exterior.length < 3) continue;

    // Índexs dels vèrtexs del perímetre: els comparteixen la superfície,
    // les parets i la base.
    const indexsExterior = exterior.map(([x, y]) => nouVertex(x, y));
    const indexsInteriors = interiors.map((anell) => anell.map(([x, y]) => nouVertex(x, y)));
    anells.push(Uint32Array.from(indexsExterior));
    indexsInteriors.forEach((indexs) => anells.push(Uint32Array.from(indexs)));

    const aPunts = (anell, indexs) => anell.map(([x, y], i) => ({ x, y, idx: indexs[i] }));

    // Superfície superior: perímetre + forats + nodes interiors.
    const contextSuperior = new p2t.SweepContext(aPunts(exterior, indexsExterior));
    interiors.forEach((anell, i) => contextSuperior.addHole(aPunts(anell, indexsInteriors[i])));
    contextSuperior.addPoints(nodesInteriors({ exterior, interiors }, pasMetres, nouVertex));
    contextSuperior.triangulate();
    afegirTriangles(contextSuperior.getTriangles(), vertexs, superior, true);

    // Base: el mateix contorn, sense nodes interiors (és plana). Calen
    // objectes punt nous: poly2tri hi desa informació interna.
    const contextInferior = new p2t.SweepContext(aPunts(exterior, indexsExterior));
    interiors.forEach((anell, i) => contextInferior.addHole(aPunts(anell, indexsInteriors[i])));
    contextInferior.triangulate();
    afegirTriangles(contextInferior.getTriangles(), vertexs, inferior, false);
  }

  if (superior.length === 0) {
    throw new Error('construirModel: la zona no té cap superfície vàlida');
  }

  const v = Float64Array.from(vertexs);
  let altitudMinima = Infinity;
  let altitudMaxima = -Infinity;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < v.length; i += 3) {
    minX = Math.min(minX, v[i]);
    maxX = Math.max(maxX, v[i]);
    minY = Math.min(minY, v[i + 1]);
    maxY = Math.max(maxY, v[i + 1]);
    altitudMinima = Math.min(altitudMinima, v[i + 2]);
    altitudMaxima = Math.max(altitudMaxima, v[i + 2]);
  }

  return {
    vertexs: v,
    superior: Uint32Array.from(superior),
    inferior: Uint32Array.from(inferior),
    anells,
    altitudMinima,
    altitudMaxima,
    limits: { minX, minY, maxX, maxY },
  };
}

/** Nodes d'una graella regular (alineada a múltiples del pas) que cauen dins de la part i prou lluny de la vora. */
function nodesInteriors(part, pas, nouVertex) {
  const xs = part.exterior.map(([x]) => x);
  const ys = part.exterior.map(([, y]) => y);
  const totsElsAnells = [part.exterior, ...part.interiors];
  const margeMinim = pas * MARGE_RELATIU_VORA;
  const nodes = [];

  for (let x = Math.ceil(Math.min(...xs) / pas) * pas; x < Math.max(...xs); x += pas) {
    for (let y = Math.ceil(Math.min(...ys) / pas) * pas; y < Math.max(...ys); y += pas) {
      if (!puntDinsPart([x, y], part)) continue;
      if (totsElsAnells.some((anell) => distanciaAAnell([x, y], anell) < margeMinim)) continue;
      nodes.push({ x, y, idx: nouVertex(x, y) });
    }
  }
  return nodes;
}

/**
 * Afegeix els triangles de poly2tri a la llista d'índexs, amb
 * l'orientació demanada vista des de dalt (antihorari = normal cap
 * amunt, per a la superfície; horari = normal cap avall, per a la base).
 * No es dona per fet l'ordre en què poly2tri retorna els vèrtexs: es
 * comprova amb el producte vectorial de cada triangle.
 */
function afegirTriangles(triangles, vertexs, desti, antihorari) {
  for (const triangle of triangles) {
    const [a, b, c] = [0, 1, 2].map((i) => triangle.getPoint(i).idx);
    const ax = vertexs[a * 3];
    const ay = vertexs[a * 3 + 1];
    const creu =
      (vertexs[b * 3] - ax) * (vertexs[c * 3 + 1] - ay) - (vertexs[c * 3] - ax) * (vertexs[b * 3 + 1] - ay);
    if (creu > 0 === antihorari) desti.push(a, b, c);
    else desti.push(a, c, b);
  }
}

/**
 * Converteix el model en una llista plana de triangles (9 nombres per
 * triangle: x,y,z dels tres vèrtexs), ja transformats i amb les parets i
 * la base afegides. Els primers `nSuperficie` triangles són la superfície
 * superior (útil per pintar-la diferent de les parets al visor).
 *
 * L'orientació de tots els triangles és cap enfora del sòlid, sempre que
 * `transformar` no sigui un mirall (els que fem servir són rotacions i
 * escalats positius).
 *
 * @param {ReturnType<typeof construirModel>} model
 * @param {{transformar: (x: number, y: number, z: number) => [number, number, number], zBase: number, ambLaterals?: boolean}} opcions
 *   zBase és l'alçada de la base JA en l'espai transformat (z del model).
 */
export function trianglesModel(model, { transformar, zBase, ambLaterals = true }) {
  const n = model.vertexs.length / 3;
  const dalt = new Float64Array(n * 3);
  const baix = new Float64Array(n * 3);
  for (let i = 0; i < n; i++) {
    const [x, y, z] = transformar(model.vertexs[i * 3], model.vertexs[i * 3 + 1], model.vertexs[i * 3 + 2]);
    dalt.set([x, y, z], i * 3);
    baix.set([x, y, zBase], i * 3);
  }

  const nParets = ambLaterals ? model.anells.reduce((acc, anell) => acc + anell.length * 2, 0) : 0;
  const nInferior = ambLaterals ? model.inferior.length / 3 : 0;
  const nSuperficie = model.superior.length / 3;
  const posicions = new Float32Array((nSuperficie + nParets + nInferior) * 9);
  let cursor = 0;
  const afegir = (font, i) => {
    posicions[cursor++] = font[i * 3];
    posicions[cursor++] = font[i * 3 + 1];
    posicions[cursor++] = font[i * 3 + 2];
  };

  for (let k = 0; k < model.superior.length; k++) afegir(dalt, model.superior[k]);

  if (ambLaterals) {
    // Paret de cada costat a->b: amb l'exterior antihorari (i els forats
    // horaris), la normal de (a0, b0, bT) apunta a la dreta del sentit
    // a->b, és a dir, cap enfora del sòlid.
    for (const anell of model.anells) {
      for (let i = 0; i < anell.length; i++) {
        const a = anell[i];
        const b = anell[(i + 1) % anell.length];
        afegir(baix, a); afegir(baix, b); afegir(dalt, b);
        afegir(baix, a); afegir(dalt, b); afegir(dalt, a);
      }
    }
    for (let k = 0; k < model.inferior.length; k++) afegir(baix, model.inferior[k]);
  }

  return { posicions, nSuperficie, nTriangles: posicions.length / 9 };
}
