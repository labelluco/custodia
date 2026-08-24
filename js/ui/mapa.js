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

  /**
   * Afegeix un marcador per cada vèrtex del perímetre, amb la seva
   * altitud com a tooltip en clicar-hi. Pensat per a la pàgina de
   * càlcul d'altimetria, no per a l'ús habitual (inici/detall).
   *
   * @param {Array<[number, number]>} coordenades Vèrtexs [lat, lng]
   * @param {number[]} altituds Una altitud (m) per vèrtex, mateix ordre
   */
  afegirVertexsAmbAltitud(coordenades, altituds) {
    coordenades.forEach((punt, i) => {
      const marcador = L.circleMarker(punt, {
        radius: 6,
        color: '#1b5e20',
        fillColor: '#a5d6a7',
        fillOpacity: 0.9,
        weight: 2,
      });
      marcador.bindTooltip(`${altituds[i].toFixed(0)} m`);
      marcador.on('click', () => marcador.openTooltip());
      marcador.addTo(this.leafletMap);
    });
  }

  /**
   * Com afegirVertexsAmbAltitud, però pintant una fletxa rotada segons
   * l'orientació de cada punt en lloc d'un cercle -- pensat per al
   * mètode de malla, on cada punt ja té una orientació local calculada.
   * Els punts sense orientació definida (terreny massa pla) es pinten
   * com un punt gris, sense fletxa.
   *
   * L'etiqueta de bruixola es rep ja calculada (per exemple, amb
   * ServeiOrientacio.etiquetaBruixola) en lloc que Mapa hagi de conèixer
   * cap servei -- aquesta classe només sap pintar, no calcular res.
   *
   * @param {Array<{coordenades: [number, number], altitud: number, orientacio: number|null, etiqueta?: string}>} punts
   */
  afegirPuntsAmbOrientacio(punts) {
    punts.forEach(({ coordenades, altitud, orientacio, etiqueta }) => {
      const html =
        orientacio == null
          ? '<div class="icona-orientacio icona-orientacio--plana"></div>'
          : `<div class="icona-orientacio" style="transform: rotate(${orientacio}deg);">&#8593;</div>`;

      const icona = L.divIcon({
        className: '',
        html,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      const marcador = L.marker(coordenades, { icon: icona });
      const textOrientacio =
        orientacio == null
          ? 'pla (sense orientació definida)'
          : `${orientacio.toFixed(0)}°${etiqueta ? ` (${etiqueta})` : ''}`;
      marcador.bindTooltip(`${altitud.toFixed(0)} m — orientació: ${textOrientacio}`);
      marcador.on('click', () => marcador.openTooltip());
      marcador.addTo(this.leafletMap);
    });
  }

  /**
   * Igual que afegirVertexsAmbAltitud, però per als punts d'una malla
   * interior (vegeu js/geometria/malla.js) -- mateix comportament
   * (clic per veure l'altitud), amb un estil diferent perquè es
   * distingeixin visualment dels vèrtexs del perímetre.
   */
  afegirPuntsMalla(punts, altituds) {
    punts.forEach((punt, i) => {
      const marcador = L.circleMarker(punt, {
        radius: 4,
        color: '#0d47a1',
        fillColor: '#90caf9',
        fillOpacity: 0.9,
        weight: 1,
      });
      marcador.bindTooltip(`${altituds[i].toFixed(0)} m`);
      marcador.on('click', () => marcador.openTooltip());
      marcador.addTo(this.leafletMap);
    });
  }

  ajustarVistaATotes() {
    if (this.parceles.length === 0) return;
    const grup = L.featureGroup(this.parceles.map((p) => p.capa));
    this.leafletMap.fitBounds(grup.getBounds(), { padding: [20, 20] });
  }
}
