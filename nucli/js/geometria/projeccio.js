// Conversió entre coordenades geogràfiques (lat/lng, les que fa servir
// Leaflet) i UTM 30N ETRS89 (EPSG:25830, les que fan servir el Cadastre
// i el MDT de l'IGN). Necessita proj4 carregat globalment per <script>.

export const EPSG_UTM = 'EPSG:25830';
const DEFINICIO_EPSG_25830 =
  '+proj=utm +zone=30 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs';

function proj() {
  const p = globalThis.proj4;
  if (!p) throw new Error('Projecció: cal carregar proj4 abans d\'aquest mòdul');
  if (!p.defs(EPSG_UTM)) p.defs(EPSG_UTM, DEFINICIO_EPSG_25830);
  return p;
}

/** [x, y] UTM -> [lat, lng] */
export function utmALatLng([x, y]) {
  const [lng, lat] = proj()(EPSG_UTM, 'EPSG:4326', [x, y]);
  return [lat, lng];
}

/** [lat, lng] -> [x, y] UTM */
export function latLngAUtm([lat, lng]) {
  return proj()('EPSG:4326', EPSG_UTM, [lng, lat]);
}
