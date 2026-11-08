// D'on surten el relleu i la imatge d'una zona, segons el país on cau
// (vegeu paisos/paisos.js). La font es tria pel lloc, no per la
// interfície: un polígon dibuixat dins d'Espanya fa servir l'IGN (MDT de
// 5 m i PNOA), sigui quin sigui el mode de cerca triat a l'app.
//
// Cada font ofereix:
//   graella(requadre, pas)  -> graella d'altituds (vegeu ServeiMDT)
//   textura(requadre, maxPixels?) -> { url, requadre, aUV? } per al visor 3D
//   carregarTextura(...)    -> el mateix, asíncron (opcional; més ràpid)
//   pasMinim                -> no té sentit un pas més fi que les dades
//   etiqueta, atribucio     -> per explicar-ho a la persona usuària

import { ServeiMDT } from './mdt.js';
import { ServeiMDTMundial } from './mdtMundial.js';
import { urlOrtofoto, urlSentinel2, texturaPnoaTesseles, ATRIBUCIO_PNOA, ATRIBUCIO_SENTINEL2 } from './ortofoto.js';
import { utmALatLng } from '../geometria/projeccio.js';
import { paisDe } from '../paisos/paisos.js';

// Textos d'atribució oficials (no es tradueixen).
const ATRIBUCIO_TERRARIUM = 'Terrain Tiles © Mapzen, AWS Open Data (SRTM, EU-DEM, 3DEP, GEBCO...)';
const ATRIBUCIO_MDT_IGN = 'MDT © Instituto Geográfico Nacional (CC BY 4.0)';

/** Font de l'IGN (Espanya). */
export function fontIGN(crs) {
  return {
    id: 'ign',
    crs,
    pasMinim: 5,
    etiqueta: 'MDT de l\'IGN (5 m) i PNOA',
    atribucio: `${ATRIBUCIO_MDT_IGN}. ${ATRIBUCIO_PNOA}`,
    graella: (requadre, pas) => ServeiMDT.consultarGraella(requadre, pas, crs),
    textura: (requadre, maxPixels = 2048) => ({ url: urlOrtofoto(requadre, maxPixels, crs).url, requadre }),
    // Asíncrona i preferible: amb tessel·les WMTS, que arriben de seguida;
    // si fallen, la de sempre (el WMS, que pot trigar mig minut).
    carregarTextura: async (requadre, maxPixels = 2048) => {
      try {
        const { url, aUV } = await texturaPnoaTesseles(requadre, maxPixels, (punt) => utmALatLng(punt, crs));
        return { url, requadre, aUV };
      } catch (error) {
        console.warn(error);
        return { url: urlOrtofoto(requadre, maxPixels, crs).url, requadre };
      }
    },
  };
}

/** Font mundial: Terrain Tiles + Sentinel-2 2016. Funciona amb qualsevol sistema UTM. */
export function fontMundial(crs) {
  return {
    id: 'mon',
    crs,
    // Les dades tenen uns 30 m reals a la major part del món; amb 15 m
    // la graella no perd res d'on n'hi ha de millors (Europa, EUA).
    pasMinim: 15,
    etiqueta: 'relleu mundial (~30 m) i Sentinel-2 (10 m)',
    atribucio: `${ATRIBUCIO_TERRARIUM}. ${ATRIBUCIO_SENTINEL2}`,
    graella: (requadre, pas) => ServeiMDTMundial.consultarGraella(requadre, pas, crs),
    textura: (requadre, maxPixels = 1024) => {
      // La imatge és en lat/lng: es calcula el requadre geogràfic que
      // cobreix el requadre UTM, i cada vèrtex del model rep la seva
      // coordenada de textura a partir de la seva lat/lng (aUV).
      const cantonades = [
        [requadre.minX, requadre.minY], [requadre.maxX, requadre.minY],
        [requadre.maxX, requadre.maxY], [requadre.minX, requadre.maxY],
      ].map((p) => utmALatLng(p, crs));
      const geo = {
        minLat: Math.min(...cantonades.map(([lat]) => lat)),
        maxLat: Math.max(...cantonades.map(([lat]) => lat)),
        minLng: Math.min(...cantonades.map(([, lng]) => lng)),
        maxLng: Math.max(...cantonades.map(([, lng]) => lng)),
      };
      return {
        url: urlSentinel2(geo, maxPixels).url,
        requadre,
        aUV: (x, y) => {
          const [lat, lng] = utmALatLng([x, y], crs);
          return [(lng - geo.minLng) / (geo.maxLng - geo.minLng), (lat - geo.minLat) / (geo.maxLat - geo.minLat)];
        },
      };
    },
  };
}

/** Primer punt [lat, lng] d'una zona (de les coordenades, o desprojectant la geometria). */
export function puntDeZona(zona) {
  if (zona.coordenades?.length) return zona.coordenades[0];
  return utmALatLng(zona.parts[0].exterior[0], zona.crs);
}

/** Font de dades que toca a una zona pel lloc on és. */
export function fontPer(zona) {
  const crs = zona.crs ?? 'EPSG:25830';
  return paisDe(puntDeZona(zona)).id === 'espanya' ? fontIGN(crs) : fontMundial(crs);
}
