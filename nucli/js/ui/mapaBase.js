// Mapa base Leaflet compartit: mapa (OpenStreetMap) i ortofoto PNOA de
// l'IGN, les mateixes capes que fa servir Custòdia. Necessita L global.
//
// Amb ambMon, l'ortofoto també cobreix la resta del món: a sota hi ha
// Sentinel-2 cloudless 2016 d'EOX (10 m, llicència CC BY 4.0) i, a sobre,
// la PNOA en PNG transparent: fora d'Espanya l'IGN retorna tessel·les
// buides (comprovat el 2026-10-17), i s'hi veu Sentinel-2. Sense ambMon
// (Custòdia) tot queda com abans: PNOA en JPEG, més lleugera.
//
// La PNOA es demana al WMTS de l'IGN (tessel·les ja fetes, 0,15-0,25 s
// cadascuna) i no al WMS (les pinta a cada petició, 0,4-0,7 s): comprovat
// el 2026-10-28, té les mateixes imatges fins al zoom 20.
//
// L'app tria la capa amb canviarCapa(); no s'hi posa el control de capes
// de Leaflet perquè cada app el pugui integrar al seu propi disseny.

import { PAISOS } from '../paisos/paisos.js';

const ATRIBUCIO_EOX =
  '<a href="https://s2maps.eu">Sentinel-2 cloudless 2016</a> &copy; <a href="https://eox.at">EOX</a> (Copernicus, CC BY 4.0)';

export function crearMapaBase(idContenidor, { centre = [40.2, -1.2], zoom = 6, ambMon = false, ambBruixola = false } = {}) {
  const mapa = L.map(idContenidor, { zoomControl: false, attributionControl: true, worldCopyJump: ambMon }).setView(
    centre,
    zoom
  );
  L.control.zoom({ position: 'topright' }).addTo(mapa);

  // Brúixola: la mateixa que el visor 3D (classes de nucli.css). En un mapa
  // 2D el nord sempre és amunt, així que no gira; l'app la situa amb CSS
  // (classe .bruixola-mapa) on no topi amb els seus controls.
  if (ambBruixola) {
    const bruixola = document.createElement('div');
    bruixola.className = 'bruixola-3d bruixola-mapa';
    bruixola.setAttribute('aria-hidden', 'true');
    bruixola.innerHTML = '<span class="bruixola-3d__fletxa">▲</span><span class="bruixola-3d__lletra">N</span>';
    mapa.getContainer().appendChild(bruixola);
  }

  const pnoa = L.tileLayer(
    'https://www.ign.es/wmts/pnoa-ma?request=GetTile&service=WMTS&version=1.0.0' +
      '&layer=OI.OrthoimageCoverage&style=default&tilematrixset=GoogleMapsCompatible' +
      '&format={format}&tilematrix={z}&tilerow={y}&tilecol={x}',
    {
      format: ambMon ? 'image/png' : 'image/jpeg',
      // Amb ambMon, per sobre de Sentinel-2 (zIndex 0) dins del mateix grup,
      // i només des del zoom 9: a les vistes de país Sentinel-2 n'hi ha prou,
      // i així no es carreguen desenes de PNG de 160 KB en obrir l'app.
      zIndex: 1,
      minZoom: ambMon ? 9 : 0,
      maxZoom: 20,
      maxNativeZoom: 20,
      attribution: 'PNOA &copy; <a href="https://www.ign.es">IGN</a>',
    }
  );

  const capes = {
    mapa: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }),
    ortofoto: ambMon
      ? L.layerGroup([
          L.tileLayer('https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg', {
            maxZoom: 20,
            maxNativeZoom: 15,
            zIndex: 0,
            attribution: ATRIBUCIO_EOX,
          }),
          pnoa,
        ])
      : pnoa,
  };

  // El PNG transparent pesa unes 5 vegades més que el JPEG (~170 KB per
  // tessel·la): només cal quan la vista inclou terreny de fora d'Espanya.
  // Si tota la vista hi és dins, es demana en JPEG.
  if (ambMon) {
    const ajustarFormat = () => {
      const limits = mapa.getBounds();
      const punts = [limits.getNorthWest(), limits.getNorthEast(), limits.getSouthWest(), limits.getSouthEast(), limits.getCenter()];
      const totDins = punts.every(({ lat, lng }) => PAISOS.espanya.conte([lat, lng]));
      const format = totDins ? 'image/jpeg' : 'image/png';
      if (pnoa.options.format !== format) {
        pnoa.options.format = format;
        pnoa.redraw();
      }
    };
    mapa.on('moveend', ajustarFormat);
    ajustarFormat();
  }

  let actual = null;
  const canviarCapa = (nom) => {
    if (!capes[nom] || actual === nom) return;
    if (actual) mapa.removeLayer(capes[actual]);
    capes[nom].addTo(mapa);
    // Les capes base van sempre per sota de la resta de tessel·les (el
    // grup de l'ortofoto mundial ja s'ordena amb zIndex).
    capes[nom].bringToBack?.();
    actual = nom;
  };
  canviarCapa('ortofoto');

  /**
   * URL d'una sola tessel·la d'una capa al centre de la vista actual: per
   * mostrar una miniatura de "l'altra capa" al botó que hi canvia (com fa
   * Google Maps), sense haver de crear cap altre mapa.
   */
  const urlMiniatura = (nom) => {
    const zoom = Math.max(2, Math.min(nom === 'mapa' ? 17 : 15, Math.round(mapa.getZoom())));
    const tessela = mapa.project(mapa.getCenter(), zoom).divideBy(256).floor();
    const total = 2 ** zoom;
    const x = ((tessela.x % total) + total) % total;
    const y = Math.max(0, Math.min(total - 1, tessela.y));
    if (nom === 'mapa') return `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;

    const { lat, lng } = mapa.getCenter();
    if (!ambMon || (mapa.getZoom() >= 9 && PAISOS.espanya.conte([lat, lng]))) {
      return (
        'https://www.ign.es/wmts/pnoa-ma?request=GetTile&service=WMTS&version=1.0.0' +
        '&layer=OI.OrthoimageCoverage&style=default&tilematrixset=GoogleMapsCompatible' +
        `&format=image/jpeg&tilematrix=${zoom}&tilerow=${y}&tilecol=${x}`
      );
    }
    return `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/${zoom}/${y}/${x}.jpg`;
  };

  return { mapa, canviarCapa, capaActual: () => actual, urlMiniatura };
}
