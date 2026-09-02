// Consulta al Cadastre. Dos passos: primer Consulta_DNPPP (provincia +
// municipi + poligon + parcela -> referencia cadastral), després el WFS
// GetParcel (referencia -> geometria). Les coordenades venen en
// EPSG:25830 (UTM ETRS89 30N), es converteixen a lat/lng amb proj4
// perquè Leaflet les pugui pintar.
//
// L'ús de la parcel·la es mostra tal com el retorna el Cadastre
// (<debi><luso>, per exemple "Agrario"), sense cap classificació ni
// interpretació pròpia -- decisió deliberada per mantenir-ho senzill i
// fidel a la font original, en lloc d'intentar encaixar-ho en unes
// categories pròpies.
//
// Nota CORS: aquests serveis estan pensats per a consum des de servidor.
// Si fetch() falla per un bloqueig CORS (no un 4xx/5xx, sinó un error
// abans de rebre resposta), caldrà un petit proxy propi. Ho deixo apuntat
// aquí perquè, si passa, el canvi quedi aïllat en aquest fitxer.

const URL_CONSULTA_REFERENCIA =
  'https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC/OVCCallejero.asmx/Consulta_DNPPP';
const URL_CONSULTA_PER_RC =
  'https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC/OVCCallejero.asmx/Consulta_DNPRC';
const URL_WFS = 'https://ovc.catastro.meh.es/INSPIRE/wfsCP.aspx';
// Servei bessó de Consulta_DNPRC, però amb codis numèrics de província i
// municipi en lloc dels seus noms -- útil quan es parteix d'una
// referència del WFS (que ja porta els codis, no els noms) i es vol
// evitar passar per ConsultaMunicipio, un servei que mai s'ha pogut
// confirmar del tot amb una resposta real i que s'ha demostrat que no
// llegim correctament per a algun municipi (vegeu _desglossarReferencia).
const URL_CONSULTA_PER_RC_CODIS =
  'https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC/OVCCallejeroCodigos.asmx/Consulta_DNPRC_Codigos';

const EPSG_CATASTRE = 'EPSG:25830';
const DEFINICIO_EPSG_25830 =
  '+proj=utm +zone=30 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs';

if (typeof proj4 !== 'undefined' && !proj4.defs(EPSG_CATASTRE)) {
  proj4.defs(EPSG_CATASTRE, DEFINICIO_EPSG_25830);
}

export class ServeiCadastre {
  static async consultarParcela(provincia, municipi, poligon, parcelaCadastral) {
    if (!provincia || !municipi || !poligon || !parcelaCadastral) {
      throw new Error(
        'ServeiCadastre: calen provincia, municipi, poligon i parcelaCadastral'
      );
    }

    const { referenciaCadastral, us, subparceles } = await ServeiCadastre._consultarReferencia(
      provincia,
      municipi,
      poligon,
      parcelaCadastral
    );

    const geometria = await ServeiCadastre._consultarGeometria(referenciaCadastral);

    return { ...geometria, us, subparceles };
  }

