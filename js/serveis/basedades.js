// Embolcall sobre IndexedDB per desar i llegir parcel·les. IndexedDB va
// per events, aquí ho passo tot a Promises perquè la resta del codi
// pugui fer servir async/await amb normalitat.
//
//   const bd = await BaseDades.obrir();
//   await bd.afegirParcela(parcela);
//   const totes = await bd.llegirTotesLesParceles();

const NOM_BD = 'custodia';
const VERSIO_BD = 1;
const MAGATZEM_PARCELES = 'parceles';

export class BaseDades {
  constructor(idb) {
    this._idb = idb;
  }

  // No cal comprovar si la BD "existeix": si no hi és, onupgradeneeded
  // la crea.
  static obrir() {
    return new Promise((resolve, reject) => {
      const peticio = indexedDB.open(NOM_BD, VERSIO_BD);

      peticio.onupgradeneeded = (event) => {
        const idb = event.target.result;
        if (!idb.objectStoreNames.contains(MAGATZEM_PARCELES)) {
          const magatzem = idb.createObjectStore(MAGATZEM_PARCELES, {
            keyPath: 'id',
            autoIncrement: true,
          });
          magatzem.createIndex('poblacio', 'poblacio', { unique: false });
        }
      };

      peticio.onsuccess = (event) => {
        resolve(new BaseDades(event.target.result));
      };

      peticio.onerror = (event) => {
        reject(new Error(`BaseDades: no s'ha pogut obrir (${event.target.error})`));
      };
    });
  }

  afegirParcela(parcela) {
    return new Promise((resolve, reject) => {
      const transaccio = this._idb.transaction(MAGATZEM_PARCELES, 'readwrite');
      const magatzem = transaccio.objectStore(MAGATZEM_PARCELES);
      const dades = parcela.toObject();
      if (dades.id === null || dades.id === undefined) {
        delete dades.id;
      }
      const peticio = magatzem.put(dades);

      peticio.onsuccess = () => resolve(peticio.result);
      peticio.onerror = (event) =>
        reject(new Error(`BaseDades: no s'ha pogut afegir la parcel·la (${event.target.error})`));
    });
  }

  llegirParcela(id) {
    return new Promise((resolve, reject) => {
      const transaccio = this._idb.transaction(MAGATZEM_PARCELES, 'readonly');
      const magatzem = transaccio.objectStore(MAGATZEM_PARCELES);
      const peticio = magatzem.get(Number(id));

      peticio.onsuccess = () => resolve(peticio.result);
      peticio.onerror = (event) =>
        reject(new Error(`BaseDades: no s'ha pogut llegir la parcel·la (${event.target.error})`));
    });
  }

  llegirTotesLesParceles() {
    return new Promise((resolve, reject) => {
      const transaccio = this._idb.transaction(MAGATZEM_PARCELES, 'readonly');
      const magatzem = transaccio.objectStore(MAGATZEM_PARCELES);
      const peticio = magatzem.getAll();

      peticio.onsuccess = () => resolve(peticio.result);
      peticio.onerror = (event) =>
        reject(new Error(`BaseDades: no s'han pogut llegir les parcel·les (${event.target.error})`));
    });
  }

  esborrarParcela(id) {
    return new Promise((resolve, reject) => {
      const transaccio = this._idb.transaction(MAGATZEM_PARCELES, 'readwrite');
      const magatzem = transaccio.objectStore(MAGATZEM_PARCELES);
      const peticio = magatzem.delete(Number(id));

      peticio.onsuccess = () => resolve();
      peticio.onerror = (event) =>
        reject(new Error(`BaseDades: no s'ha pogut esborrar la parcel·la (${event.target.error})`));
    });
  }
}
