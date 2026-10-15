// Embolcall mínim sobre IndexedDB, compartit per les apps. Cada app hi
// passa el nom de la base de dades, la versió de l'esquema i una funció
// de migració (onupgradeneeded) -- l'esquema és cosa de l'app, no del
// nucli. Totes les dades queden al dispositiu.
//
// Si IndexedDB no està disponible (mode privat d'alguns navegadors,
// iframes restringits), obrir() falla amb un error clar i l'app pot
// continuar funcionant sense historial.

export class MagatzemLocal {
  /**
   * @param {string} nom
   * @param {number} versio
   * @param {(bd: IDBDatabase, versioAnterior: number) => void} migrar
   */
  static obrir(nom, versio, migrar) {
    return new Promise((resoldre, rebutjar) => {
      let peticio;
      try {
        peticio = indexedDB.open(nom, versio);
      } catch (error) {
        rebutjar(new Error(`MagatzemLocal: IndexedDB no disponible (${error.message})`));
        return;
      }
      peticio.onupgradeneeded = (event) => migrar(peticio.result, event.oldVersion);
      peticio.onsuccess = () => resoldre(new MagatzemLocal(peticio.result));
      peticio.onerror = () => rebutjar(new Error(`MagatzemLocal: no s'ha pogut obrir (${peticio.error?.message})`));
    });
  }

  constructor(bd) {
    this.bd = bd;
  }

  _operacio(magatzem, mode, accio) {
    return new Promise((resoldre, rebutjar) => {
      const transaccio = this.bd.transaction(magatzem, mode);
      const peticio = accio(transaccio.objectStore(magatzem));
      transaccio.oncomplete = () => resoldre(peticio?.result);
      transaccio.onerror = () => rebutjar(transaccio.error);
    });
  }

  afegir(magatzem, objecte) {
    return this._operacio(magatzem, 'readwrite', (m) => m.add(objecte));
  }

  desar(magatzem, objecte) {
    return this._operacio(magatzem, 'readwrite', (m) => m.put(objecte));
  }

  obtenir(magatzem, clau) {
    return this._operacio(magatzem, 'readonly', (m) => m.get(clau));
  }

  totes(magatzem) {
    return this._operacio(magatzem, 'readonly', (m) => m.getAll());
  }

  esborrar(magatzem, clau) {
    return this._operacio(magatzem, 'readwrite', (m) => m.delete(clau));
  }

  buidar(magatzem) {
    return this._operacio(magatzem, 'readwrite', (m) => m.clear());
  }
}
