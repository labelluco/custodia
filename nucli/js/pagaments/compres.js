// Capa de pagaments compartida per les apps. Separa QUÈ es ven (un
// producte, p. ex. "exportacio") de COM es cobra (un proveïdor), perquè
// la mateixa app pugui cobrar per Google Play (quan s'instal·la des de
// la Play Store, on Google obliga a fer servir Play Billing) i per un
// proveïdor web (Lemon Squeezy, Paddle...) quan s'obre al navegador.
//
// Límit honest d'aquest disseny: el codi és lliure (AGPL) i tot passa
// al dispositiu, de manera que algú amb coneixements pot saltar-se el
// bloqueig. Una verificació forta necessitaria un servidor propi que
// validi els rebuts; la interfície ja està pensada perquè es pugui
// afegir dins d'un proveïdor sense tocar les apps.
//
// Interfície d'un proveïdor:
//   nom: string
//   esDemo: boolean
//   async compresActives(): string[]        ids dels productes comprats
//   async comprar(producte): boolean        cert si s'ha completat
//   async restaurar(): string[]             torna a llegir les compres

/**
 * Proveïdor de demostració: no cobra res, només desa la "compra" al
 * dispositiu. Serveix per desenvolupar i provar tot el circuit (bloqueig,
 * diàleg, desbloqueig) abans de tenir comptes als proveïdors reals.
 */
export class ProveidorDemo {
  constructor(app) {
    this.nom = 'demo';
    this.esDemo = true;
    this._clau = `${app}-compres-demo`;
    this._memoria = [];
  }

  _llegir() {
    try {
      const desat = JSON.parse(localStorage.getItem(this._clau) ?? '[]');
      return Array.isArray(desat) ? desat : [];
    } catch {
      return this._memoria;
    }
  }

  _desar(ids) {
    this._memoria = ids;
    try {
      localStorage.setItem(this._clau, JSON.stringify(ids));
    } catch {
      // Sense emmagatzematge (mode privat): la compra dura fins que es tanqui la pàgina.
    }
  }

  async compresActives() {
    return this._llegir();
  }

  async comprar(producte) {
    const ids = new Set(this._llegir());
    ids.add(producte.id);
    this._desar([...ids]);
    return true;
  }

  async restaurar() {
    return this._llegir();
  }

  /** Només per a proves: oblida les compres de demostració. */
  async oblidar() {
    this._desar([]);
  }
}

export class GestorCompres {
  /**
   * @param {{proveidor: object, productes: Array<{id: string, preu: string}>}} opcions
   */
  constructor({ proveidor, productes }) {
    this.proveidor = proveidor;
    this.productes = productes;
    this._actius = null;
  }

  producte(id) {
    return this.productes.find((p) => p.id === id) ?? null;
  }

  async teProducte(id) {
    if (!this._actius) this._actius = new Set(await this.proveidor.compresActives());
    return this._actius.has(id);
  }

  async comprar(id) {
    const producte = this.producte(id);
    if (!producte) throw new Error(`GestorCompres: producte desconegut "${id}"`);
    const fet = await this.proveidor.comprar(producte);
    if (fet) {
      this._actius = null;
      document.dispatchEvent(new CustomEvent('compres-canviades'));
    }
    return fet;
  }

  async restaurar() {
    this._actius = new Set(await this.proveidor.restaurar());
    document.dispatchEvent(new CustomEvent('compres-canviades'));
    return [...this._actius];
  }
}

/**
 * Tria el proveïdor segons la configuració de l'app. De moment només hi
 * ha el de demostració; quan hi hagi comptes reals s'hi afegiran:
 *  - "play": Digital Goods API + Payment Request (app instal·lada com a
 *    TWA des de Google Play);
 *  - "web": enllaç de pagament + validació de la clau de llicència.
 */
export function crearProveidor({ app, proveidor }) {
  if (proveidor === 'demo') return new ProveidorDemo(app);
  throw new Error(`crearProveidor: el proveïdor "${proveidor}" encara no està implementat`);
}
