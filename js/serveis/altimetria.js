// Consulta l'altitud de punts sobre el Model Digital del Terreny (MDT)
// de l'IGN/IDEE. Igual que ServeiCadastre, només parla amb un servei
// extern i normalitza el resultat -- no sap res de Parcela ni de la BD.

const URL_GET_ELEVATION = 'https://api-processes.idee.es/processes/getElevation/execution';

const RADI_TERRA_M = 6371000;

export class ServeiAltimetria {
  /**
   * Consulta l'altitud de cada punt donat, en el mateix ordre en què
   * s'han passat.
   *
   * IMPORTANT: es demana el paràmetre `withCoord` perquè el servei
   * retorni la coordenada juntament amb cada altitud, i s'aparellen els
   * resultats per coordenada (no per posició). Amb pocs punts (com els
   * vèrtexs d'un perímetre) l'API sembla mantenir l'ordre d'entrada,
   * però amb moltes desenes/centenes de punts (com una malla) no es pot
   * donar per fet -- confiar-hi va provocar un càlcul de pendent
   * completament esbiaixat, ja que quedaven aparellades altituds de
   * punts que en realitat no eren veïns.
   *
   * @param {Array<[number, number]>} coordenades Punts [lat, lng]
   * @returns {Promise<number[]>} Una altitud (m) per cada coordenada, mateix ordre que l'entrada
   */
  static async consultarAltituds(coordenades) {
    if (!Array.isArray(coordenades) || coordenades.length === 0) {
      throw new Error('ServeiAltimetria: calen coordenades');
    }

    // WKT vol (lon lat), no (lat lon) com fem servir nosaltres internament.
    const punts = coordenades.map(([lat, lng]) => `(${lng} ${lat})`).join(',');
    const geom = `MULTIPOINT(${punts})`;

    let resposta;
    try {
      resposta = await fetch(URL_GET_ELEVATION, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputs: { geom, formato: 'wkt', crs: 4326, withCoord: true },
        }),
      });
    } catch (error) {
      throw new Error(`ServeiAltimetria: no s'ha pogut consultar l'altitud (${error.message})`);
    }

    if (!resposta.ok) {
      throw new Error(`ServeiAltimetria: el servei d'altimetria ha retornat un error (${resposta.status})`);
    }

    const dades = await resposta.json();
    const valors = dades.values ?? [];

    if (valors.length === 0) {
      throw new Error('ServeiAltimetria: el servei no ha retornat cap altitud');
    }

    // Amb withCoord, cada element és [lon, lat, altitud]. Es fa un mapa
    // "lat,lng arrodonits" -> altitud, i es reconstrueix l'array de
    // sortida en l'ordre original de `coordenades`, en lloc de confiar
    // en l'ordre en què arriben.
    const CLAU_DECIMALS = 6;
    const clau = (lat, lng) => `${lat.toFixed(CLAU_DECIMALS)},${lng.toFixed(CLAU_DECIMALS)}`;

    const altitudPerClau = new Map();
    for (const valor of valors) {
      const [lng, lat, altitud] = valor;
      altitudPerClau.set(clau(lat, lng), altitud);
    }

    const altituds = coordenades.map(([lat, lng]) => {
      const trobat = altitudPerClau.get(clau(lat, lng));
      if (trobat === undefined) {
        throw new Error(
          `ServeiAltimetria: el servei no ha retornat l'altitud d'un dels punts consultats`
        );
      }
      return trobat;
    });

    return altituds;
  }

  /**
   * A partir del perímetre i les seves altituds (mateix ordre), calcula
   * els valors resum: altitud màxima/mínima, desnivell (la diferència
   * entre totes dues) i pendent mitjà del perímetre.
   *
   * El pendent es calcula tram a tram (entre cada dos vèrtexs consecutius)
   * com a desnivell/distància horitzontal, i es fa una mitjana ponderada
   * per la longitud de cada tram -- no és el pendent de tota la
   * superfície interior (per això caldria un model de terreny complet),
   * només una aproximació raonable a partir del contorn.
   *
   * @param {Array<[number, number]>} coordenades Vèrtexs [lat, lng]
   * @param {number[]} altituds Una altitud (m) per vèrtex, mateix ordre
   * @returns {{minima: number, maxima: number, desnivell: number, pendentMitja: number}}
   */
  static calcularResum(coordenades, altituds) {
    const minima = Math.min(...altituds);
    const maxima = Math.max(...altituds);

    let sumaPendentPonderat = 0;
    let sumaDistancies = 0;

    for (let i = 0; i < coordenades.length - 1; i++) {
      const distancia = ServeiAltimetria._distanciaMetres(coordenades[i], coordenades[i + 1]);
      if (distancia === 0) continue; // punts duplicats (p. ex. tancament del perímetre)

      const desnivellTram = Math.abs(altituds[i + 1] - altituds[i]);
      const pendentTram = (desnivellTram / distancia) * 100;

      sumaPendentPonderat += pendentTram * distancia;
      sumaDistancies += distancia;
    }

    const pendentMitja = sumaDistancies > 0 ? sumaPendentPonderat / sumaDistancies : 0;

    return { minima, maxima, desnivell: maxima - minima, pendentMitja };
  }

  /** Distància en metres entre dos punts [lat, lng] (fórmula de Haversine). */
  static _distanciaMetres([lat1, lng1], [lat2, lng2]) {
    const aRad = (graus) => (graus * Math.PI) / 180;
    const dLat = aRad(lat2 - lat1);
    const dLng = aRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(aRad(lat1)) * Math.cos(aRad(lat2)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return RADI_TERRA_M * c;
  }

  /**
   * Calcula el resum (mínima, màxima, desnivell, pendent mitjà) a partir
   * d'una graella de punts (Malla.generar) i les seves altituds, ja
   * col·locades a la mateixa posició (fila, columna) que la graella.
   *
   * El pendent de cada punt es calcula amb el mètode de Horn (1981), el
   * mateix que fan servir per defecte QGIS i ArcGIS per calcular
   * pendents sobre un model de terreny: es fa servir tota la finestra
   * 3x3 de veïns (els 4 directes + les 4 diagonals, ponderant més els
   * directes), no només un parell de veïns -- això suavitza el soroll
   * puntual del propi model de terreny, que amb un mètode més senzill
   * (comparar només amb un veí a cada direcció) es notava massa.
   *
   * Quan un veí no existeix (vora de la malla o fora del perímetre), es
   * fa servir el valor del propi punt central en el seu lloc -- conveni
   * habitual en processament de models de terreny per no introduir cap
   * biaix als límits (equival a dir "aquí no hi ha canvi conegut").
   *
   * @param {Array<Array<[number, number]|null>>} graella
   * @param {Array<Array<number|null>>} altitudsGraella Mateixa forma que graella
   * @param {number} distanciaMetres Separació entre punts de la malla
   */
  static calcularResumMalla(graella, altitudsGraella, distanciaMetres) {
    const totesLesAltituds = altitudsGraella.flat().filter((a) => a !== null && a !== undefined);
    if (totesLesAltituds.length === 0) {
      throw new Error('ServeiAltimetria: la malla no té cap punt dins del perímetre');
    }

    const minima = Math.min(...totesLesAltituds);
    const maxima = Math.max(...totesLesAltituds);

    const altitudA = (f, c, perDefecte) => {
      const valor = altitudsGraella[f]?.[c];
      return valor == null ? perDefecte : valor;
    };

    const pendents = [];
    for (let f = 0; f < graella.length; f++) {
      for (let c = 0; c < graella[f].length; c++) {
        const centre = altitudsGraella[f]?.[c];
        if (centre == null) continue;

        // "f" creix cap al nord i "c" cap a l'est, per com Malla.generar
        // construeix la graella (vegeu js/geometria/malla.js).
        const nord = altitudA(f + 1, c, centre);
        const sud = altitudA(f - 1, c, centre);
        const est = altitudA(f, c + 1, centre);
        const oest = altitudA(f, c - 1, centre);
        const nordEst = altitudA(f + 1, c + 1, centre);
        const nordOest = altitudA(f + 1, c - 1, centre);
        const sudEst = altitudA(f - 1, c + 1, centre);
        const sudOest = altitudA(f - 1, c - 1, centre);

        const dzdx = (nordEst + 2 * est + sudEst - (nordOest + 2 * oest + sudOest)) / (8 * distanciaMetres);
        const dzdy = (nordOest + 2 * nord + nordEst - (sudOest + 2 * sud + sudEst)) / (8 * distanciaMetres);

        pendents.push(Math.sqrt(dzdx ** 2 + dzdy ** 2) * 100);
      }
    }

    const pendentMitja =
      pendents.length > 0 ? pendents.reduce((s, p) => s + p, 0) / pendents.length : 0;

    return { minima, maxima, desnivell: maxima - minima, pendentMitja };
  }
}
