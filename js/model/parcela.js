// Dades d'una parcel·la. No sap res de cadastre ni de IndexedDB, només
// representa la informació. La consulta al cadastre es fa a banda
// (ServeiCadastre) perquè el constructor no pot ser async.
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

export class Parcela {
  constructor({
    id = null,
    poligon,
    parcelaCadastral,
    poblacio,
    coordenades,
    referenciaCadastral = null,
    superficie = null,
    us = null,
    // Dades d'altimetria: opcionals, es calculen a banda (pàgina
    // d'altitud) i es desen a la parcel·la un cop calculades. Les
    // parcel·les creades abans d'aquesta funcionalitat simplement no
    // les tindran (queden a null) fins que algú les calculi.
    altitudMaxima = null,
    altitudMinima = null,
    desnivell = null,
    pendentMitja = null,
    // Orientació mitjana en graus (0-360, 0=Nord), només calculable amb
    // el mètode de malla. null si encara no s'ha calculat.
    orientacioMitjana = null,
  }) {
    if (!poligon || !parcelaCadastral || !poblacio) {
      throw new Error('Parcela: poligon, parcelaCadastral i poblacio son obligatoris');
    }
    if (!Array.isArray(coordenades) || coordenades.length === 0) {
      throw new Error('Parcela: calen les coordenades del perimetre');
    }

    this.id = id;
    this.poligon = poligon;
    this.parcelaCadastral = parcelaCadastral;
    this.poblacio = poblacio;
    this.coordenades = coordenades;
    this.referenciaCadastral = referenciaCadastral;
    this.superficie = superficie;
    this.us = us;
    this.altitudMaxima = altitudMaxima;
    this.altitudMinima = altitudMinima;
    this.desnivell = desnivell;
    this.pendentMitja = pendentMitja;
    this.orientacioMitjana = orientacioMitjana;
  }

  /** Cert si la parcel·la ja té calculades les dades d'altimetria. */
  get teAltimetria() {
    return this.desnivell !== null && this.pendentMitja !== null;
  }

  toObject() {
    return {
      id: this.id,
      poligon: this.poligon,
      parcelaCadastral: this.parcelaCadastral,
      poblacio: this.poblacio,
      coordenades: this.coordenades,
      referenciaCadastral: this.referenciaCadastral,
      superficie: this.superficie,
      us: this.us,
      altitudMaxima: this.altitudMaxima,
      altitudMinima: this.altitudMinima,
      desnivell: this.desnivell,
      pendentMitja: this.pendentMitja,
      orientacioMitjana: this.orientacioMitjana,
    };
  }

  static fromObject(obj) {
    return new Parcela(obj);
  }
}
