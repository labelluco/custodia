// Una agrupació de parcel·les. No en duplica cap dada: només en
// referencia els id -- les parcel·les continuen sent l'única font de
// veritat (geometria, subparceles, dades d'altimetria...), l'agrupació
// simplement defineix quines es tracten juntes com una sola unitat
// d'anàlisi (útil quan una parcel·la sola és massa petita per tenir
// sentit analitzar-la per separat).
export class Agrupacio {
  constructor({ id = null, nom, parcelaIds = [] }) {
    if (!nom) {
      throw new Error('Agrupacio: cal un nom');
    }
    if (!Array.isArray(parcelaIds) || parcelaIds.length === 0) {
      throw new Error('Agrupacio: calen una o més parcel·les');
    }

    this.id = id;
    this.nom = nom;
    // Es guarden com a Number: IndexedDB els id de Parcela són
    // numèrics (keyPath autoIncrement), i cal que coincideixin
    // exactament per poder-los cercar després.
    this.parcelaIds = parcelaIds.map(Number);
  }

  toObject() {
    return {
      id: this.id,
      nom: this.nom,
      parcelaIds: this.parcelaIds,
    };
  }

  static fromObject(obj) {
    return new Agrupacio(obj);
  }
}
