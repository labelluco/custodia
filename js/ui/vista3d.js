// Vista 3D d'una parcel·la, geometria o agrupació, igual que a Terra 3D:
// sòlid tancat amb el perímetre exacte (triangulació restringida), a
// partir d'una graella del MDT de l'IGN i amb l'ortofoto PNOA com a
// textura (generarModel i Visor3D, del nucli). Una agrupació és un sol
// model amb una part per parcel·la.
//
// Aquest model es descarrega en el moment (MDT + ortofoto): sense
// connexió no es pot fer. En aquest cas, si l'entitat té els punts
// d'altimetria desats (mètode de malla), es fa servir el visor antic
// (Mapa3D), que treballa només amb dades locals -- decisió de Mario:
// millor un 3D més senzill que cap.
import { Visor3D } from '../../nucli/js/ui/visor3d.js';
import { generarModel } from '../../nucli/js/serveis/generadorModel.js';
import { latLngAUtm } from '../../nucli/js/geometria/projeccio.js';
import { Mapa3D } from './mapa3d.js';
import { margesPanell } from './disposicio.js';

export class Vista3D {
  /** @param {string} idContenidor */
  constructor(idContenidor) {
    this.idContenidor = idContenidor;
    this.contenidor = document.getElementById(idContenidor);
    this.mode = null; // 'model' (nou) | 'antic' (Mapa3D, sense connexió)
    this.estat = { capa: 'ortofoto', detall: 'mitja', cotes: false };
    this._entitats = [];
    this._visor = null;
    this._antic = null;
    this._generacio = 0;
  }

  /**
   * @param {Array<{coordenades: Array<[number, number]>}>} entitats
   * @returns {Promise<'model'|'antic'>}
   * @throws si no es pot fer cap dels dos (sense connexió i sense punts desats)
   */
  async mostrar(entitats) {
    this._entitats = entitats;
    try {
      await this._generar();
      return this.mode;
    } catch (error) {
      console.warn('Vista3D: no s\'ha pogut generar el model nou, es prova el visor antic:', error);
      this._destruirVisors();
      const antic = new Mapa3D(this.idContenidor);
      if (!antic.mostrarTerreny(entitats)) throw error;
      this._antic = antic;
      this.mode = 'antic';
      this._aplicarCapaAntic();
      return this.mode;
    }
  }

  async _generar() {
    const generacio = ++this._generacio;
    // Coordenades del Cadastre/dibuix (lat/lng) -> parts en UTM, que és
    // el que fan servir el MDT i el sòlid.
    const zona = {
      parts: this._entitats.map((e) => ({ exterior: e.coordenades.map(latLngAUtm), interiors: [] })),
    };
    const { model, textura } = await generarModel(zona, this.estat.detall);
    if (generacio !== this._generacio) return; // ja n'hi ha una de més nova

    this._destruirVisors();
    this._visor = new Visor3D(this.contenidor);
    this._visor.establirMarges(() => {
      const { esquerra, inferior } = margesPanell();
      return { esquerra, inferior };
    });
    const costat = Math.max(model.limits.maxX - model.limits.minX, model.limits.maxY - model.limits.minY);
    const desnivell = model.altitudMaxima - model.altitudMinima;
    this._visor.mostrar(model, {
      exageracio: 1,
      // Base proporcional, com al mode "model" de Terra 3D: es veu com un
      // bloc de terreny sense que la base domini la imatge.
      gruixBaseMetres: Math.max(costat * 0.02, desnivell * 0.15, 2),
      textura,
      capa: this.estat.capa,
    });
    this._visor.mostrarCotes(this.estat.cotes);
    this.mode = 'model';
  }

  /** 'ortofoto' | 'altitud' | 'pendent' | 'neutre' */
  aplicarCapa(capa) {
    this.estat.capa = capa;
    if (this.mode === 'model') this._visor.aplicarCapa(capa);
    else this._aplicarCapaAntic();
  }

  mostrarCotes(mostrar) {
    this.estat.cotes = mostrar;
    if (this.mode === 'model') this._visor.mostrarCotes(mostrar);
    else this._aplicarCapaAntic();
  }

  /** Canvia el detall (pas del MDT): cal tornar a generar el model. */
  async canviarDetall(detall) {
    this.estat.detall = detall;
    if (this.mode === 'model') await this._generar();
  }

  reiniciarVista() {
    this._visor?.reiniciarVista();
  }

  // El visor antic no té ortofoto: "ortofoto" i "neutre" es veuen amb
  // la llum sobre un color base ("ombres"), com abans.
  _aplicarCapaAntic() {
    if (!this._antic) return;
    const capa = this.estat.capa === 'altitud' || this.estat.capa === 'pendent' ? this.estat.capa : 'ombres';
    this._antic.aplicarCapa(capa);
    if (this.estat.cotes) this._antic.mostrarCotes();
    else this._antic.amagarCotes();
  }

  _destruirVisors() {
    this._visor?.destruir();
    this._visor = null;
    this._antic?.destruir();
    this._antic = null;
    this.contenidor.querySelectorAll('canvas, .bruixola-3d, .brúixola-3d, .boto-pantalla-completa--3d').forEach((n) => n.remove());
  }

  destruir() {
    this._generacio++;
    this._destruirVisors();
    this.mode = null;
  }
}
