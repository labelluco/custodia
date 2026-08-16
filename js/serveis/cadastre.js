// Consulta al Cadastre. Dos passos: primer Consulta_DNPPP (provincia +
// municipi + poligon + parcela -> referencia cadastral), després el WFS
// GetParcel (referencia -> geometria). Les coordenades venen en
// EPSG:25830 (UTM ETRS89 30N), es converteixen a lat/lng amb proj4
// perquè Leaflet les pugui pintar.
//
// Nota CORS: aquests serveis estan pensats per a consum des de servidor.
// Si fetch() falla per un bloqueig CORS (no un 4xx/5xx, sinó un error
// abans de rebre resposta), caldrà un petit proxy propi. Ho deixo apuntat
// aquí perquè, si passa, el canvi quedi aïllat en aquest fitxer.

const URL_CONSULTA_REFERENCIA =
  'https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC/OVCCallejero.asmx/Consulta_DNPPP';
const URL_WFS = 'https://ovc.catastro.meh.es/INSPIRE/wfsCP.aspx';

const EPSG_CATASTRE = 'EPSG:25830';
const DEFINICIO_EPSG_25830 =
  '+proj=utm +zone=30 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs';

if (typeof proj4 !== 'undefined' && !proj4.defs(EPSG_CATASTRE)) {
  proj4.defs(EPSG_CATASTRE, DEFINICIO_EPSG_25830);
}

// Paraules clau per classificar la descripció de cada subparcela (<dcc> del
// desglossament <lspr>) en un dels nostres USOS. No es basa en els codis
// (<ccc>, poc intuïtius) sinó en el text, més estable de llegir i ajustar.
const PARAULES_CLAU_US = {
  agricola: ['labor', 'labradio', 'labradío', 'frutal', 'viña', 'vinya', 'hortaliza', 'huerta', 'regadio', 'regadío', 'secano'],
  pastura: ['pasto', 'prado', 'pradera'],
  forestal: ['pinar', 'forestal', 'monte', 'arbolado', 'eucalipto', 'encinar', 'matorral', 'coniferas'],
};

export class ServeiCadastre {
  static async consultarParcela(provincia, municipi, poligon, parcelaCadastral) {
    if (!provincia || !municipi || !poligon || !parcelaCadastral) {
      throw new Error(
        'ServeiCadastre: calen provincia, municipi, poligon i parcelaCadastral'
      );
    }

    const { referenciaCadastral, usSuggerit } = await ServeiCadastre._consultarReferencia(
      provincia,
      municipi,
      poligon,
      parcelaCadastral
    );

    const geometria = await ServeiCadastre._consultarGeometria(referenciaCadastral);

    return { ...geometria, usSuggerit };
  }

  // Consulta_DNPPP respon de dues maneres: una única referencia dins de
  // <bico><bi><idbi>, o diverses sota <lrcdnp><rcdnp> (no son resultats
  // alternatius d'una cerca ambigua, sino la mateixa propietat amb
  // diverses referencies -- típic d'un mas: part rústica car="0000" +
  // unitats urbanes car="0001", "0002"...). Sempre volem la rústica.
  //
  // Quan la resposta és d'una única referencia (cas A), sol portar també
  // <lspr>, un desglossament de la parcel·la per subparceles (cada una
  // amb el seu ús: labor, pastos, pinar...). L'aprofitem per suggerir un
  // us -- si totes les subparceles cauen en la mateixa categoria, la
  // suggerim; si n'hi ha de diverses, marquem "mix" perquè l'usuari
  // decideixi. En el cas B (diverses referencies) no en tenim, i tornem
  // usSuggerit a null: l'usuari l'haurà de triar manualment, com fins ara.
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
        usSuggerit: ServeiCadastre._suggerirUs(xml),
      };
    }

    const totes = Array.from(xml.getElementsByTagName('rcdnp'));
    if (totes.length === 0) {
      throw new Error('ServeiCadastre: no s\'ha trobat cap parcel·la amb aquestes dades');
    }

    const principal =
      totes.find((node) => node.querySelector('car')?.textContent.trim() === '0000') ??
      totes[0];

    // Diverses referencies (rústica + urbanes, típic d'un mas) ja és, per si
    // sol, un indici de "mix" -- aquesta resposta no porta <lspr>, així que
    // no podem afinar més, però tampoc té sentit deixar-ho sense suggeriment.
    return {
      referenciaCadastral: ServeiCadastre._referenciaDesDeNodeRc(principal.querySelector('rc')),
      usSuggerit: totes.length > 1 ? 'mix' : null,
    };
  }

  /**
   * Llegeix el desglossament <lspr><spr> (si n'hi ha) i en dedueix un us
   * suggerit: la categoria si totes les subparceles hi encaixen, "mix" si
   * n'hi ha de diverses, o null si no hi ha desglossament o cap paraula
   * clau hi encaixa.
   */
  static _suggerirUs(xml) {
    const subparceles = Array.from(xml.querySelectorAll('lspr > spr'));
    if (subparceles.length === 0) {
      return null;
    }

    const categories = new Set();
    for (const subparcela of subparceles) {
      const descripcio = subparcela.querySelector('dcc')?.textContent.trim().toLowerCase();
      if (!descripcio) continue;

      const categoria = Object.entries(PARAULES_CLAU_US).find(([, paraules]) =>
        paraules.some((paraula) => descripcio.includes(paraula))
      )?.[0];

      categories.add(categoria ?? 'altre');
    }

    if (categories.size === 0) return null;
    if (categories.size === 1) return [...categories][0];
    return 'mix';
  }

  static _referenciaDesDeNodeRc(nodeRc) {
    const pc1 = nodeRc?.querySelector('pc1')?.textContent.trim();
    const pc2 = nodeRc?.querySelector('pc2')?.textContent.trim();
    if (!pc1 || !pc2) {
      throw new Error('ServeiCadastre: resposta sense referència cadastral vàlida');
    }
    return `${pc1}${pc2}`;
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
