// Genera una malla regular de punts dins d'un perímetre, organitzada com
// una graella (files x columnes), per calcular el pendent de tota la
// superfície -- no només el contorn. Pura geometria: no sap res de
// Leaflet, de la BD ni de cap servei extern.

const METRES_PER_GRAU_LATITUD = 111320; // aproximat, prou bo a aquesta escala

export class Malla {
  /**
   * @param {Array<[number, number]>} perimetre Vèrtexs [lat, lng] que tanquen la parcel·la
   * @param {number} distanciaMetres Separació desitjada entre punts, en metres
   * @returns {{graella: Array<Array<[number, number]|null>>, files: number, columnes: number, distanciaMetres: number, pasLat: number, pasLng: number}}
   *   graella[fila][columna] és [lat, lng] si el punt cau dins del
   *   perímetre, o null si queda fora -- es manté la posició buida
   *   (en lloc de treure el punt de la llista) perquè després es
   *   puguin trobar els veïns de cada punt per calcular-hi el pendent.
   *   pasLat/pasLng són el pas de la graella en graus -- com que és
   *   constant arreu, permeten dibuixar el quadrat exacte de
   *   cobertura de cada punt sense haver de buscar-ne els veïns.
   */
  static generar(perimetre, distanciaMetres) {
    if (!Array.isArray(perimetre) || perimetre.length < 3) {
      throw new Error('Malla: cal un perímetre amb almenys 3 vèrtexs');
    }
    if (!(distanciaMetres > 0)) {
      throw new Error('Malla: la distància entre punts ha de ser positiva');
    }

    const lats = perimetre.map(([lat]) => lat);
    const lngs = perimetre.map(([, lng]) => lng);
    const latMinima = Math.min(...lats);
    const latMaxima = Math.max(...lats);
    const lngMinima = Math.min(...lngs);
    const lngMaxima = Math.max(...lngs);

    // El pas en longitud s'ha de corregir segons la latitud: els graus de
    // longitud "s'encongeixen" com més lluny de l'equador, la de latitud no.
    const latMitjana = (latMinima + latMaxima) / 2;
    const pasLat = distanciaMetres / METRES_PER_GRAU_LATITUD;
    const pasLng =
      distanciaMetres / (METRES_PER_GRAU_LATITUD * Math.cos((latMitjana * Math.PI) / 180));

    const files = Math.max(1, Math.floor((latMaxima - latMinima) / pasLat) + 1);
    const columnes = Math.max(1, Math.floor((lngMaxima - lngMinima) / pasLng) + 1);

    const graella = [];
    for (let f = 0; f < files; f++) {
      const lat = latMinima + f * pasLat;
      const fila = [];
      for (let c = 0; c < columnes; c++) {
        const lng = lngMinima + c * pasLng;
        fila.push(Malla._puntDinsPerimetre([lat, lng], perimetre) ? [lat, lng] : null);
      }
      graella.push(fila);
    }

    return { graella, files, columnes, distanciaMetres, pasLat, pasLng };
  }

  /**
   * Llista plana dels punts vàlids (dins del perímetre) amb la seva
   * posició (fila, columna) -- útil per consultar-los tots en una sola
   * crida i, després, tornar a col·locar els resultats a la graella.
   */
  static puntsPerConsultar({ graella }) {
    const coordenades = [];
    const posicions = [];
    graella.forEach((fila, f) => {
      fila.forEach((punt, c) => {
        if (punt) {
          coordenades.push(punt);
          posicions.push([f, c]);
        }
      });
    });
    return { coordenades, posicions };
  }

  /** Ray casting: cert si el punt cau dins del polígon donat pel perímetre. */
  static _puntDinsPerimetre([lat, lng], perimetre) {
    let dins = false;
    for (let i = 0, j = perimetre.length - 1; i < perimetre.length; j = i++) {
      const [latI, lngI] = perimetre[i];
      const [latJ, lngJ] = perimetre[j];

      const interseccio =
        lngI > lng !== lngJ > lng &&
        lat < ((latJ - latI) * (lng - lngI)) / (lngJ - lngI) + latI;

      if (interseccio) dins = !dins;
    }
    return dins;
  }
}
