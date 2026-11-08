// Imatge aèria per texturar un model, en dues versions:
//
//  - urlOrtofoto: PNOA de l'IGN (Espanya, ~25 cm/píxel), via WMS GetMap
//    directament en el sistema de la zona (EPSG:25830, o EPSG:4083 a les
//    Canàries): la imatge coincideix exactament amb el requadre del model.
//
//  - urlSentinel2: Sentinel-2 cloudless 2016 d'EOX (tot el món, 10 m/píxel),
//    en EPSG:4326. Es fa servir la versió 2016 perquè és l'única amb
//    llicència CC BY 4.0, que permet l'ús comercial amb atribució; les
//    dels anys següents són CC BY-NC-SA (no comercial).
//
// Tots dos admeten CORS (comprovat el 2026-10-17) i es poden fer servir
// com a textura WebGL. Aquí només es construeix l'URL: carregar-la és
// cosa de la interfície.
//
//  - texturaPnoaTesseles: la mateixa PNOA, però feta amb tessel·les WMTS ja
//    fetes en lloc d'una imatge del WMS, que pot trigar mig minut (vegeu
//    més avall). És la que fa servir generarModel.

const URL_WMS_PNOA = 'https://www.ign.es/wms-inspire/pnoa-ma';
const URL_WMS_EOX = 'https://tiles.maps.eox.at/wms';

// L'IGN ofereix la PNOA de les Canàries en REGCAN95 (EPSG:4083), que a
// escala de centímetres coincideix amb l'EPSG:32628 que fem servir allà.
const CRS_WMS_PNOA = { 'EPSG:25830': 'EPSG:25830', 'EPSG:32628': 'EPSG:4083' };

// Textos d'atribució oficials de cada font (no es tradueixen).
export const ATRIBUCIO_PNOA = 'PNOA © Instituto Geográfico Nacional (CC BY 4.0)';
export const ATRIBUCIO_SENTINEL2 =
  'Sentinel-2 cloudless 2016 by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016), CC BY 4.0';

function mides(ample, alt, metresPerPixel, maxPixels) {
  const costatMaxim = Math.min(maxPixels, Math.ceil(Math.max(ample, alt) / metresPerPixel));
  const escala = Math.max(costatMaxim, 64) / Math.max(ample, alt);
  return { amplada: Math.max(1, Math.round(ample * escala)), alcada: Math.max(1, Math.round(alt * escala)) };
}

/**
 * @param {{minX: number, minY: number, maxX: number, maxY: number}} requadre En metres, en el sistema crs
 * @param {number} [maxPixels] Costat més llarg de la imatge
 * @param {string} [crs]
 * @returns {{url: string, amplada: number, alcada: number}}
 */
export function urlOrtofoto(requadre, maxPixels = 2048, crs = 'EPSG:25830') {
  // La PNOA té ~25 cm/píxel: no té sentit demanar-ne més.
  const { amplada, alcada } = mides(requadre.maxX - requadre.minX, requadre.maxY - requadre.minY, 0.25, maxPixels);
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.3.0',
    REQUEST: 'GetMap',
    LAYERS: 'OI.OrthoimageCoverage',
    STYLES: '',
    CRS: CRS_WMS_PNOA[crs] ?? crs,
    BBOX: `${requadre.minX},${requadre.minY},${requadre.maxX},${requadre.maxY}`,
    WIDTH: String(amplada),
    HEIGHT: String(alcada),
    FORMAT: 'image/jpeg',
  });
  return { url: `${URL_WMS_PNOA}?${params.toString()}`, amplada, alcada };
}

/**
 * @param {{minLat: number, minLng: number, maxLat: number, maxLng: number}} requadre En graus
 * @param {number} [maxPixels]
 * @returns {{url: string, amplada: number, alcada: number}}
 */
export function urlSentinel2(requadre, maxPixels = 1024) {
  const latMitjana = (requadre.minLat + requadre.maxLat) / 2;
  const ample = (requadre.maxLng - requadre.minLng) * 111320 * Math.cos((latMitjana * Math.PI) / 180);
  const alt = (requadre.maxLat - requadre.minLat) * 110574;
  // 10 m/píxel; es demana una mica més (5 m) perquè el navegador
  // n'interpoli menys i les vores es vegin menys pixelades.
  const { amplada, alcada } = mides(ample, alt, 5, maxPixels);
  // WMS 1.1.1: l'ordre del BBOX en EPSG:4326 és lng,lat (en 1.3.0 seria lat,lng).
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.1.1',
    REQUEST: 'GetMap',
    LAYERS: 's2cloudless',
    STYLES: '',
    SRS: 'EPSG:4326',
    BBOX: `${requadre.minLng},${requadre.minLat},${requadre.maxLng},${requadre.maxLat}`,
    WIDTH: String(amplada),
    HEIGHT: String(alcada),
    FORMAT: 'image/jpeg',
  });
  return { url: `${URL_WMS_EOX}?${params.toString()}`, amplada, alcada };
}

// --- PNOA per tessel·les (WMTS) ---------------------------------------
//
// El WMS fa la imatge a cada petició: per a una zona nova pot trigar més de
// 30 s (33 s al mòbil, comprovat el 2026-11-05), i a l'app d'Android la
// càrrega acabava fallant i el model sortia sense ortofoto. El WMTS dona
// tessel·les ja fetes (en desenes de mil·lisegons, amb CORS i un any de
// memòria cau): les mateixes que el mapa. Aquí s'ajunten en un canvas.