  /**
   * Totes les parcel·les rústiques visibles dins d'un requadre del mapa
   * (BBOX), consultades directament al WFS del Cadastre -- mateix
   * servei que ja fem servir per obtenir la geometria d'una parcel·la
   * concreta, però aquí per requadre en lloc de per referència.
   *
   * Cada parcel·la ja porta desglossats el polígon i la parcel·la
   * (extrets de la seva pròpia referència cadastral, sense cap consulta
   * addicional) -- vegeu _desglossarReferencia.
   *
   * @param {number} minLat @param {number} minLng
   * @param {number} maxLat @param {number} maxLng
   * @returns {Promise<Array<{referenciaCadastral: string, coordenades: Array<[number, number]>, superficie: number|null, poligon: string|null, parcelaCadastral: string|null}>>}
   */
  static async consultarParcelesEnBBOX(minLat, minLng, maxLat, maxLng) {
    if (typeof proj4 === 'undefined') {
      throw new Error('ServeiCadastre: cal carregar proj4 abans d\'aquest mòdul.');
    }

    const [minX, minY] = proj4('EPSG:4326', EPSG_CATASTRE, [minLng, minLat]);
    const [maxX, maxY] = proj4('EPSG:4326', EPSG_CATASTRE, [maxLng, maxLat]);

    // Format de paràmetres confirmat amb una consulta real (no el que
    // suggeria un exemple de tercers): Typenames amb punt (no dos punts)
    // i SRSname com a paràmetre a part, no enganxat al bbox. "count"
    // limita el nombre de parcel·les per evitar respostes enormes (i
    // lentes o poc fiables) si el requadre visible és molt gran.
    const params = new URLSearchParams({
      service: 'wfs',
      request: 'getfeature',
      Typenames: 'cp.cadastralparcel',
      SRSname: 'EPSG::25830',
      bbox: `${minX},${minY},${maxX},${maxY}`,
      count: '300',
    });
    const url = `${URL_WFS}?${params.toString()}`;
    console.log('[mapa-cadastre] URL de la consulta WFS:', url);

    const text = await ServeiCadastre._peticio(url, 'consultar les parcel·les visibles al mapa');
    const xml = ServeiCadastre._parsejarXml(text);

    // querySelector no és sensible al prefix de namespace (cp:) tal com
    // ja fem servir a _consultarGeometria -- coincideix pel nom local.
    const nodesParcela = Array.from(xml.querySelectorAll('CadastralParcel'));

    return nodesParcela
      .map((node) => {
        const nodePosList = node.querySelector('posList');
        if (!nodePosList) return null;

        const coordenadesUtm = ServeiCadastre._llegirPosList(nodePosList.textContent);
        const coordenades = coordenadesUtm.map(([x, y]) => ServeiCadastre._utmALatLng(x, y));
        const referenciaCadastral =
          node.querySelector('nationalCadastralReference')?.textContent.trim() ?? null;
        const nodeSuperficie = node.querySelector('areaValue');

        return {
          referenciaCadastral,
          coordenades,
          superficie: nodeSuperficie ? Number(nodeSuperficie.textContent.trim()) : null,
          ...ServeiCadastre._desglossarReferencia(referenciaCadastral),
        };
      })
      .filter(Boolean);
  }

  /**
   * Polígon i parcel·la a partir de la referència cadastral rústica de
   * 14 caràcters (2 provincia + 3 municipi + "A" rústica + 3 polígon +
   * 5 parcela) -- confirmat amb dades reals del WFS. Si la referència
   * no segueix aquest format (per exemple, una unitat urbana), es
   * retorna sense desglossar en lloc d'assumir-ho.
   */
  /**
   * Nom real de la província i el municipi a partir dels seus codis
   * numèrics (els mateixos que ja porta la referència cadastral) i la
   * pròpia referència -- consulta Consulta_DNPRC_Codigos, no
   * ConsultaMunicipio, per evitar dependre d'un servei l'estructura del
   * qual mai s'ha confirmat del tot (vegeu ServeiUbicacions). Encara no
   * s'ha pogut validar amb una resposta real -- cal fer-ho abans de
   * confiar-hi del tot.
   *
   * @returns {Promise<{provincia: string, municipi: string}>}
   */
  static async consultarNomsPerCodis(codiProvincia, codiMunicipi, referenciaCadastral) {
    const params = new URLSearchParams({
      CodigoProvincia: codiProvincia,
      CodigoMunicipio: codiMunicipi,
      CodigoMunicipioINE: '',
      RC: referenciaCadastral,
    });
    const url = `${URL_CONSULTA_PER_RC_CODIS}?${params.toString()}`;

    const text = await ServeiCadastre._peticio(url, 'consultar la província i el municipi d\'aquesta referència');
    const xml = ServeiCadastre._parsejarXml(text);

    const provincia = xml.querySelector('np')?.textContent.trim();
    const municipi = xml.querySelector('nm')?.textContent.trim();
    if (!provincia || !municipi) {
      throw new Error('ServeiCadastre: no s\'ha pogut identificar la província i el municipi d\'aquesta referència');
    }

    return { provincia, municipi };
  }

  static _desglossarReferencia(referencia) {
    if (!referencia || referencia.length < 14 || referencia[5] !== 'A') {
      return { poligon: null, parcelaCadastral: null };
    }
    return {
      poligon: String(Number(referencia.slice(6, 9))),
      parcelaCadastral: String(Number(referencia.slice(9, 14))),
    };
  }

