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
    // Quadrilàter convex sense forats (rectangles i peces de mosaic): graella
    // directa, sense poly2tri, que gasta molta menys memòria.
    const net = orientarAnell(netejarAnell(part.exterior), true);
    if (!(part.interiors ?? []).length && esQuadrilaterConvex(net)) {
      afegirQuadrilater(net, pasMetres, nouVertex, vertexs, superior, inferior, anells);
      continue;
    }
    const exterior = densificarAnell(net, pasMetres);
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

/** Cert si l'anell (antihorari, sense repetir el primer punt) té 4 vèrtexs i és convex. */
function esQuadrilaterConvex(anell) {
  if (anell.length !== 4) return false;
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = anell[i];
    const [bx, by] = anell[(i + 1) % 4];
    const [cx, cy] = anell[(i + 2) % 4];
    if ((bx - ax) * (cy - by) - (by - ay) * (cx - bx) <= 0) return false;
  }
  return true;
}

/**
 * Un quadrilàter convex com a graella bilineal: els vèrtexs es reparteixen
 * per igual al llarg de cada costat (amb el pas com a separació màxima), la
 * superfície són dos triangles per cel·la, i la base un ventall des d'un
 * punt central (que només fa servir la base). Sense poly2tri: per a un
 * milió de punts, unes desenes de MB en lloc d'un GB.
 */
function afegirQuadrilater([p0, p1, p2, p3], pas, nouVertex, vertexs, superior, inferior, anells) {
  const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  const nu = Math.max(1, Math.ceil(Math.max(dist(p0, p1), dist(p3, p2)) / pas));
  const nv = Math.max(1, Math.ceil(Math.max(dist(p0, p3), dist(p1, p2)) / pas));
  const punt = (s, t) => [
    (1 - s) * (1 - t) * p0[0] + s * (1 - t) * p1[0] + s * t * p2[0] + (1 - s) * t * p3[0],
    (1 - s) * (1 - t) * p0[1] + s * (1 - t) * p1[1] + s * t * p2[1] + (1 - s) * t * p3[1],
  ];
  const indexs = new Uint32Array((nu + 1) * (nv + 1));
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) indexs[j * (nu + 1) + i] = nouVertex(...punt(i / nu, j / nv));
  }
  const idx = (i, j) => indexs[j * (nu + 1) + i];
  const triangle = (desti, antihorari, a, b, c) => {
    const ax = vertexs[a * 3];
    const ay = vertexs[a * 3 + 1];
    const creu = (vertexs[b * 3] - ax) * (vertexs[c * 3 + 1] - ay) - (vertexs[c * 3] - ax) * (vertexs[b * 3 + 1] - ay);
    if (creu > 0 === antihorari) desti.push(a, b, c);
    else desti.push(a, c, b);
  };
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      triangle(superior, true, idx(i, j), idx(i + 1, j), idx(i + 1, j + 1));
      triangle(superior, true, idx(i, j), idx(i + 1, j + 1), idx(i, j + 1));
    }
  }

  // Vora en sentit antihorari: sud, est, nord (al revés) i oest (al revés).
  const vora = [];
  for (let i = 0; i < nu; i++) vora.push(idx(i, 0));
  for (let j = 0; j < nv; j++) vora.push(idx(nu, j));
  for (let i = nu; i > 0; i--) vora.push(idx(i, nv));
  for (let j = nv; j > 0; j--) vora.push(idx(0, j));
  anells.push(Uint32Array.from(vora));

  const centre = nouVertex(...punt(0.5, 0.5));
  for (let k = 0; k < vora.length; k++) {
    triangle(inferior, false, centre, vora[k], vora[(k + 1) % vora.length]);
  }
}

/**
 * Nodes d'una graella regular (alineada a múltiples del pas) que cauen dins
 * de la part i prou lluny de la vora.
 *
 * Es fa per files (scanline) i no punt per punt: per a cada fila, els
 * punts on la travessa el perímetre diuen quins nodes hi cauen dins
 * (regla parell-senar, la mateixa de puntDinsAnell), i la distància a la
 * vora només es mira als nodes de prop de cada segment. Abans era
 * proporcional a nodes × perímetre (92 s per a 250.000 nodes); així és
 * proporcional a nodes + perímetre.
 */
