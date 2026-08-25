// Consulta el Mapa Forestal d'Espanya (MFE) per determinar el tipus de
// vegetació/espècie dominant en un punt, via el servei WMS que ofereix
// el MITECO.
//
// AVÍS IMPORTANT -- més incertesa que la resta de serveis externs del
// projecte: a diferència del Cadastre o de l'altimetria (IDEE), aquest
// NO s'ha pogut provar en directe ni confirmar-ne la resposta real.
// Cercant la documentació disponible:
//   - El propi endpoint ha donat, en proves alienes trobades durant la
//     cerca, tant errors interns del servidor (excepcions .NET) com
//     respostes correctes -- sembla un servei amb fiabilitat variable.
//   - No hi ha (o no s'ha trobat) una llista pública confirmada del nom
//     exacte de la capa consultable (el que cal posar a LAYERS).
//   - El format de resposta de GetFeatureInfo (XML? HTML? JSON?) depèn
//     de com estigui configurat el servidor, tampoc confirmat.
// Aquest fitxer implementa el patró estàndard (WMS GetFeatureInfo amb
// un requadre mínim al voltant del punt, tal com fan servir QGIS o
// qualsevol client WMS per "clicar i preguntar què hi ha aquí"), amb un
// parseig flexible per intentar treure'n algun valor -- però CAL
// PROVAR-HO DE VERITAT i ajustar el nom de la capa (i potser el
// parseig) abans de confiar-hi, exactament com vam haver de fer amb el
// Cadastre al principi.

const URL_WMS_MFE = 'https://wms.mapama.gob.es/sig/Biodiversidad/MFE/wms.aspx';

// Nom de la capa a consultar -- PENDENT DE CONFIRMAR contra el
// GetCapabilities real del servei. "MFE" és una suposició raonable
// (coincideix amb com s'anomena el servei mateix), no una dada verificada.
const CAPA_MFE = 'MFE';

// Mig requadre (en graus) al voltant del punt consultat -- prou petit
// perquè el píxel central caigui pràcticament sobre el punt exacte.
const MARGE_GRAUS = 0.0005;

export class ServeiVegetacio {
  /**
   * @param {number} lat
   * @param {number} lng
   * @returns {Promise<string|null>} Descripció del tipus de vegetació, o
   *   null si el servei no ha retornat cap dada interpretable per a
   *   aquest punt (per exemple, si cau fora de zona forestal).
   */
  static async consultarTipus(lat, lng) {
    // CRS:84 (no EPSG:4326) per evitar l'ambigüitat d'ordre d'eixos que
    // WMS 1.3.0 introdueix amb EPSG:4326 (lat,lng en comptes de lng,lat
    // segons el servidor) -- amb CRS:84 l'ordre és sempre lng,lat.
    const bbox = [
      lng - MARGE_GRAUS,
      lat - MARGE_GRAUS,
      lng + MARGE_GRAUS,
      lat + MARGE_GRAUS,
    ].join(',');

    const params = new URLSearchParams({
      SERVICE: 'WMS',
      VERSION: '1.3.0',
      REQUEST: 'GetFeatureInfo',
      LAYERS: CAPA_MFE,
      QUERY_LAYERS: CAPA_MFE,
      CRS: 'CRS:84',
      BBOX: bbox,
      WIDTH: '3',
      HEIGHT: '3',
      I: '1',
      J: '1',
      INFO_FORMAT: 'text/xml',
      FEATURE_COUNT: '1',
    });

    const url = `${URL_WMS_MFE}?${params.toString()}`;

    let resposta;
    try {
      resposta = await fetch(url);
    } catch (error) {
      throw new Error(`ServeiVegetacio: no s'ha pogut consultar el MFE (${error.message})`);
    }

    if (!resposta.ok) {
      throw new Error(`ServeiVegetacio: el MFE ha retornat un error (${resposta.status})`);
    }

    const text = await resposta.text();
    return ServeiVegetacio._extreureTipus(text);
  }

  /**
   * Intenta treure un valor de text de la resposta sense assumir una
   * estructura XML concreta (no confirmada): busca qualsevol atribut
   * amb un nom que sembli rellevant (espècie, tipus, forma...). Si mai
   * es confirma l'estructura real, val la pena substituir això per un
   * accés directe i concret, més fiable que aquesta cerca genèrica.
   */
  static _extreureTipus(text) {
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'application/xml');
    if (xml.querySelector('parsererror')) {
      return null;
    }

    const paraulesClauAtribut = ['especie', 'forma', 'tipo', 'estructura', 'formacion'];
    const tots = Array.from(xml.getElementsByTagName('*'));

    for (const node of tots) {
      for (const atribut of node.attributes ?? []) {
        const nomBaix = atribut.name.toLowerCase();
        if (paraulesClauAtribut.some((p) => nomBaix.includes(p)) && atribut.value.trim()) {
          return atribut.value.trim();
        }
      }
    }

    return null;
  }

  /**
   * Centroide aproximat d'un perímetre (mitjana simple dels vèrtexs, no
   * un centroide d'àrea real) -- prou bo per triar un únic punt
   * representatiu de la parcel·la a l'hora de consultar el MFE.
   *
   * @param {Array<[number, number]>} coordenades Vèrtexs [lat, lng]
   * @returns {[number, number]}
   */
  static centroideAproximat(coordenades) {
    const n = coordenades.length;
    const [sumaLat, sumaLng] = coordenades.reduce(
      ([sLat, sLng], [lat, lng]) => [sLat + lat, sLng + lng],
      [0, 0]
    );
    return [sumaLat / n, sumaLng / n];
  }
}
