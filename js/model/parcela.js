// Dades d'una parcel·la. Hereta de Geometria (coordenades + dades
// d'altimetria) i hi afegeix la informació cadastral. No sap res de
// cadastre ni de IndexedDB, només representa la informació. La
// consulta al cadastre es fa a banda (ServeiCadastre) perquè el
// constructor no pot ser async.
//
// L'ús ("us") ja no és una categoria pròpia triada per l'usuari: es
// desa tal com el retorna el Cadastre (per exemple "Agrario"), o null
// si el Cadastre no en va donar cap. No hi ha, doncs, cap validació de
// valors permesos per a aquest camp -- és text lliure, no editable.
//
// Ja no hi ha cap camp "risc" manual: el risc d'incendi es calcula
// sempre automàticament (vegeu ServeiRisc), a partir de la vegetació,
// el pendent i l'orientació -- no té sentit que convisqui amb un valor
// triat a mà que ningú actualitzaria.
import { Geometria } from './geometria.js';

export class Parcela extends Geometria {
  constructor({
    poligon,
    parcelaCadastral,
    poblacio,
    referenciaCadastral = null,
    superficie = null,
    us = null,
    // Província i codis numèrics de província/municipi: opcionals (les
    // parcel·les creades abans d'aquest camp no els tindran), es fan
    // servir només per construir l'enllaç directe a la cartografia del
    // Cadastre a la pàgina de detall.
    provincia = null,
    codiProvincia = null,
    codiMunicipi = null,
    ...resta
  }) {
    if (!poligon || !parcelaCadastral || !poblacio) {
      throw new Error('Parcela: poligon, parcelaCadastral i poblacio son obligatoris');
    }

    super(resta);

    this.poligon = poligon;
    this.parcelaCadastral = parcelaCadastral;
    this.poblacio = poblacio;
    this.referenciaCadastral = referenciaCadastral;
    this.superficie = superficie;
    this.us = us;
    this.provincia = provincia;
    this.codiProvincia = codiProvincia;
    this.codiMunicipi = codiMunicipi;
  }

  toObject() {
    return {
      ...super.toObject(),
      poligon: this.poligon,
      parcelaCadastral: this.parcelaCadastral,
      poblacio: this.poblacio,
      referenciaCadastral: this.referenciaCadastral,
      superficie: this.superficie,
      us: this.us,
      provincia: this.provincia,
      codiProvincia: this.codiProvincia,
      codiMunicipi: this.codiMunicipi,
    };
  }

  static fromObject(obj) {
    return new Parcela(obj);
  }
}