const URL_WMTS_PNOA =
  'https://www.ign.es/wmts/pnoa-ma?request=GetTile&service=WMTS&version=1.0.0' +
  '&layer=OI.OrthoimageCoverage&style=default&tilematrixset=GoogleMapsCompatible&format=image/jpeg';
// L'IGN té la PNOA al WMTS fins al zoom 20 (comprovat el 2026-10-28).
const ZOOM_MAXIM_WMTS = 20;
const COSTAT_TESSELLA = 256;
// Si en falten més d'aquesta part, la imatge no serveix (es farà amb el WMS).
const FRACCIO_TESSELLES_FALLIDES_MAXIMA = 0.1;
const TEMPS_MAXIM_TESSELLA_MS = 20000;

/** Píxel Web Mercator (a un zoom) d'un punt [lat, lng]. */
function pixelMercator([lat, lng], zoom) {
  const mida = COSTAT_TESSELLA * 2 ** zoom;
  const sinLat = Math.sin((lat * Math.PI) / 180);
  return [((lng + 180) / 360) * mida, (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * mida];
}

function carregarImatge(url) {
  return new Promise((resoldre, rebutjar) => {
    const imatge = new Image();
    imatge.crossOrigin = 'anonymous';
    const temps = setTimeout(() => {
      imatge.src = '';
      rebutjar(new Error('temps esgotat'));
    }, TEMPS_MAXIM_TESSELLA_MS);
    imatge.onload = () => {
      clearTimeout(temps);
      resoldre(imatge);
    };
    imatge.onerror = () => {
      clearTimeout(temps);
      rebutjar(new Error(`no s'ha pogut carregar ${url}`));
    };
    imatge.src = url;
  });
}

/**
 * Ortofoto PNOA d'un requadre feta amb tessel·les WMTS, al zoom més alt
 * que hi cap amb maxPixels. Com que la imatge és en Web Mercator i el model
 * en UTM, cada vèrtex hi troba la seva coordenada pel seu lat/lng (aUV).
 *
 * @param {{minX: number, minY: number, maxX: number, maxY: number}} requadre En metres, en el sistema crs
 * @param {number} maxPixels Costat més llarg de la imatge
 * @param {(punt: [number, number]) => [number, number]} aLatLng De metres del crs a [lat, lng]
 * @returns {Promise<{url: string, aUV: (x: number, y: number) => [number, number]}>}
 *   url: un blob: (JPEG) per a TextureLoader.
 */
export async function texturaPnoaTesseles(requadre, maxPixels, aLatLng) {
  const cantonades = [
    [requadre.minX, requadre.minY], [requadre.maxX, requadre.minY],
    [requadre.maxX, requadre.maxY], [requadre.minX, requadre.maxY],
  ].map(aLatLng);

  // El zoom més alt amb què la imatge no passa de maxPixels de costat.
  let zoom = ZOOM_MAXIM_WMTS;
  let x0;
  let y0;
  let ample;
  let alt;
  for (; zoom >= 1; zoom--) {
    const pixels = cantonades.map((punt) => pixelMercator(punt, zoom));
    x0 = Math.floor(Math.min(...pixels.map(([x]) => x)));
    y0 = Math.floor(Math.min(...pixels.map(([, y]) => y)));
    ample = Math.ceil(Math.max(...pixels.map(([x]) => x))) - x0;
    alt = Math.ceil(Math.max(...pixels.map(([, y]) => y))) - y0;
    if (Math.max(ample, alt) <= maxPixels) break;
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, ample);
  canvas.height = Math.max(1, alt);
  const ctx = canvas.getContext('2d');
  const tessellesX = [Math.floor(x0 / COSTAT_TESSELLA), Math.floor((x0 + ample - 1) / COSTAT_TESSELLA)];
  const tessellesY = [Math.floor(y0 / COSTAT_TESSELLA), Math.floor((y0 + alt - 1) / COSTAT_TESSELLA)];
  const peticions = [];
  for (let ty = tessellesY[0]; ty <= tessellesY[1]; ty++) {
    for (let tx = tessellesX[0]; tx <= tessellesX[1]; tx++) {
      const url = `${URL_WMTS_PNOA}&tilematrix=${zoom}&tilerow=${ty}&tilecol=${tx}`;
      peticions.push(
        carregarImatge(url).then((imatge) =>
          ctx.drawImage(imatge, tx * COSTAT_TESSELLA - x0, ty * COSTAT_TESSELLA - y0)
        )
      );
    }
  }
  const resultats = await Promise.allSettled(peticions);
  const fallides = resultats.filter((r) => r.status === 'rejected').length;
  if (fallides > resultats.length * FRACCIO_TESSELLES_FALLIDES_MAXIMA) {
    throw new Error(`texturaPnoaTesseles: han fallat ${fallides} de ${resultats.length} tessel·les`);
  }

  const blob = await new Promise((resoldre) => canvas.toBlob(resoldre, 'image/jpeg', 0.92));
  return {
    url: URL.createObjectURL(blob),
    aUV: (x, y) => {
      const [px, py] = pixelMercator(aLatLng([x, y]), zoom);
      return [(px - x0) / ample, 1 - (py - y0) / alt];
    },
  };
}
