// Mapa base Leaflet compartit: mapa (OpenStreetMap) i ortofoto PNOA de
// l'IGN, les mateixes capes que fa servir Custòdia. Necessita L global.
//
// L'app tria la capa amb canviarCapa(); no s'hi posa el control de capes
// de Leaflet perquè cada app el pugui integrar al seu propi disseny.

export function crearMapaBase(idContenidor, { centre = [40.2, -1.2], zoom = 6 } = {}) {
  const mapa = L.map(idContenidor, { zoomControl: false, attributionControl: true }).setView(centre, zoom);
  L.control.zoom({ position: 'topright' }).addTo(mapa);

  const capes = {
    mapa: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }),
    ortofoto: L.tileLayer.wms('https://www.ign.es/wms-inspire/pnoa-ma?', {
      layers: 'OI.OrthoimageCoverage',
      format: 'image/jpeg',
      maxZoom: 20,
      attribution: 'PNOA &copy; <a href="https://www.ign.es">IGN</a>',
    }),
  };

  let actual = null;
  const canviarCapa = (nom) => {
    if (!capes[nom] || actual === nom) return;
    if (actual) mapa.removeLayer(capes[actual]);
    capes[nom].addTo(mapa);
    capes[nom].bringToBack();
    actual = nom;
  };
  canviarCapa('ortofoto');

  return { mapa, canviarCapa, capaActual: () => actual };
}
