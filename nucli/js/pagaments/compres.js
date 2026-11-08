// Capa de pagaments compartida per les apps. Separa QUÈ es ven (un
// producte, p. ex. "exportacio") de COM es cobra (un proveïdor), perquè
// la mateixa app pugui cobrar per Google Play (quan s'instal·la des de
// la Play Store, on Google obliga a fer servir Play Billing) i per un
// proveïdor web (Lemon Squeezy, Paddle...) quan s'obre al navegador.
//
// Límit honest d'aquest disseny: el codi arriba sencer al dispositiu (a la
// web, com a JavaScript) i tot hi passa, de manera que algú amb
// coneixements pot saltar-se el bloqueig. Una verificació forta necessitaria un servidor propi que
// validi els rebuts; la interfície ja està pensada perquè es pugui
// afegir dins d'un proveïdor sense tocar les apps.
//
// Interfície d'un proveïdor:
//   nom: string
//   esDemo: boolean
//   async compresActives(): string[]        ids dels productes comprats
//   async comprar(producte): boolean        cert si s'ha completat
//   async restaurar(): string[]             torna a llegir les compres
//   async preu(producte): string?           preu per mostrar (opcional; si no,
//                                           el de la configuració de l'app)

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

/**
 * Proveïdor de Google Play (app d'Android feta amb Capacitor), amb el
 * connector @capgo/native-purchases, que parla directament amb Google Play
 * Billing. Es crida pel pont natiu (window.Capacitor.nativePromise), sense
 * bundler, com els altres connectors de les apps (vegeu ui/descarrega.js).
 *
 * Els productes són de compra única ("inapp", no consumibles): l'id del
 * producte a la Play Console és el mateix que l'id de l'app (p. ex.
 * "exportacio"), o el que digui producte.idPlay.
 *
 * La compra la valida Google i el connector la confirma (acknowledge) sol;
 * sense confirmar, Google la retornaria al cap de 3 dies. Per si no hi ha
 * connexió, es desa l'última llista de compres coneguda al dispositiu: així
 * qui ha pagat pot continuar exportant fora de cobertura.
 */
export class ProveidorPlay {
  constructor(app) {
    this.nom = 'play';
    this.esDemo = false;
    this._clau = `${app}-compres-play`;
    this._preus = new Map();
  }

  static disponible() {
    const capacitor = globalThis.Capacitor;
    return Boolean(capacitor?.isNativePlatform?.() && capacitor.isPluginAvailable?.(CONNECTOR_PLAY));
  }

  _cridar(metode, opcions = {}) {
    return globalThis.Capacitor.nativePromise(CONNECTOR_PLAY, metode, opcions);
  }

  _idPlay(producte) {
    return producte.idPlay ?? producte.id;
  }

  _desades() {
    try {
      const desat = JSON.parse(localStorage.getItem(this._clau) ?? '[]');
      return Array.isArray(desat) ? desat : [];
    } catch {
      return [];
    }
  }

  async compresActives() {
    try {
      const { purchases = [] } = await this._cridar('getPurchases', { productType: 'inapp' });
      // A Android, "1" és una compra pagada; "0" un pagament pendent (en
      // efectiu, per exemple), que encara no dona dret al producte.
      const ids = [...new Set(purchases.filter((c) => c.purchaseState === '1').map((c) => c.productIdentifier))];
      try {
        localStorage.setItem(this._clau, JSON.stringify(ids));
      } catch {
        // Sense emmagatzematge: només es perd el mode sense connexió.
      }
      return ids;
    } catch (error) {
      console.warn('ProveidorPlay: no s\'han pogut llegir les compres; es fan servir les últimes conegudes', error);
      return this._desades();
    }
  }

  async preu(producte) {
    const id = this._idPlay(producte);
    if (!this._preus.has(id)) {
      try {
        const { products = [] } = await this._cridar('getProducts', { productIdentifiers: [id], productType: 'inapp' });
        const trobat = products.find((p) => p.identifier === id);
        if (trobat?.priceString) this._preus.set(id, trobat.priceString);
      } catch (error) {
        console.warn('ProveidorPlay: no s\'ha pogut llegir el preu de Google Play', error);
      }
    }
    return this._preus.get(id) ?? null;
  }

  async comprar(producte) {
    let transaccio;
    try {
      transaccio = await this._cridar('purchaseProduct', {
        productIdentifier: this._idPlay(producte),
        productType: 'inapp',
        quantity: 1,
      });
    } catch (error) {
      const codi = String(error?.code ?? error?.message ?? '');
      if (/USER_CANCELED/.test(codi)) return false;
      // Ja comprat (per exemple, en un altre dispositiu amb el mateix compte):
      // no és cap error, es restaura.
      if (/ITEM_ALREADY_OWNED/.test(codi)) return (await this.restaurar()).includes(producte.id);
      if (/pending/i.test(String(error?.message ?? ''))) throw new Error('pagament-pendent');
      throw error;
    }
    return transaccio?.purchaseState === undefined || transaccio.purchaseState === '1';
  }

  async restaurar() {
    try {
      await this._cridar('restorePurchases');
    } catch (error) {
      console.warn('ProveidorPlay: restorePurchases ha fallat; es llegeixen les compres igualment', error);
    }
    return this.compresActives();
  }
}

const CONNECTOR_PLAY = 'NativePurchases';

export class GestorCompres {
  /**
   * @param {{proveidor: object, productes: Array<{id: string, preu: string, idPlay?: string}>}} opcions
   *   preu: el que es mostra si el proveïdor no en dona cap (el de Google
   *   Play el fixa la Play Console i el dona el mateix proveïdor).
   */
  constructor({ proveidor, productes }) {
    this.proveidor = proveidor;
    this.productes = productes;
    this._actius = null;
  }

  producte(id) {
    return this.productes.find((p) => p.id === id) ?? null;
  }

  /** Preu per mostrar: el del proveïdor (Google Play, en la moneda de cada país) o el de la configuració. */
  async preu(id) {
    const producte = this.producte(id);
    if (!producte) return null;
    return (await this.proveidor.preu?.(producte)) ?? producte.preu;
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
 * Tria el proveïdor segons la configuració de l'app:
 *  - "demo": no cobra res (desenvolupament, i la web mentre no hi hagi
 *    proveïdor web);
 *  - "play": Google Play Billing (només dins de l'app d'Android);
 *  - "auto": Google Play a l'app d'Android que porti el connector, i la
 *    demostració a la resta (la web).
 * Pendent: un proveïdor web (enllaç de pagament + clau de llicència).
 */
export function crearProveidor({ app, proveidor }) {
  if (proveidor === 'demo') return new ProveidorDemo(app);
  if (proveidor === 'play') return new ProveidorPlay(app);
  if (proveidor === 'auto') return ProveidorPlay.disponible() ? new ProveidorPlay(app) : new ProveidorDemo(app);
  throw new Error(`crearProveidor: el proveïdor "${proveidor}" encara no està implementat`);
}
