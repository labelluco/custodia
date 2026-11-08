// Conversió entre coordenades geogràfiques (lat/lng, les que fa servir
// Leaflet) i coordenades planes en metres (UTM). Necessita proj4 carregat
// globalment per <script>.
//
// Sistemes que fem servir:
//  - EPSG:25830 (ETRS89 / UTM 30N): Espanya peninsular i Balears, el del
//    Cadastre i el MDT de l'IGN. És el valor per defecte de totes les
//    funcions, perquè el codi que ja existia (Custòdia) no canviï.
//  - EPSG:32628 (WGS84 / UTM 28N): Canàries. El Cadastre hi respon en
//    aquest sistema, i l'IGN hi té el MDT i la PNOA en EPSG:4083
//    (REGCAN95 / UTM 28N), que és el mateix a escala de centímetres.
//  - EPSG:326NN / 327NN (WGS84 / UTM fus NN nord / sud): la resta del món,
//    triat segons on és la zona (crsUtmPer).
//
// Totes les zones són de com a molt 50 km de costat: dins d'un sol fus
// UTM la deformació és negligible per a un model 3D.

export const EPSG_UTM = 'EPSG:25830';
export const EPSG_CANARIES = 'EPSG:32628';

const DEFINICIO_EPSG_25830 =
  '+proj=utm +zone=30 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs';

function proj(crs) {
  const p = globalThis.proj4;
  if (!p) throw new Error('Projecció: cal carregar proj4 abans d\'aquest mòdul');
  if (!p.defs(crs)) {
    if (crs === EPSG_UTM) {
      p.defs(crs, DEFINICIO_EPSG_25830);
    } else {
      const utm = crs.match(/^EPSG:32([67])(\d\d)$/);
      if (!utm) throw new Error(`Projecció: sistema desconegut ${crs}`);
      const sud = utm[1] === '7' ? ' +south' : '';
      p.defs(crs, `+proj=utm +zone=${Number(utm[2])}${sud} +datum=WGS84 +units=m +no_defs +type=crs`);
    }
  }
  return p;
}

// Les funcions de conversió es fan servir sovint amb .map(), que passa
// l'índex com a segon argument: només s'accepta un text com a sistema.
const sistema = (crs) => (typeof crs === 'string' ? crs : EPSG_UTM);

/** [x, y] UTM -> [lat, lng] */
export function utmALatLng([x, y], crs) {
  const c = sistema(crs);
  const [lng, lat] = proj(c)(c, 'EPSG:4326', [x, y]);
  return [lat, lng];
}

/** [lat, lng] -> [x, y] UTM */
export function latLngAUtm([lat, lng], crs) {
  const c = sistema(crs);
  return proj(c)('EPSG:4326', c, [lng, lat]);
}

/**
 * Sistema UTM (WGS84) del fus on cau el punt: EPSG:326NN al nord de
 * l'equador, EPSG:327NN al sud. Fus = 6° de longitud, començant a 180° O.
 * (No s'apliquen les excepcions de Noruega i Svalbard: per a un model local
 * qualsevol fus proper funciona igual de bé.)
 */
export function crsUtmPer([lat, lng]) {
  const llarg = ((((lng + 180) % 360) + 360) % 360);
  const fus = Math.min(60, Math.floor(llarg / 6) + 1);
  return `EPSG:${lat >= 0 ? '326' : '327'}${String(fus).padStart(2, '0')}`;
}
