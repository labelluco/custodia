// De zona a model 3D (ve de Terra 3D): tria el pas segons el detall
// demanat, demana la graella del MDT amb marge, construeix el sòlid i
// prepara l'URL de l'ortofoto. Sense UI: informa del progrés amb un callback.
import { ServeiMDT } from './mdt.js';
import { urlOrtofoto } from './ortofoto.js';
import { Terreny } from '../geometria/terreny.js';
import { construirModel } from '../geometria/solid.js';
import { limitsDeParts } from '../geometria/poligon.js';

// Punts al llarg del costat més llarg de la zona per a cada nivell.
export const NIVELLS_DETALL = { baix: 80, mitja: 160, alt: 280 };

// El MDT més fi de l'IGN és de 5 m: un pas més petit només
// interpolaria i donaria una falsa sensació de precisió.
export const PAS_MINIM_METRES = 5;

// Més enllà d'això, el model perd sentit (i el servei tarda molt).
export const COSTAT_MAXIM_METRES = 50000;

export function costatMaxim(parts) {
  const { minX, minY, maxX, maxY } = limitsDeParts(parts);
  return Math.max(maxX - minX, maxY - minY);
}

export function pasPerDetall(parts, detall) {
  const punts = NIVELLS_DETALL[detall] ?? NIVELLS_DETALL.mitja;
  return Math.max(PAS_MINIM_METRES, costatMaxim(parts) / punts);
}

/**
 * @param {{parts: Array<{exterior: Array<[number, number]>, interiors?: Array<Array<[number, number]>>}>}} zona
 * @param {string} detall
 * @param {(fase: 'terreny'|'model') => void} [onProgres]
 */
export async function generarModel(zona, detall, onProgres = () => {}) {
  const costat = costatMaxim(zona.parts);
  if (costat > COSTAT_MAXIM_METRES) {
    throw new Error('zona-massa-gran');
  }

  const pas = pasPerDetall(zona.parts, detall);
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

  onProgres('terreny');
  const graella = await ServeiMDT.consultarGraella(requadre, pas);

  onProgres('model');
  // Es cedeix el fil un moment perquè la interfície pinti el missatge
  // abans del càlcul (que és síncron).
  await new Promise((resoldre) => setTimeout(resoldre, 30));
  const model = construirModel(zona.parts, new Terreny(graella), pas);

  const requadreTextura = {
    minX: model.limits.minX - 1,
    minY: model.limits.minY - 1,
    maxX: model.limits.maxX + 1,
    maxY: model.limits.maxY + 1,
  };
  return {
    model,
    pas,
    textura: { url: urlOrtofoto(requadreTextura).url, requadre: requadreTextura },
  };
}
