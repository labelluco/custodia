// De zona a model 3D (ve de Terra 3D): tria la font de dades segons on és
// la zona (vegeu fontsDades.js), tria el pas segons el detall demanat,
// demana la graella del relleu amb marge, construeix el sòlid i prepara la
// textura. Sense UI: informa del progrés amb un callback.
import { Terreny } from '../geometria/terreny.js';
import { construirModel, girarModel, desferGir } from '../geometria/solid.js';
import { limitsDeParts } from '../geometria/poligon.js';
import { fontPer, fontMundial } from './fontsDades.js';

// Punts al llarg del costat més llarg de la zona per a cada nivell.
export const NIVELLS_DETALL = { baix: 80, mitja: 160, alt: 280 };

// El MDT més fi de l'IGN és de 5 m: un pas més petit només
// interpolaria i donaria una falsa sensació de precisió. Cada font de
// dades té el seu mínim (vegeu fontsDades.js); aquest és el de l'IGN.
export const PAS_MINIM_METRES = 5;

// Més enllà d'això, el model perd sentit (i el servei tarda molt).
export const COSTAT_MAXIM_METRES = 50000;

// Si més d'aquesta part de la graella de l'IGN ve buida, la zona surt de
// la seva cobertura (frontera, mar) i es torna a demanar amb dades mundials.
const FRACCIO_BUIDA_MAXIMA = 0.05;

export function costatMaxim(parts) {
  const { minX, minY, maxX, maxY } = limitsDeParts(parts);
  return Math.max(maxX - minX, maxY - minY);
}

export function pasPerDetall(parts, detall, pasMinim = PAS_MINIM_METRES) {
  const punts = NIVELLS_DETALL[detall] ?? NIVELLS_DETALL.mitja;
  return Math.max(pasMinim, costatMaxim(parts) / punts);
}

/**
 * @param {{parts: Array<{exterior: Array<[number, number]>, interiors?: Array<Array<[number, number]>>}>, crs?: string, coordenades?: Array<[number, number]>}} zona
 *   crs: sistema de les parts (per defecte EPSG:25830, com fins ara).
 * @param {string} detall
 * @param {(fase: 'terreny'|'model') => void} [onProgres]
 * @param {{maxPixelsTextura?: number}} [opcions] costat màxim de la imatge de
 *   la textura (vegeu midaMaximaTextura del visor); per defecte, el de la
 *   font (2048 la PNOA, 1024 Sentinel-2).
 *   terreny: la graella del relleu (en el sistema de la font, sense el gir),
 *   per si l'app hi ha de posar coses a sobre (un track al visor 3D).
 * @returns {Promise<{model: object, pas: number, terreny: Terreny, textura: {url: string, requadre: object, aUV?: Function}, font: {id: string, etiqueta: string, atribucio: string}}>}
 */
export async function generarModel(zona, detall, onProgres = () => {}, { maxPixelsTextura } = {}) {
  const costat = costatMaxim(zona.parts);
  if (costat > COSTAT_MAXIM_METRES) {
    throw new Error('zona-massa-gran');
  }

  let font = fontPer(zona);
  onProgres('terreny');
  // L'IGN, fora de la seva cobertura, pot respondre amb cel·les buides o
  // directament amb un error (400, comprovat a Lisboa): en tots dos casos
  // es torna a provar amb les dades mundials.
  let resultat = await demanarGraella(zona, detall, font).catch((error) => {
    if (font.id === 'mon') throw error;
    return null;
  });
  if (!resultat || resultat.graella.fraccioBuida > FRACCIO_BUIDA_MAXIMA) {
    font = fontMundial(font.crs);
    resultat = await demanarGraella(zona, detall, font);
  }
  const { pas, graella } = resultat;

  onProgres('model');
  // Es cedeix el fil un moment perquè la interfície pinti el missatge
  // abans del càlcul (que és síncron).
  await new Promise((resoldre) => setTimeout(resoldre, 30));
  const terreny = new Terreny(graella);
  const modelUtm = construirModel(zona.parts, terreny, pas);

  // La imatge es demana per al requadre del model en el sistema de la font
  // (abans de qualsevol gir).
  const requadreTextura = {
    minX: modelUtm.limits.minX - 1,
    minY: modelUtm.limits.minY - 1,
    maxX: modelUtm.limits.maxX + 1,
    maxY: modelUtm.limits.maxY + 1,
  };
  let textura = font.carregarTextura
    ? await font.carregarTextura(requadreTextura, maxPixelsTextura)
    : font.textura(requadreTextura, maxPixelsTextura);
  // Coordenades de textura en UTM, sense cap gir: un altre model de la
  // mateixa zona (p. ex. a una altra resolució, vegeu mosaic.js) hi troba
  // les seves desfent el seu propi gir.
  const { minX: tx0, minY: ty0, maxX: tx1, maxY: ty1 } = requadreTextura;
  textura.aUVUtm = textura.aUV ?? ((x, y) => [(x - tx0) / (tx1 - tx0), (y - ty0) / (ty1 - ty0)]);
  let model = modelUtm;

  // Zona girada respecte a la quadrícula (rectangle recte a la pantalla):
  // es gira el model en sentit contrari perquè quedi recte. Cada vèrtex
  // girat troba la seva coordenada de textura desfent el gir.
  if (zona.rotacio) {
    model = girarModel(modelUtm, -zona.rotacio);
    const uvOriginal = textura.aUVUtm;
    textura = { ...textura, aUV: (x, y) => uvOriginal(...desferGir([x, y], model.gir)) };
  }

  return {
    model,
    pas,
    terreny,
    textura,
    font: { id: font.id, etiqueta: font.etiqueta, atribucio: font.atribucio },
  };
}

async function demanarGraella(zona, detall, font) {
  const pas = pasPerDetall(zona.parts, detall, font.pasMinim);
  const limits = limitsDeParts(zona.parts);
  // Marge de dues cel·les: la interpolació bilineal de la vora necessita
  // els veïns de fora del perímetre.
  const marge = pas * 2;
  const requadre = {
    minX: limits.minX - marge,
    minY: limits.minY - marge,
    maxX: limits.maxX + marge,
    maxY: limits.maxY + marge,
  };
  return { pas, graella: await font.graella(requadre, pas) };
}
