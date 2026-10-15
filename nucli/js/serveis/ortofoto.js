// Ortofoto PNOA de l'IGN per al requadre d'un model, via WMS GetMap
// directament en EPSG:25830 -- la imatge coincideix així exactament amb
// les coordenades del model, sense cap reprojecció. El servei admet
// CORS (comprovat el 2026-10-15), i per tant es pot fer servir com a
// textura WebGL.
//
// Només construeix l'URL: carregar-la (Image, THREE.TextureLoader) és
// cosa de la interfície.

const URL_WMS_PNOA = 'https://www.ign.es/wms-inspire/pnoa-ma';

/**
 * @param {{minX: number, minY: number, maxX: number, maxY: number}} requadre En metres UTM
 * @param {number} [maxPixels] Costat més llarg de la imatge
 * @returns {{url: string, amplada: number, alcada: number}}
 */
export function urlOrtofoto(requadre, maxPixels = 2048) {
  const ample = requadre.maxX - requadre.minX;
  const alt = requadre.maxY - requadre.minY;
  // La PNOA té ~25 cm/píxel: no té sentit demanar-ne més.
  const costatMaxim = Math.min(maxPixels, Math.ceil(Math.max(ample, alt) / 0.25));
  const escala = costatMaxim / Math.max(ample, alt);
  const amplada = Math.max(1, Math.round(ample * escala));
  const alcada = Math.max(1, Math.round(alt * escala));

  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.3.0',
    REQUEST: 'GetMap',
    LAYERS: 'OI.OrthoimageCoverage',
    STYLES: '',
    CRS: 'EPSG:25830',
    BBOX: `${requadre.minX},${requadre.minY},${requadre.maxX},${requadre.maxY}`,
    WIDTH: String(amplada),
    HEIGHT: String(alcada),
    FORMAT: 'image/jpeg',
  });
  return { url: `${URL_WMS_PNOA}?${params.toString()}`, amplada, alcada };
}