  // Consulta_DNPPP respon de dues maneres: una única referencia dins de
  // <bico><bi><idbi>, o diverses sota <lrcdnp><rcdnp> (no son resultats
  // alternatius d'una cerca ambigua, sino la mateixa propietat amb
  // diverses referencies -- típic d'un mas: part rústica car="0000" +
  // unitats urbanes car="0001", "0002"...). Sempre volem la rústica.
  //
  // Només la resposta d'única referencia (cas A) porta <debi><luso>, el
  // camp que fem servir directament com a "us" -- el cas B no en té, i
  // l'us queda null (es mostrarà com "No disponible" a la interfície).
  static async _consultarReferencia(provincia, municipi, poligon, parcelaCadastral) {
    const params = new URLSearchParams({
      Provincia: provincia,
      Municipio: municipi,
      Poligono: poligon,
      Parcela: parcelaCadastral,
    });
    const url = `${URL_CONSULTA_REFERENCIA}?${params.toString()}`;

    const text = await ServeiCadastre._peticio(url, 'consultar la referencia cadastral');
    const xml = ServeiCadastre._parsejarXml(text);

    const rcUnic = xml.querySelector('bico > bi > idbi > rc');
    if (rcUnic) {
      return {
        referenciaCadastral: ServeiCadastre._referenciaDesDeNodeRc(rcUnic),
        us: xml.querySelector('bico > bi > debi > luso')?.textContent.trim() ?? null,
        subparceles: ServeiCadastre._extreureSubparceles(xml),
      };
    }

    const totes = Array.from(xml.getElementsByTagName('rcdnp'));
    if (totes.length === 0) {
      throw new Error('ServeiCadastre: no s\'ha trobat cap parcel·la amb aquestes dades');
    }

    const principal =
      totes.find((node) => node.querySelector('car')?.textContent.trim() === '0000') ??
      totes[0];

    const nodeRc = principal.querySelector('rc');
    const referenciaCadastral = ServeiCadastre._referenciaDesDeNodeRc(nodeRc);
    const car = nodeRc?.querySelector('car')?.textContent.trim();

    // La resposta "de llista" (aquesta, cas B) no porta <lspr>. Però amb
    // el "car" ja sabem exactament quina unitat concreta volem (la
    // rústica, car="0000") -- consultant-la amb la seva referència
    // completa (14+4=18 caràcters) via Consulta_DNPRC hauria de
    // desambiguar-la del tot i donar la resposta "d'única coincidència",
    // que sí porta el desglossament. No bloquejant: si falla, es queda
    // buit, com fins ara.
    let subparceles = [];
    if (car) {
      try {
        subparceles = await ServeiCadastre._consultarSubparcelesPerReferencia(
          provincia,
          municipi,
          `${referenciaCadastral}${car}`
        );
      } catch (error) {
        console.warn('ServeiCadastre: no s\'ha pogut obtenir el desglossament del mas:', error);
      }
    }

    return { referenciaCadastral, us: null, subparceles };
  }

  /**
   * Consulta Consulta_DNPRC amb una referència cadastral completa
   * (18/20 caràcters, no la de 14 d'una finca sencera) per obtenir el
   * desglossament <lspr> d'una unitat concreta -- útil quan la consulta
   * per polígon/parcel·la ha tornat la resposta "de llista" (cas d'un
   * mas amb part rústica + unitats urbanes) sense aquest detall.
   */
  static async _consultarSubparcelesPerReferencia(provincia, municipi, referenciaLlarga) {
    const params = new URLSearchParams({
      Provincia: provincia,
      Municipio: municipi,
      RC: referenciaLlarga,
    });
    const url = `${URL_CONSULTA_PER_RC}?${params.toString()}`;

    const text = await ServeiCadastre._peticio(url, 'consultar les subparceles per referència');
    const xml = ServeiCadastre._parsejarXml(text);
    return ServeiCadastre._extreureSubparceles(xml);
  }

