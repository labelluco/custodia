// Cerca de llocs (topònims, adreces) a tot el món amb Nominatim,
// d'OpenStreetMap. Admet CORS (comprovat el 2026-10-17).
//
// Normes d'ús de Nominatim (https://operations.osmfoundation.org/policies/nominatim/):
// com a molt una petició per segon, sense autocompletar mentre s'escriu, i
// amb atribució a OpenStreetMap. Per això aquí només es cerca quan la
// persona ho demana (botó o Intro), i es respecta un interval mínim.

const URL_NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const INTERVAL_MINIM_MS = 1100;
let darreraPeticio = 0;

export const ATRIBUCIO_NOMINATIM = 'Cerca © OpenStreetMap (Nominatim)';

export class ServeiLlocs {
  /**
   * @param {string} text
   * @param {string} [idioma] Idioma preferit dels noms ('ca', 'es'...)
   * @returns {Promise<Array<{nom: string, lat: number, lng: number, limits: [[number, number], [number, number]] | null}>>}
   *   limits: [[sud, oest], [nord, est]], llestos per a Leaflet (fitBounds).
   */
  static async cercar(text, idioma = 'ca') {
    const consulta = String(text ?? '').trim();
    if (!consulta) return [];

    const espera = darreraPeticio + INTERVAL_MINIM_MS - Date.now();
    if (espera > 0) await new Promise((resoldre) => setTimeout(resoldre, espera));
    darreraPeticio = Date.now();

    const params = new URLSearchParams({ q: consulta, format: 'jsonv2', limit: '6', 'accept-language': idioma });
    let resposta;
    try {
      resposta = await fetch(`${URL_NOMINATIM}?${params}`);
    } catch (error) {
      throw new Error(`ServeiLlocs: no s'ha pogut fer la cerca (${error.message})`);
    }
    if (!resposta.ok) throw new Error(`ServeiLlocs: el servei de cerca ha retornat un error (${resposta.status})`);

    const resultats = await resposta.json();
    return resultats.map((r) => {
      // boundingbox: [sud, nord, oest, est] com a text.
      const [s, n, o, e] = (r.boundingbox ?? []).map(Number);
      return {
        nom: r.display_name,
        lat: Number(r.lat),
        lng: Number(r.lon),
        limits: r.boundingbox ? [[s, o], [n, e]] : null,
      };
    });
  }
}
