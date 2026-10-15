// Dibuix d'un polígon sobre un mapa Leaflet: cada clic afegeix un
// vèrtex, els vèrtexs es poden arrossegar per corregir-los, i un doble
// clic sobre un vèrtex l'elimina. Generalitza el que fa Custòdia a
// afegir-geometria.js (que només permetia afegir i desfer).
//
// No sap res de cap app: avisa dels canvis amb el callback onCanvi.

export class DibuixPoligon {
  /**
   * @param {L.Map} mapa
   * @param {{color?: string, onCanvi?: (punts: Array<[number, number]>) => void}} opcions
   */
  constructor(mapa, { color = '#396a49', onCanvi = () => {} } = {}) {
    this._mapa = mapa;
    this._color = color;
    this._onCanvi = onCanvi;
    this._punts = [];
    this._capa = L.layerGroup();
    this._actiu = false;
    this._gestorClic = (event) => this._afegir([event.latlng.lat, event.latlng.lng]);
  }

  /** Vèrtexs actuals, [lat, lng], en l'ordre de dibuix. */
  get punts() {
    return this._punts.map((p) => [...p]);
  }

  activar() {
    if (this._actiu) return;
    this._actiu = true;
    this._capa.addTo(this._mapa);
    this._mapa.on('click', this._gestorClic);
    this._mapa.getContainer().classList.add('mapa--dibuixant');
    // Evita que el doble clic per esborrar un vèrtex faci zoom.
    this._mapa.doubleClickZoom.disable();
    this._pintar();
  }

  desactivar({ conservar = false } = {}) {
    if (!this._actiu) return;
    this._actiu = false;
    this._mapa.off('click', this._gestorClic);
    this._mapa.getContainer().classList.remove('mapa--dibuixant');
    this._mapa.doubleClickZoom.enable();
    if (!conservar) this._capa.remove();
  }

  desfer() {
    this._punts.pop();
    this._canvi();
  }

  netejar() {
    this._punts = [];
    this._canvi();
  }

  _afegir(punt) {
    this._punts.push(punt);
    this._canvi();
  }

  _canvi() {
    this._pintar();
    this._onCanvi(this.punts);
  }

  _pintar() {
    this._capa.clearLayers();
    if (this._punts.length >= 2) {
      const forma =
        this._punts.length === 2
          ? L.polyline(this._punts, { color: this._color, weight: 3, dashArray: '6 6' })
          : L.polygon(this._punts, { color: this._color, weight: 3, fillOpacity: 0.2 });
      forma.addTo(this._capa);
    }

    this._punts.forEach((punt, index) => {
      const marcador = L.marker(punt, {
        draggable: true,
        icon: L.divIcon({ className: 'vertex-dibuix', iconSize: [16, 16] }),
        keyboard: false,
      });
      marcador.on('drag', (event) => {
        const { lat, lng } = event.target.getLatLng();
        this._punts[index] = [lat, lng];
        // Durant l'arrossegament només es redibuixa la forma (no els
        // marcadors), perquè Leaflet no perdi el marcador que s'arrossega.
        this._capa.eachLayer((capa) => {
          if (capa instanceof L.Polyline) capa.setLatLngs(this._punts);
        });
      });
      marcador.on('dragend', () => this._canvi());
      marcador.on('dblclick', (event) => {
        L.DomEvent.stop(event);
        this._punts.splice(index, 1);
        this._canvi();
      });
      marcador.on('click', (event) => L.DomEvent.stop(event));
      marcador.addTo(this._capa);
    });
  }
}
