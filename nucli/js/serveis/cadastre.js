// Consulta al Cadastre (Sede Electrónica del Catastro). Ve de Custòdia
// (js/serveis/cadastre.js) i n'amplia l'API, sense trencar-la:
//
//  - consultarPerPoligonParcela / consultarPerReferencia /
//    consultarParcelaEnPunt: les tres maneres de triar una parcel·la.
//    Retornen la geometria en UTM (EPSG:25830) com a "parts" (exterior +
//    forats), que és el que necessita el càlcul 3D, i també en lat/lng
//    (coordenades) per pintar-la a Leaflet.
//  - consultarParcela, consultarParcelesEnBBOX, consultarNomsPerCodis:
//    l'API que ja feia servir Custòdia, amb el mateix resultat.
//
// Comprovat amb respostes reals el 2026-10-15:
//  - el WFS i l'OVCCallejero admeten CORS (Access-Control-Allow-Origin: *),
//  - Consulta_DNPRC accepta Provincia i Municipio buits si es dona la
//    referència (RC) -- així se'n pot treure la descripció sense saber
//    el municipi,
//  - una geometria pot tenir diverses PolygonPatch (parts) i forats
//    (gml:interior); Custòdia només llegia el primer posList.
//
// Les geometries es demanen en EPSG:25830, també a Catalunya i Galícia
// (fus 31 / 29): el Cadastre les reprojecta, i el MDT de l'IGN té la
// mateixa cobertura, de manera que tot el càlcul es fa en un sol sistema
// en metres. A les Canàries (províncies 35 i 38) es demanen en EPSG:32628
// (UTM 28N), el sistema propi de les illes (comprovat el 2026-10-17).
// Cada resultat porta el seu sistema a "crs".

import { utmALatLng, latLngAUtm, EPSG_UTM, EPSG_CANARIES } from '../geometria/projeccio.js';
import { crsPer } from '../paisos/paisos.js';
import { puntDinsPart } from '../geometria/poligon.js';

const URL_CALLEJERO = 'https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC/OVCCallejero.asmx';
const URL_CONSULTA_REFERENCIA = `${URL_CALLEJERO}/Consulta_DNPPP`;
const URL_CONSULTA_PER_RC = `${URL_CALLEJERO}/Consulta_DNPRC`;
const URL_CONSULTA_PER_RC_CODIS =
  'https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC/OVCCallejeroCodigos.asmx/Consulta_DNPRC_Codigos';
const URL_WFS = 'https://ovc.catastro.meh.es/INSPIRE/wfsCP.aspx';

// El WFS retorna 0 resultats (sense cap error) si el requadre és gran:
// per a "la parcel·la d'aquest punt" n'hi ha prou amb uns pocs metres.
const MEIG_COSTAT_CERCA_PUNT = 5;

/** Element per nom local, sense dependre del prefix de namespace (gml:, cp:...). */
const perNom = (node, nom) => Array.from(node.getElementsByTagNameNS('*', nom));
const textDe = (node, nom) => perNom(node, nom)[0]?.textContent.trim() ?? null;

/** Sistema en què es treballa una referència: les Canàries són les províncies 35 i 38. */
export function crsDeReferencia(referencia) {
  return /^(35|38)/.test(referencia ?? '') ? EPSG_CANARIES : EPSG_UTM;
}

