// Operacions geomètriques pures sobre anells (polígons tancats) en
// coordenades planes en metres -- normalment UTM (EPSG:25830): x = est,
// y = nord. No sap res de Leaflet, de Three.js ni de cap servei extern.
//
// Conveni: un "anell" és un array de [x, y] SENSE repetir el primer punt
// al final (el tancament és implícit). Els serveis externs (Cadastre,
// Leaflet) sí que solen repetir-lo; netejarAnell() el treu.

/** Àrea amb signe (fórmula del cordó / shoelace): positiva si l'anell va en sentit antihorari vist des de dalt. */
export function areaAmbSigne(anell) {
  let suma = 0;
  for (let i = 0, j = anell.length - 1; i < anell.length; j = i++) {
    suma += (anell[j][0] - anell[i][0]) * (anell[j][1] + anell[i][1]);
  }
  return suma / 2;
}

/** Àrea en m² d'una part (exterior menys forats). */
export function areaPart({ exterior, interiors = [] }) {
  const forats = interiors.reduce((acc, anell) => acc + Math.abs(areaAmbSigne(anell)), 0);
  return Math.abs(areaAmbSigne(exterior)) - forats;
}

/**
 * Treu el punt de tancament repetit, els punts consecutius pràcticament
 * iguals (< 1 cm) i els punts alineats amb els seus veïns. Aquests casos
 * són habituals a les geometries del Cadastre i fan fallar la
 * triangulació restringida (poly2tri no admet punts duplicats).
 */
export function netejarAnell(anell, toleranciaMetres = 0.01) {
  let punts = anell.slice();
  const iguals = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < toleranciaMetres;

  if (punts.length > 1 && iguals(punts[0], punts[punts.length - 1])) punts.pop();
  punts = punts.filter((p, i) => i === 0 || !iguals(p, punts[i - 1]));

  // Alineats: l'àrea del triangle (anterior, actual, següent) és ~0. Es
  // repeteix fins que no se'n treu cap, perquè treure'n un pot deixar-ne
  // un altre d'alineat.
  let canviat = true;
  while (canviat && punts.length > 3) {
    canviat = false;
    for (let i = 0; i < punts.length; i++) {
      const a = punts[(i - 1 + punts.length) % punts.length];
      const b = punts[i];
      const c = punts[(i + 1) % punts.length];
      const areaDoble = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]));
      if (areaDoble < 1e-6) {
        punts.splice(i, 1);
        canviat = true;
        break;
      }
    }
  }
  return punts;
}

/** Retorna l'anell amb l'orientació demanada (antihorari = true). */
export function orientarAnell(anell, antihorari) {
  const esAntihorari = areaAmbSigne(anell) > 0;
  return esAntihorari === antihorari ? anell.slice() : anell.slice().reverse();
}

/**
 * Afegeix punts intermedis a cada costat perquè cap tram no superi
 * `pasMetres`. Imprescindible per al model 3D: sense aquests punts, un
 * costat llarg del perímetre seria una recta entre dues altituds i
 * "tallaria" els turons i les valls que hi ha entremig.
 */
export function densificarAnell(anell, pasMetres) {
  const resultat = [];
  for (let i = 0; i < anell.length; i++) {
    const a = anell[i];
    const b = anell[(i + 1) % anell.length];
    const longitud = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const trams = Math.max(1, Math.ceil(longitud / pasMetres));
    for (let k = 0; k < trams; k++) {
      const f = k / trams;
      resultat.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
    }
  }
  return resultat;
}

/** Ray casting: cert si el punt cau dins de l'anell. */
export function puntDinsAnell([x, y], anell) {
  let dins = false;
  for (let i = 0, j = anell.length - 1; i < anell.length; j = i++) {
    const [xi, yi] = anell[i];
    const [xj, yj] = anell[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dins = !dins;
  }
  return dins;
}

/** Cert si el punt és dins de la part (dins de l'exterior i fora de tots els forats). */
export function puntDinsPart(punt, { exterior, interiors = [] }) {
  return puntDinsAnell(punt, exterior) && !interiors.some((forat) => puntDinsAnell(punt, forat));
}

/** Distància mínima d'un punt a qualsevol costat de l'anell. */
export function distanciaAAnell([px, py], anell) {
  let minima = Infinity;
  for (let i = 0, j = anell.length - 1; i < anell.length; j = i++) {
    const [ax, ay] = anell[j];
    const [bx, by] = anell[i];
    const dx = bx - ax;
    const dy = by - ay;
    const llarg2 = dx * dx + dy * dy;
    const t = llarg2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / llarg2));
    const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    if (d < minima) minima = d;
  }
  return minima;
}

/**
 * Cert si cap parell de costats no consecutius es creua. Un polígon
 * dibuixat a mà que es talla a si mateix no té un "interior" ben definit
 * i no es pot convertir en un sòlid imprimible.
 */
export function esAnellSimple(anell) {
  const n = anell.length;
  if (n < 3) return false;
  const creuen = (a, b, c, d) => {
    const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
    return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
  };
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      // Costats que comparteixen un vèrtex no compten com a creuament.
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      if (creuen(anell[i], anell[(i + 1) % n], anell[j], anell[(j + 1) % n])) return false;
    }
  }
  return true;
}

/** Requadre que conté totes les parts: {minX, minY, maxX, maxY}. */
export function limitsDeParts(parts) {
  const punts = parts.flatMap((p) => p.exterior);
  const xs = punts.map(([x]) => x);
  const ys = punts.map(([, y]) => y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}
