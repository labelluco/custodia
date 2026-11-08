// Model Digital del Terreny de l'IGN via el WCS de l'IDEE: en una sola
// petició retorna tota una graella d'altituds d'un requadre -- molt més
// eficient que consultar punt a punt (getElevation), que és el que fa
// ServeiAltimetria. Confirmat el 2026-10-15:
//  - el servei admet CORS (Access-Control-Allow-Origin: *),
//  - el format "application/asc" (ESRI ASCII Grid, text pla) arriba dins
//    d'una resposta multipart, i no cal cap llibreria de GeoTIFF,
//  - SCALESIZE permet triar la mida de la graella (i, per tant, el pas)
//    sense descarregar tota la resolució original.
//
// En EPSG:25830 (UTM 30N) a la Península i les Balears, el mateix sistema
// en què el Cadastre ja ens dona les geometries. A les Canàries, el
// servei té les cobertures en EPSG:4083 (REGCAN95 / UTM 28N), que a
// efectes pràctics coincideix amb l'EPSG:32628 que fem servir allà
// (vegeu geometria/projeccio.js).

const URL_WCS = 'https://servicios.idee.es/wcs-inspire/mdt';

// Cobertures disponibles en EPSG:25830, de més fina a més grossa (m).
// Es tria la més grossa que encara és més fina que el pas demanat:
// demanar la de 5 m per a un requadre de 30 km obligaria el servidor a
// llegir moltíssimes dades per acabar-les reduint igualment.
const PASSOS_COBERTURA = [5, 25, 200];
const FAMILIA_COBERTURA = { 'EPSG:25830': 'Elevacion25830', 'EPSG:32628': 'Elevacion4083' };

export class ServeiMDT {
  /**
   * Graella d'altituds que cobreix el requadre donat (en metres UTM),
   * amb el pas indicat. El requadre s'amplia fins a un nombre enter de
   * cel·les, perquè totes siguin quadrades.
   *
   * @param {{minX: number, minY: number, maxX: number, maxY: number}} requadre
   * @param {number} pasMetres
   * @param {string} [crs] EPSG:25830 (per defecte) o EPSG:32628 (Canàries)
   * @returns {Promise<{ncols: number, nrows: number, xll: number, yll: number, cellsize: number, valors: Float32Array, fraccioBuida: number}>}
   */
  static async consultarGraella(requadre, pasMetres, crs = 'EPSG:25830') {
    const familia = FAMILIA_COBERTURA[crs];
    if (!familia) throw new Error(`ServeiMDT: l'IGN no té el MDT en ${crs}`);
    const ncols = Math.max(2, Math.ceil((requadre.maxX - requadre.minX) / pasMetres));
    const nrows = Math.max(2, Math.ceil((requadre.maxY - requadre.minY) / pasMetres));
    const maxX = requadre.minX + ncols * pasMetres;
    const maxY = requadre.minY + nrows * pasMetres;

    const pasCobertura = [...PASSOS_COBERTURA].reverse().find((p) => p <= pasMetres) ?? PASSOS_COBERTURA[0];

    const params = new URLSearchParams({
      SERVICE: 'WCS',
      VERSION: '2.0.1',
      REQUEST: 'GetCoverage',
      COVERAGEID: `${familia}_${pasCobertura}`,
      FORMAT: 'application/asc',
    });
    // SUBSET i SCALESIZE es repeteixen/porten parèntesis: més clar
    // afegir-los a mà que forçar-los dins d'URLSearchParams.
    const url =
      `${URL_WCS}?${params.toString()}` +
      `&SUBSET=x(${requadre.minX},${maxX})&SUBSET=y(${requadre.minY},${maxY})` +
      `&SCALESIZE=x(${ncols}),y(${nrows})`;

    let resposta;
    try {
      resposta = await fetch(url);
    } catch (error) {
      throw new Error(`ServeiMDT: no s'ha pogut consultar el model del terreny (${error.message})`);
    }
    if (!resposta.ok) {
      throw new Error(`ServeiMDT: el servei del model del terreny ha retornat un error (${resposta.status})`);
    }
    return parsejarAsc(await resposta.text());
  }
}

/**
 * Llegeix un ESRI ASCII Grid, tant si ve sol com dins d'una resposta
 * multipart (com la del WCS de l'IDEE). Els valors NODATA (mar, fora de
 * cobertura) es substitueixen per l'altitud vàlida més baixa: és
 * l'opció menys enganyosa per a un model físic (una costa queda plana
 * a nivell del mar en lloc de fer un forat).
 *
 * @param {string} text
 */
export function parsejarAsc(text) {
  const inici = text.search(/ncols/i);
  if (inici < 0) {
    throw new Error('ServeiMDT: resposta sense graella d\'altituds');
  }
  // La resposta multipart acaba amb una línia "--límit--"; es talla
  // abans perquè no es llegeixi com a valor.
  let cos = text.slice(inici);
  const finalMultipart = cos.search(/\r?\n--/);
  if (finalMultipart >= 0) cos = cos.slice(0, finalMultipart);

  const capcalera = {};
  const linies = cos.split(/\r?\n/);
  let primeraLiniaDades = 0;
  for (let i = 0; i < linies.length; i++) {
    const coincidencia = linies[i].trim().match(/^([a-z_]+)\s+(-?[\d.eE+-]+)$/i);
    if (!coincidencia) {
      primeraLiniaDades = i;
      break;
    }
    capcalera[coincidencia[1].toLowerCase()] = Number(coincidencia[2]);
  }

  const ncols = capcalera.ncols;
  const nrows = capcalera.nrows;
  const cellsize = capcalera.cellsize;
  // Alguns servidors donen el centre (xllcenter) en lloc de la cantonada.
  const xll = capcalera.xllcorner ?? capcalera.xllcenter - cellsize / 2;
  const yll = capcalera.yllcorner ?? capcalera.yllcenter - cellsize / 2;
  const nodata = capcalera.nodata_value;

  if (!(ncols > 0 && nrows > 0 && cellsize > 0) || Number.isNaN(xll) || Number.isNaN(yll)) {
    throw new Error('ServeiMDT: capçalera de la graella d\'altituds incompleta');
  }

  const textValors = linies.slice(primeraLiniaDades).join(' ').trim();
  const valors = Float32Array.from(textValors.split(/\s+/), Number);
  if (valors.length !== ncols * nrows) {
    throw new Error(
      `ServeiMDT: la graella hauria de tenir ${ncols * nrows} valors però en té ${valors.length}`
    );
  }

  const esBuit = (v) => Number.isNaN(v) || (nodata !== undefined && v === nodata) || v < -1000;
  let minimValid = Infinity;
  let buits = 0;
  for (const v of valors) {
    if (esBuit(v)) buits++;
    else if (v < minimValid) minimValid = v;
  }
  if (minimValid === Infinity) {
    throw new Error('ServeiMDT: no hi ha dades d\'altitud en aquesta zona');
  }
  for (let i = 0; i < valors.length; i++) if (esBuit(valors[i])) valors[i] = minimValid;

  // fraccioBuida: quina part de la graella no tenia dades. Ho fa servir
  // el generador de models per saber si la zona surt de la cobertura de
  // l'IGN (per exemple, a la frontera amb Portugal o França).
  return { ncols, nrows, xll, yll, cellsize, valors, fraccioBuida: buits / valors.length };
}
