// Embolcall sobre IndexedDB per desar i llegir parcel·les i les seves
// subparceles. IndexedDB va per events, aquí ho passo tot a Promises
// perquè la resta del codi pugui fer servir async/await amb normalitat.
//
//   const bd = await BaseDades.obrir();
//   const id = await bd.afegirParcela(parcela);
//   await bd.afegirSubparceles(id, subparceles);
//   const totes = await bd.llegirTotesLesParceles();

const NOM_BD = 'custodia';
const VERSIO_BD = 3; // v3: afegeix el magatzem d'agrupacions
const MAGATZEM_PARCELES = 'parceles';
const MAGATZEM_SUBPARCELES = 'subparceles';
const MAGATZEM_AGRUPACIONS = 'agrupacions';

export class BaseDades {
  constructor(idb) {
    this._idb = idb;
  }

  // No cal comprovar si la BD "existeix": si no hi és (o si cal
  // afegir-hi un magatzem nou, com subparceles a la v2), onupgradeneeded
  // se n'encarrega. El "if (!contains(...))" per magatzem fa que
  // funcioni igual tant si la BD és nova de trinca com si ve d'una
  // versió anterior que ja tenia "parceles".
  static obrir() {
    return new Promise((resolve, reject) => {
      const peticio = indexedDB.open(NOM_BD, VERSIO_BD);

      // Si l'usuari té una altra pestanya de l'app oberta amb una
      // versió anterior encara connectada a la BD, la pujada d'esquema
      // es queda bloquejada -- sense això, la crida es quedaria
      // penjada per sempre, sense cap avís.
      peticio.onblocked = () => {
        reject(
          new Error(
            "BaseDades: cal tancar les altres pestanyes de Custòdia obertes per acabar d'actualitzar la base de dades"
          )
        );
      };

      peticio.onupgradeneeded = (event) => {
        const idb = event.target.result;

        if (!idb.objectStoreNames.contains(MAGATZEM_PARCELES)) {
          const magatzem = idb.createObjectStore(MAGATZEM_PARCELES, {
            keyPath: 'id',
            autoIncrement: true,
          });
          magatzem.createIndex('poblacio', 'poblacio', { unique: false });
        }

        if (!idb.objectStoreNames.contains(MAGATZEM_SUBPARCELES)) {
          const magatzemSub = idb.createObjectStore(MAGATZEM_SUBPARCELES, {
            keyPath: 'id',
            autoIncrement: true,
          });
          magatzemSub.createIndex('parcelaId', 'parcelaId', { unique: false });
        }

        if (!idb.objectStoreNames.contains(MAGATZEM_AGRUPACIONS)) {
          const magatzemAgr = idb.createObjectStore(MAGATZEM_AGRUPACIONS, {
            keyPath: 'id',
            autoIncrement: true,
          });
          // multiEntry: cada element de parcelaIds genera la seva pròpia
          // entrada a l'índex -- permet cercar "a quines agrupacions
          // pertany la parcel·la X" directament, sense haver de llegir
          // totes les agrupacions i filtrar-les a mà.
          magatzemAgr.createIndex('parcelaIds', 'parcelaIds', {
            unique: false,
            multiEntry: true,
          });
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

  /**
   * Desa una llista de subparceles, totes relacionades amb una
   * parcel·la (per parcelaId). Cada element pot portar qualsevol camp
   * (cspr, ccc, dcc, ip, ssp...) -- BaseDades no en valida l'estructura,
   * només hi afegeix parcelaId per poder-les recuperar després.
   */
  afegirSubparceles(parcelaId, subparceles) {
    return new Promise((resolve, reject) => {
      const transaccio = this._idb.transaction(MAGATZEM_SUBPARCELES, 'readwrite');
      const magatzem = transaccio.objectStore(MAGATZEM_SUBPARCELES);

      for (const subparcela of subparceles) {
        magatzem.add({ ...subparcela, parcelaId: Number(parcelaId) });
      }

      transaccio.oncomplete = () => resolve();
      transaccio.onerror = (event) =>
        reject(new Error(`BaseDades: no s'han pogut afegir les subparceles (${event.target.error})`));
    });
  }

  /** Totes les subparceles d'una parcel·la concreta, via l'índex parcelaId. */
  llegirSubparcelesDe(parcelaId) {
    return new Promise((resolve, reject) => {
      const transaccio = this._idb.transaction(MAGATZEM_SUBPARCELES, 'readonly');
      const index = transaccio.objectStore(MAGATZEM_SUBPARCELES).index('parcelaId');
      const peticio = index.getAll(Number(parcelaId));

      peticio.onsuccess = () => resolve(peticio.result);
      peticio.onerror = (event) =>
        reject(new Error(`BaseDades: no s'han pogut llegir les subparceles (${event.target.error})`));
    });
  }

  /** Esborra totes les subparceles d'una parcel·la (en esborrar-la, per exemple). */
  esborrarSubparcelesDe(parcelaId) {
    return new Promise((resolve, reject) => {
      const transaccio = this._idb.transaction(MAGATZEM_SUBPARCELES, 'readwrite');
      const index = transaccio.objectStore(MAGATZEM_SUBPARCELES).index('parcelaId');
      const peticio = index.openCursor(IDBKeyRange.only(Number(parcelaId)));

      peticio.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      transaccio.oncomplete = () => resolve();
      transaccio.onerror = (event) =>
        reject(new Error(`BaseDades: no s'han pogut esborrar les subparceles (${event.target.error})`));
    });
  }

  afegirAgrupacio(agrupacio) {
    return new Promise((resolve, reject) => {
      const transaccio = this._idb.transaction(MAGATZEM_AGRUPACIONS, 'readwrite');
      const magatzem = transaccio.objectStore(MAGATZEM_AGRUPACIONS);
      const dades = agrupacio.toObject();
      if (dades.id === null || dades.id === undefined) {
        delete dades.id;
      }
      const peticio = magatzem.put(dades);

      peticio.onsuccess = () => resolve(peticio.result);
      peticio.onerror = (event) =>
        reject(new Error(`BaseDades: no s'ha pogut afegir l'agrupació (${event.target.error})`));
    });
  }

  llegirAgrupacio(id) {
    return new Promise((resolve, reject) => {
      const transaccio = this._idb.transaction(MAGATZEM_AGRUPACIONS, 'readonly');
      const magatzem = transaccio.objectStore(MAGATZEM_AGRUPACIONS);
      const peticio = magatzem.get(Number(id));

      peticio.onsuccess = () => resolve(peticio.result);
      peticio.onerror = (event) =>
        reject(new Error(`BaseDades: no s'ha pogut llegir l'agrupació (${event.target.error})`));
    });
  }

  llegirTotesLesAgrupacions() {
    return new Promise((resolve, reject) => {
      const transaccio = this._idb.transaction(MAGATZEM_AGRUPACIONS, 'readonly');
      const magatzem = transaccio.objectStore(MAGATZEM_AGRUPACIONS);
      const peticio = magatzem.getAll();

      peticio.onsuccess = () => resolve(peticio.result);
      peticio.onerror = (event) =>
        reject(new Error(`BaseDades: no s'han pogut llegir les agrupacions (${event.target.error})`));
    });
  }

  esborrarAgrupacio(id) {
    return new Promise((resolve, reject) => {
      const transaccio = this._idb.transaction(MAGATZEM_AGRUPACIONS, 'readwrite');
      const magatzem = transaccio.objectStore(MAGATZEM_AGRUPACIONS);
      const peticio = magatzem.delete(Number(id));

      peticio.onsuccess = () => resolve();
      peticio.onerror = (event) =>
        reject(new Error(`BaseDades: no s'ha pogut esborrar l'agrupació (${event.target.error})`));
    });
  }

  /**
   * Totes les agrupacions a què pertany una parcel·la concreta -- via
   * l'índex multiEntry de parcelaIds. Es fa servir, per exemple, per
   * impedir esborrar una parcel·la que encara forma part d'alguna
   * agrupació.
   */
  llegirAgrupacionsAmbParcela(parcelaId) {
    return new Promise((resolve, reject) => {
      const transaccio = this._idb.transaction(MAGATZEM_AGRUPACIONS, 'readonly');
      const index = transaccio.objectStore(MAGATZEM_AGRUPACIONS).index('parcelaIds');
      const peticio = index.getAll(Number(parcelaId));

      peticio.onsuccess = () => resolve(peticio.result);
      peticio.onerror = (event) =>
        reject(new Error(`BaseDades: no s'han pogut llegir les agrupacions d'aquesta parcel·la (${event.target.error})`));
    });
  }
}
