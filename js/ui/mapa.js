// Embolcall sobre Leaflet. Necessita que L estigui carregat globalment
// via <script> abans d'importar aquest mòdul.

const COLORS_RISC = {
  baix: '#4caf50',
  mitja: '#ffb300',
  alt: '#e53935',
};

const CENTRE_PER_DEFECTE = [40.15, -0.65]; // zona interior de Castelló/Terol
const ZOOM_PER_DEFECTE = 11;

export class Mapa {
  constructor(idContenidor) {
    this.leafletMap = L.map(idContenidor).setView(CENTRE_PER_DEFECTE, ZOOM_PER_DEFECTE);

    const capaOsm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    });

    // Ortofoto PNOA de l'IGN, dades obertes. Es deixa com a base alternativa
    // (no superposada) perquè és útil veure el terreny real, no només el
    // mapa esquemàtic, sobretot per valorar l'estat real d'una parcel·la.
    const capaOrtofoto = L.tileLayer.wms('https://www.ign.es/wms-inspire/pnoa-ma?', {
      layers: 'OI.OrthoimageCoverage',
      format: 'image/jpeg',
      version: '1.3.0',
      maxZoom: 19,
      attribution: 'PNOA WMS. Cedit per © Instituto Geográfico Nacional de España',
    });

    capaOsm.addTo(this.leafletMap);

    L.control
      .layers({ 'Mapa': capaOsm, 'Ortofoto (PNOA)': capaOrtofoto })
      .addTo(this.leafletMap);

    this.capaParceles = L.layerGroup().addTo(this.leafletMap);
    this.parceles = [];
    this._capaRessaltada = null;
  }

  afegirParcela(parcela, onClick) {
    const color = COLORS_RISC[parcela.risc] ?? '#999999';

    const poligon = L.polygon(parcela.coordenades, {
      color,
      weight: 2,
      fillColor: color,
      fillOpacity: 0.35,
    });

    poligon.bindTooltip(`${parcela.poblacio} — ${parcela.us} (risc ${parcela.risc})`);

    if (onClick) {
      poligon.on('click', () => onClick(parcela));
    }

    poligon.addTo(this.capaParceles);
    this.parceles.push({ parcela, capa: poligon });
  }

  /**
   * Ressalta una parcel·la concreta (li puja el gruix de la vora i hi fa
   * zoom), desfent el ressalt de l'anterior si n'hi havia. Pensat perquè
   * tocar un ítem del llistat "es noti" al mapa, tant amb ratolí com amb
   * tàctil -- el clic funciona igual en tots dos casos.
   */
  ressaltarParcela(id) {
    const entrada = this.parceles.find((p) => p.parcela.id === id);
    if (!entrada) return;

    if (this._capaRessaltada) {
      this._capaRessaltada.setStyle({ weight: 2 });
    }

    entrada.capa.setStyle({ weight: 5 });
    entrada.capa.bringToFront();
    entrada.capa.openTooltip();
    this._capaRessaltada = entrada.capa;

    this.leafletMap.fitBounds(entrada.capa.getBounds(), { padding: [40, 40], maxZoom: 17 });
  }

  buidar() {
    this.capaParceles.clearLayers();
    this.parceles = [];
    this._capaRessaltada = null;
  }

  ajustarVistaATotes() {
    if (this.parceles.length === 0) return;
    const grup = L.featureGroup(this.parceles.map((p) => p.capa));
    this.leafletMap.fitBounds(grup.getBounds(), { padding: [20, 20] });
  }
}