export class ServeiCadastre {
  /**
   * Referència cadastral normalitzada (majúscules, sense espais) de 14
   * caràcters -- la de la finca, que és la que entén el WFS. Accepta
   * també la de 20 caràcters (amb càrrec i dígits de control).
   */
  static normalitzarReferencia(text) {
    const neta = String(text ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (neta.length !== 14 && neta.length !== 18 && neta.length !== 20) return null;
    return neta.slice(0, 14);
  }

  /**
   * @returns {Promise<Parcela>} vegeu _resultat
   */
  static async consultarPerPoligonParcela(provincia, municipi, poligon, parcela) {
    if (!provincia || !municipi || !poligon || !parcela) {
      throw new Error('ServeiCadastre: calen provincia, municipi, poligon i parcela');
    }
    const dades = await ServeiCadastre._consultarReferencia(provincia, municipi, poligon, parcela);
    const geometria = await ServeiCadastre._consultarGeometria(dades.referenciaCadastral);
    return { ...geometria, ...dades, referenciaCadastral: geometria.referenciaCadastral };
  }

  static async consultarPerReferencia(text) {
    const referencia = ServeiCadastre.normalitzarReferencia(text);
    if (!referencia) {
      throw new Error('ServeiCadastre: la referència cadastral ha de tenir 14 o 20 caràcters');
    }
    const geometria = await ServeiCadastre._consultarGeometria(referencia);
    const descripcio = await ServeiCadastre._consultarDescripcio(referencia).catch(() => ({}));
    return { ...geometria, ...descripcio };
  }

  /**
   * Parcel·la que conté el punt donat, o null si no n'hi ha cap (per
   * exemple, un vial o una zona sense cartografia cadastral). El punt és
   * [lat, lng]; per compatibilitat també s'accepta [x, y] en EPSG:25830.
   */
  static async consultarParcelaEnPunt(punt) {
    const esUtm = Math.abs(punt[0]) > 180;
    const crs = esUtm ? EPSG_UTM : crsPer(punt);
    const [x, y] = esUtm ? punt : latLngAUtm(punt, crs);
    const m = MEIG_COSTAT_CERCA_PUNT;
    const xml = await ServeiCadastre._consultarWfsBbox(x - m, y - m, x + m, y + m, 20, crs);
    const candidates = perNom(xml, 'CadastralParcel').map((node) => ServeiCadastre._llegirParcela(node, crs));
    const trobada = candidates.find((p) => p.parts.some((part) => puntDinsPart([x, y], part)));
    if (!trobada) return null;
    const descripcio = await ServeiCadastre._consultarDescripcio(trobada.referenciaCadastral).catch(() => ({}));
    return { ...trobada, ...descripcio };
  }

  // --- API heretada de Custòdia -------------------------------------

  /** Igual que a Custòdia: {coordenades, referenciaCadastral, superficie, us, subparceles}. */
  static async consultarParcela(provincia, municipi, poligon, parcelaCadastral) {
    return ServeiCadastre.consultarPerPoligonParcela(provincia, municipi, poligon, parcelaCadastral);
  }

  /** Parcel·les dins d'un requadre lat/lng (vegeu l'avís sobre requadres grans). */
  static async consultarParcelesEnBBOX(minLat, minLng, maxLat, maxLng) {
    // Per latLngAUtm, no proj4 directament: és qui registra EPSG:25830 a
    // proj4. Si aquesta és la primera conversió de la pàgina (a Custòdia,
    // el mapa de selecció), proj4 encara no la coneixeria.
    const [minX, minY] = latLngAUtm([minLat, minLng]);
    const [maxX, maxY] = latLngAUtm([maxLat, maxLng]);
    const xml = await ServeiCadastre._consultarWfsBbox(minX, minY, maxX, maxY, 300);
    return perNom(xml, 'CadastralParcel').map((node) => {
      const parcela = ServeiCadastre._llegirParcela(node);
      return { ...parcela, ...ServeiCadastre._desglossarReferencia(parcela.referenciaCadastral) };
    });
  }

  /**
   * Parcel·les que toquen un requadre en metres ({minX, minY, maxX, maxY}
   * en el sistema crs), amb les parts en aquest mateix sistema: és el que
   * cal per creuar-les amb una línia (els tracks de Terra Rutes). El
   * requadre ha de ser petit (uns 700 m de costat com a molt): si és gran,
   * el WFS retorna 0 parcel·les sense cap error. Una parcel·la amb una
   * geometria buida es descarta.
   */
  static async consultarParcelesEnRequadre({ minX, minY, maxX, maxY }, crs = EPSG_UTM, maxim = 1000) {
    const xml = await ServeiCadastre._consultarWfsBbox(minX, minY, maxX, maxY, maxim, crs);
    return perNom(xml, 'CadastralParcel').flatMap((node) => {
      try {
        const parcela = ServeiCadastre._llegirParcela(node, crs);
        return [{ ...parcela, ...ServeiCadastre._desglossarReferencia(parcela.referenciaCadastral) }];
      } catch {
        return [];
      }
    });
  }

  /** Noms de província i municipi a partir dels codis (vegeu Custòdia). */
  static async consultarNomsPerCodis(codiProvincia, codiMunicipi, referenciaCadastral) {
    const params = new URLSearchParams({
      CodigoProvincia: codiProvincia,
      CodigoMunicipio: codiMunicipi,
      CodigoMunicipioINE: '',
      RC: referenciaCadastral,
    });
    const xml = await ServeiCadastre._xml(`${URL_CONSULTA_PER_RC_CODIS}?${params}`, 'consultar la província i el municipi');
    const provincia = textDe(xml, 'np');
    const municipi = textDe(xml, 'nm');
    if (!provincia || !municipi) {
      throw new Error('ServeiCadastre: no s\'ha pogut identificar la província i el municipi d\'aquesta referència');
    }
    return { provincia, municipi };
  }

  // --- Consultes internes --------------------------------------------

  /**
   * Polígon i parcel·la a partir d'una referència rústica de 14
   * caràcters (2 província + 3 municipi + "A" + 3 polígon + 5 parcel·la).
   */
  static _desglossarReferencia(referencia) {
    if (!referencia || referencia.length < 14 || referencia[5] !== 'A') {
      return { poligon: null, parcelaCadastral: null };
    }
    return {
      poligon: String(Number(referencia.slice(6, 9))),
      parcelaCadastral: String(Number(referencia.slice(9, 14))),
    };
  }

  // Consulta_DNPPP respon d'una de dues maneres: una única referència
  // (<bico>), o una llista (<lrcdnp>) quan la finca té part rústica i
  // unitats urbanes (un mas). Sempre volem la rústica (car="0000").
  static async _consultarReferencia(provincia, municipi, poligon, parcela) {
    const params = new URLSearchParams({ Provincia: provincia, Municipio: municipi, Poligono: poligon, Parcela: parcela });
    const xml = await ServeiCadastre._xml(`${URL_CONSULTA_REFERENCIA}?${params}`, 'consultar la referència cadastral');

    const bico = perNom(xml, 'bico')[0];
    if (bico) {
      return {
        referenciaCadastral: ServeiCadastre._referenciaDeNode(perNom(bico, 'rc')[0]),
        ...ServeiCadastre._llegirDescripcio(xml),
      };
    }

    const totes = perNom(xml, 'rcdnp');
    if (totes.length === 0) {
      throw new Error('ServeiCadastre: no s\'ha trobat cap parcel·la amb aquestes dades');
    }
    const principal = totes.find((node) => textDe(node, 'car') === '0000') ?? totes[0];
    const referenciaCadastral = ServeiCadastre._referenciaDeNode(perNom(principal, 'rc')[0]);
    // La descripció es demana amb la referència de 18 caràcters (14 + el
    // "car" de la unitat rústica), com feia Custòdia: identifica la unitat
    // concreta, mentre que amb la de 14 el Cadastre pot tornar a respondre
    // amb la llista d'unitats, sense ús ni subparcel·les.
    const car = textDe(principal, 'car') ?? '';
    const descripcio = await ServeiCadastre._consultarDescripcio(`${referenciaCadastral}${car}`).catch(() => ({}));
    return { referenciaCadastral, ...descripcio };
  }

  /** Descripció (ldt), ús, municipi, província i subparcel·les d'una referència. */
  static async _consultarDescripcio(referencia) {
    const params = new URLSearchParams({ Provincia: '', Municipio: '', RC: referencia });
    const xml = await ServeiCadastre._xml(`${URL_CONSULTA_PER_RC}?${params}`, 'consultar la descripció de la parcel·la');
    return ServeiCadastre._llegirDescripcio(xml);
  }

  static _llegirDescripcio(xml) {
    return {
      descripcio: textDe(xml, 'ldt'),
      us: textDe(xml, 'luso'),
      provincia: textDe(xml, 'np'),
      municipi: textDe(xml, 'nm'),
      subparceles: perNom(xml, 'spr').map((spr) => ({
        cspr: textDe(spr, 'cspr'),
        ccc: textDe(spr, 'ccc'),
        dcc: textDe(spr, 'dcc'),
        ip: textDe(spr, 'ip'),
        ssp: textDe(spr, 'ssp'),
      })),
    };
  }

  static _referenciaDeNode(nodeRc) {
    const pc1 = nodeRc && textDe(nodeRc, 'pc1');
    const pc2 = nodeRc && textDe(nodeRc, 'pc2');
    if (!pc1 || !pc2) throw new Error('ServeiCadastre: resposta sense referència cadastral vàlida');
    return `${pc1}${pc2}`;
  }

  static async _consultarGeometria(referencia) {
    const crs = crsDeReferencia(referencia);
    const params = new URLSearchParams({
      service: 'wfs',
      version: '2',
      request: 'getfeature',
      STOREDQUERIE_ID: 'GetParcel',
      refcat: referencia,
      srsname: crs.replace(':', '::'),
    });
    const xml = await ServeiCadastre._xml(`${URL_WFS}?${params}`, 'consultar la geometria de la parcel·la');
    const node = perNom(xml, 'CadastralParcel')[0];
    if (!node) throw new Error('ServeiCadastre: no s\'ha trobat la geometria de la parcel·la');
    const parcela = ServeiCadastre._llegirParcela(node, crs);
    return { ...parcela, referenciaCadastral: parcela.referenciaCadastral ?? referencia };
  }

  static async _consultarWfsBbox(minX, minY, maxX, maxY, maxim, crs = EPSG_UTM) {
    // Format confirmat a Custòdia: Typenames amb punt i SRSname a part.
    const params = new URLSearchParams({
      service: 'wfs',
      request: 'getfeature',
      Typenames: 'cp.cadastralparcel',
      SRSname: crs.replace(':', '::'),
      bbox: `${minX},${minY},${maxX},${maxY}`,
      count: String(maxim),
    });
    return ServeiCadastre._xml(`${URL_WFS}?${params}`, 'consultar les parcel·les de la zona');
  }

  /**
   * Una parcel·la del WFS: referència, superfície oficial i geometria
   * (parts en UTM + contorn exterior de la part principal en lat/lng).
   */
  static _llegirParcela(node, crs = EPSG_UTM) {
    const parts = perNom(node, 'PolygonPatch').map((patch) => ({
      exterior: ServeiCadastre._llegirPosList(textDe(perNom(patch, 'exterior')[0], 'posList')),
      interiors: perNom(patch, 'interior').map((interior) =>
        ServeiCadastre._llegirPosList(textDe(interior, 'posList'))
      ),
    }));
    const valida = parts.filter((p) => p.exterior.length >= 3);
    if (valida.length === 0) throw new Error('ServeiCadastre: geometria de la parcel·la buida');
    const superficie = textDe(node, 'areaValue');
    return {
      referenciaCadastral: textDe(node, 'nationalCadastralReference'),
      superficie: superficie ? Number(superficie) : null,
      parts: valida,
      crs,
      coordenades: valida[0].exterior.map((punt) => utmALatLng(punt, crs)),
    };
  }

  static _llegirPosList(text) {
    const valors = String(text ?? '').trim().split(/\s+/).map(Number);
    const parelles = [];
    for (let i = 0; i + 1 < valors.length; i += 2) parelles.push([valors[i], valors[i + 1]]);
    return parelles;
  }

  static async _xml(url, descripcio) {
    let resposta;
    try {
      resposta = await fetch(url);
    } catch (error) {
      throw new Error(`ServeiCadastre: no s'ha pogut ${descripcio} (${error.message})`);
    }
    if (!resposta.ok) {
      throw new Error(`ServeiCadastre: el Cadastre ha retornat un error en ${descripcio} (${resposta.status})`);
    }
    const xml = new DOMParser().parseFromString(await resposta.text(), 'application/xml');
    if (xml.getElementsByTagName('parsererror').length > 0) {
      throw new Error('ServeiCadastre: resposta del Cadastre no interpretable');
    }
    // El Cadastre retorna els errors de dades dins d'un XML correcte
    // (<lerr><err><des>...): es converteixen en un error de debò.
    const error = perNom(xml, 'err')[0];
    if (error) {
      throw new Error(`ServeiCadastre: ${textDe(error, 'des') ?? 'error desconegut'}`);
    }
    return xml;
  }
}
