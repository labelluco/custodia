// Dades d'una parcel·la. No sap res de cadastre ni de IndexedDB, només
// representa la informació. La consulta al cadastre es fa a banda
// (ServeiCadastre) perquè el constructor no pot ser async.

export const USOS = Object.freeze({
  AGRICOLA: 'agricola',
  FORESTAL: 'forestal',
  PASTURA: 'pastura',
  MIX: 'mix',
  ALTRE: 'altre',
});

export const RISCOS = Object.freeze({
  BAIX: 'baix',
  MITJA: 'mitja',
  ALT: 'alt',
});

export class Parcela {
  constructor({
    id = null,
    poligon,
    parcelaCadastral,
    poblacio,
    coordenades,
    referenciaCadastral = null,
    superficie = null,
    us,
    risc,
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
    if (!Object.values(USOS).includes(us)) {
      throw new Error(`Parcela: us "${us}" no valid`);
    }
    if (!Object.values(RISCOS).includes(risc)) {
      throw new Error(`Parcela: risc "${risc}" no valid`);
    }

    this.id = id;
    this.poligon = poligon;
    this.parcelaCadastral = parcelaCadastral;
    this.poblacio = poblacio;
    this.coordenades = coordenades;
    this.referenciaCadastral = referenciaCadastral;
    this.superficie = superficie;
    this.us = us;
    this.risc = risc;
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

  get etiquetaUs() {
    const etiquetes = {
      [USOS.AGRICOLA]: 'Agrícola',
      [USOS.FORESTAL]: 'Forestal',
      [USOS.PASTURA]: 'Pastura',
      [USOS.MIX]: 'Mixt (diversos usos)',
      [USOS.ALTRE]: 'Altre',
    };
    return etiquetes[this.us] ?? this.us;
  }

  get etiquetaRisc() {
    const etiquetes = {
      [RISCOS.BAIX]: 'Baix',
      [RISCOS.MITJA]: 'Mitjà',
      [RISCOS.ALT]: 'Alt',
    };
    return etiquetes[this.risc] ?? this.risc;
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
      risc: this.risc,
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