  static _referenciaDesDeNodeRc(nodeRc) {
    const pc1 = nodeRc?.querySelector('pc1')?.textContent.trim();
    const pc2 = nodeRc?.querySelector('pc2')?.textContent.trim();
    if (!pc1 || !pc2) {
      throw new Error('ServeiCadastre: resposta sense referència cadastral vàlida');
    }
    return `${pc1}${pc2}`;
  }

  /**
   * Llegeix el desglossament <lspr><spr> (si n'hi ha) i en retorna una
   * llista d'objectes, un per subparcela, amb tots els camps que porta
   * el Cadastre -- no només els que fem servir ara (dcc, ssp), també
   * cspr (lletra identificadora), ccc (codi curt de cultiu) i ip
   * (índex de productivitat, significat exacte no confirmat), per no
   * haver de tornar a consultar el Cadastre si algun dia calen.
   *
   * @returns {Array<{cspr: string|null, ccc: string|null, dcc: string|null, ip: string|null, ssp: string|null}>}
   */
  static _extreureSubparceles(xml) {
    const subparceles = Array.from(xml.querySelectorAll('lspr > spr'));

    return subparceles.map((subparcela) => ({
      cspr: subparcela.querySelector('cspr')?.textContent.trim() ?? null,
      ccc: subparcela.querySelector('ccc')?.textContent.trim() ?? null,
      dcc: subparcela.querySelector('dcc')?.textContent.trim() ?? null,
      ip: subparcela.querySelector('ip')?.textContent.trim() ?? null,
      ssp: subparcela.querySelector('ssp')?.textContent.trim() ?? null,
    }));
  }

  static async _consultarGeometria(referenciaCadastral) {
    const params = new URLSearchParams({
      service: 'wfs',
      version: '2',
      request: 'getfeature',
      STOREDQUERIE_ID: 'GetParcel',
      refcat: referenciaCadastral,
      srsname: 'EPSG::25830',
    });
    const url = `${URL_WFS}?${params.toString()}`;

    const text = await ServeiCadastre._peticio(url, 'consultar la geometria de la parcel·la');
    const xml = ServeiCadastre._parsejarXml(text);

    const nodePosList = xml.querySelector('posList');
    if (!nodePosList) {
      throw new Error('ServeiCadastre: no s\'ha trobat la geometria de la parcel·la');
    }

    const coordenadesUtm = ServeiCadastre._llegirPosList(nodePosList.textContent);
    const coordenades = coordenadesUtm.map(([x, y]) => ServeiCadastre._utmALatLng(x, y));

    const nodeReferencia = xml.querySelector('nationalCadastralReference');
    const nodeSuperficie = xml.querySelector('areaValue');

    return {
      coordenades,
      referenciaCadastral: nodeReferencia
        ? nodeReferencia.textContent.trim()
        : referenciaCadastral,
      superficie: nodeSuperficie ? Number(nodeSuperficie.textContent.trim()) : null,
    };
  }

  static async _peticio(url, descripcio) {
    let resposta;
    try {
      resposta = await fetch(url);
    } catch (error) {
      throw new Error(
        `ServeiCadastre: no s'ha pogut ${descripcio} (${error.message}). ` +
        'Si es un bloqueig de CORS, cal un proxy de servidor.'
      );
    }
    if (!resposta.ok) {
      throw new Error(
        `ServeiCadastre: el Cadastre ha retornat un error en ${descripcio} (${resposta.status})`
      );
    }
    return resposta.text();
  }

  static _parsejarXml(text) {
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'application/xml');
    if (xml.querySelector('parsererror')) {
      throw new Error('ServeiCadastre: resposta del Cadastre no interpretable');
    }
    return xml;
  }

  static _llegirPosList(text) {
    const valors = text.trim().split(/\s+/).map(Number);
    const parelles = [];
    for (let i = 0; i < valors.length; i += 2) {
      parelles.push([valors[i], valors[i + 1]]);
    }
    return parelles;
  }

  static _utmALatLng(x, y) {
    if (typeof proj4 === 'undefined') {
      throw new Error('ServeiCadastre: cal carregar proj4 abans d\'aquest mòdul.');
    }
    const [lng, lat] = proj4(EPSG_CATASTRE, 'EPSG:4326', [x, y]);
    return [lat, lng];
  }
}
