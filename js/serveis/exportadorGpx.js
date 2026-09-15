// Genera un fitxer GPX (track) a partir del perímetre d'una parcel·la.
// Format de sortida, no font de dades: no sap res de cadastre ni de
// IndexedDB, només tradueix coordenades ja existents a XML.

export class ExportadorGpx {
  /**
   * @param {Object} parcela Objecte pla amb .coordenades ([lat, lng]...), i .poblacio/.poligon/.parcelaCadastral (parcel·la) o .nom (geometria)
   * @returns {string} Contingut del fitxer GPX
   */
  static generar(parcela) {
    const nom = parcela.poblacio
      ? `Custòdia — ${parcela.poblacio} (pol. ${parcela.poligon}, parc. ${parcela.parcelaCadastral})`
      : `Custòdia — ${parcela.nom}`;

    // Es tanca el perímetre (primer punt = últim) si encara no ho està,
    // perquè el track es vegi com un contorn tancat, no com un camí obert.
    const punts = [...parcela.coordenades];
    const [primerLat, primerLng] = punts[0];
    const [ultimLat, ultimLng] = punts[punts.length - 1];
    if (primerLat !== ultimLat || primerLng !== ultimLng) {
      punts.push(punts[0]);
    }

    const trkpts = punts
      .map(([lat, lng]) => `      <trkpt lat="${lat}" lon="${lng}"></trkpt>`)
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Custòdia" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${ExportadorGpx._escaparXml(nom)}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
  }

  /**
   * Genera el GPX i en dispara la descàrrega al navegador. Fa servir la
   * mateixa tècnica (Blob + enllaç temporal) que ja coneixem d'altres
   * exportacions.
   */
  static descarregar(parcela) {
    const contingut = ExportadorGpx.generar(parcela);
    const blob = new Blob([contingut], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);

    const enllac = document.createElement('a');
    enllac.href = url;
    enllac.download = `custodia-${parcela.poblacio}-${parcela.poligon}-${parcela.parcelaCadastral}.gpx`;
    enllac.click();

    URL.revokeObjectURL(url);
  }

  static _escaparXml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
