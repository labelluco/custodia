// Classe base: qualsevol perímetre sobre el mapa amb dades
// d'altimetria calculables (altitud, pendent, orientació), sense cap
// informació cadastral. Parcela n'hereta i hi afegeix les dades del
// Cadastre (vegeu parcela.js) -- una Geometria "pura" (dibuixada a mà
// al mapa, sense consultar el Cadastre) no en té.
export class Geometria {
  constructor({
    id = null,
    // Nom donat per l'usuari -- imprescindible per identificar-la, ja
    // que (a diferència d'una Parcela) no hi ha població/polígon/
    // parcel·la per identificar-la automàticament.
    nom = null,
    coordenades,
    // Dades d'altimetria: opcionals, es calculen a banda (pàgina
    // d'altitud) i es desen un cop calculades.
    altitudMaxima = null,
    altitudMinima = null,
    desnivell = null,
    pendentMitja = null,
    // Orientació mitjana en graus (0-360, 0=Nord), només calculable amb
    // el mètode de malla. null si encara no s'ha calculat.
    orientacioMitjana = null,
    // Data (ISO) de quan es va crear.
    dataCreacio = null,
    // Punts individuals de l'últim càlcul d'altimetria (coordenades +
    // altitud, i orientació si es va fer servir el mètode de malla) --
    // es guarden per poder tornar-los a pintar al mapa en entrar de nou
    // a la pàgina, sense haver de tornar a consultar l'IDEE ni haver-ho
    // de recalcular. metodeAltitud indica quina funció de Mapa cal fer
    // servir per pintar-los.
    puntsAltitud = null,
    metodeAltitud = null,
  }) {
    if (!Array.isArray(coordenades) || coordenades.length === 0) {
      throw new Error('Geometria: calen les coordenades del perímetre');
    }

    this.id = id;
    this.nom = nom;
    this.coordenades = coordenades;
    this.altitudMaxima = altitudMaxima;
    this.altitudMinima = altitudMinima;
    this.desnivell = desnivell;
    this.pendentMitja = pendentMitja;
    this.orientacioMitjana = orientacioMitjana;
    this.dataCreacio = dataCreacio;
    this.puntsAltitud = puntsAltitud;
    this.metodeAltitud = metodeAltitud;
  }

  /** Cert si ja té calculades les dades d'altimetria. */
  get teAltimetria() {
    return this.desnivell !== null && this.pendentMitja !== null;
  }

  toObject() {
    return {
      id: this.id,
      nom: this.nom,
      coordenades: this.coordenades,
      altitudMaxima: this.altitudMaxima,
      altitudMinima: this.altitudMinima,
      desnivell: this.desnivell,
      pendentMitja: this.pendentMitja,
      orientacioMitjana: this.orientacioMitjana,
      dataCreacio: this.dataCreacio,
      puntsAltitud: this.puntsAltitud,
      metodeAltitud: this.metodeAltitud,
    };
  }

  static fromObject(obj) {
    return new Geometria(obj);
  }
}