function nodesInteriors(part, pas, nouVertex) {
  const anells = [part.exterior, ...part.interiors];
  const margeMinim = pas * MARGE_RELATIU_VORA;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of part.exterior) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  // Índexs globals (múltiples del pas): dues zones veïnes fan servir la
  // mateixa graella, i les peces d'un mosaic hi encaixen.
  const i0 = Math.ceil(minX / pas);
  const j0 = Math.ceil(minY / pas);
  const nx = Math.max(0, Math.ceil(maxX / pas) - i0);
  const ny = Math.max(0, Math.ceil(maxY / pas) - j0);
  if (nx === 0 || ny === 0) return [];
  const dins = new Uint8Array(nx * ny);

  // Dins/fora per files.
  const creuaments = [];
  for (let j = 0; j < ny; j++) {
    const y = (j0 + j) * pas;
    creuaments.length = 0;
    for (const anell of anells) {
      for (let a = 0, b = anell.length - 1; a < anell.length; b = a++) {
        const [ax, ay] = anell[a];
        const [bx, by] = anell[b];
        if (ay > y !== by > y) creuaments.push(ax + ((y - ay) * (bx - ax)) / (by - ay));
      }
    }
    creuaments.sort((p, q) => p - q);
    for (let k = 0; k + 1 < creuaments.length; k += 2) {
      const iInici = Math.max(0, Math.ceil(creuaments[k] / pas) - i0);
      const iFinal = Math.min(nx - 1, Math.floor(creuaments[k + 1] / pas) - i0);
      for (let i = iInici; i <= iFinal; i++) {
        const x = (i0 + i) * pas;
        if (x > creuaments[k] && x < creuaments[k + 1]) dins[j * nx + i] = 1;
      }
    }
  }

  // Fora els nodes massa a prop de la vora: només es miren els del
  // requadre de cada segment, ampliat amb el marge.
  for (const anell of anells) {
    for (let a = 0, b = anell.length - 1; a < anell.length; b = a++) {
      const [ax, ay] = anell[b];
      const [bx, by] = anell[a];
      const iInici = Math.max(0, Math.ceil((Math.min(ax, bx) - margeMinim) / pas) - i0);
      const iFinal = Math.min(nx - 1, Math.floor((Math.max(ax, bx) + margeMinim) / pas) - i0);
      const jInici = Math.max(0, Math.ceil((Math.min(ay, by) - margeMinim) / pas) - j0);
      const jFinal = Math.min(ny - 1, Math.floor((Math.max(ay, by) + margeMinim) / pas) - j0);
      const dx = bx - ax;
      const dy = by - ay;
      const llargada2 = dx * dx + dy * dy;
      for (let j = jInici; j <= jFinal; j++) {
        for (let i = iInici; i <= iFinal; i++) {
          if (!dins[j * nx + i]) continue;
          const px = (i0 + i) * pas;
          const py = (j0 + j) * pas;
          const t = llargada2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / llargada2)) : 0;
          if (Math.hypot(px - (ax + t * dx), py - (ay + t * dy)) < margeMinim) dins[j * nx + i] = 0;
        }
      }
    }
  }

  const nodes = [];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      if (!dins[j * nx + i]) continue;
      const x = (i0 + i) * pas;
      const y = (j0 + j) * pas;
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

/**
 * Gira un model (rotació rígida al voltant del centre del seu requadre) i
 * en recalcula els límits. Les altituds no canvien. Serveix perquè una zona
 * rectangular recta a la pantalla (nord geogràfic), que en UTM queda girada
 * l'angle de convergència, surti recta al visor i al fitxer d'impressió.
 *
 * @param {ReturnType<typeof construirModel>} model
 * @param {number} angle Radians, en sentit antihorari
 * @returns {ReturnType<typeof construirModel> & {gir: {angle: number, cx: number, cy: number}}}
 *   gir: el que cal per desfer-lo (vegeu desferGir), p. ex. per a la textura.
 */
export function girarModel(model, angle) {
  const { limits } = model;
  const cx = (limits.minX + limits.maxX) / 2;
  const cy = (limits.minY + limits.maxY) / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const vertexs = Float64Array.from(model.vertexs);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < vertexs.length; i += 3) {
    const dx = vertexs[i] - cx;
    const dy = vertexs[i + 1] - cy;
    const x = cx + dx * cos - dy * sin;
    const y = cy + dx * sin + dy * cos;
    vertexs[i] = x;
    vertexs[i + 1] = y;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  return { ...model, vertexs, limits: { minX, minY, maxX, maxY }, gir: { angle, cx, cy } };
}

/** Punt del model girat -> punt original (abans de girarModel). */
export function desferGir([x, y], { angle, cx, cy }) {
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  const dx = x - cx;
  const dy = y - cy;
  return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
}
