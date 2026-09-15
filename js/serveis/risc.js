// Calcula el risc d'incendi d'una parcel·la combinant tres factors:
// vegetació (ponderada per la superfície de cada subparcela), pendent
// mitjà i orientació mitjana.
//
// No hi ha cap estàndard universal per a aquesta combinació concreta
// (la pròpia recerca del CREAF confirma que no existeix cap estàndard
// per als "models d'inflamabilitat") -- és un model propi, senzill i
// transparent, pensat per validar-lo i ajustar-lo amb dades reals, no
// una fórmula tancada.
//
// No fa cap crida externa: és càlcul pur a partir de dades que ja es
// tenen desades (pendent, orientació, subparceles), per això es pot
// calcular a l'instant cada vegada que cal, sense necessitat de
// "Calcular" ni desar-ho enlloc.

// Classificació per paraules clau de la descripció (dcc) del Cadastre,
// no pel codi curt (ccc): no hi ha una taula pública fiable de codis
// ccc (ni tan sols la comunitat d'OpenStreetMap, que fa anys que hi
// treballa, en té una de completa), mentre que amb paraules clau sobre
// el text es pot ser tolerant a petites variacions/errades del propi
// Cadastre. Es guarda igualment `ccc` (a basedades.js) per si mai cal
// una classificació pròpia més fina.
//
// Valors 0-1, validats amb criteri forestal propi (vegeu discussió al
// projecte): no una taula oficial, sinó la millor estimació disponible.
const PARAULES_CLAU_RISC = [
  { paraules: ['jara', 'jaral', 'brezal', 'argelaga', 'aulaga', 'estepa'], risc: 0.9 }, // matoll piròfil
  { paraules: ['eucalipto', 'eucaliptal'], risc: 0.9 }, // molt inflamable tot l'any (Elvira i Hernando, 1989)
  { paraules: ['pinar', 'pino ', 'sabinar', 'abeto', 'abetal', 'pinsapo'], risc: 0.8 }, // coníferes/resinoses
  { paraules: ['matorral', 'monte bajo'], risc: 0.7 }, // matoll general / munt baix
  { paraules: ['encinar', 'robledal', 'hayedo', 'quejigar', 'alcornocal', 'castañar', 'castanar'], risc: 0.55 }, // frondoses
  { paraules: ['pasto', 'prado', 'pradera'], risc: 0.4 },
  { paraules: ['labor', 'labradio', 'labradío', 'cereal'], risc: 0.2 }, // secà
  { paraules: ['viña', 'vina', 'viñedo', 'olivo', 'olivar', 'frutal', 'citrico', 'cítrico', 'naranj', 'almendro', 'algarrobo'], risc: 0.15 },
  { paraules: ['improductivo'], risc: 0.05 },
];

// Si cap paraula clau no encaixa (dcc desconeguda o inesperada), es fa
// servir aquest valor moderat en lloc de fallar -- però es deixa
// constància per consola perquè es pugui ampliar la llista amb casos
// reals que encara no s'havien previst.
const RISC_PER_DEFECTE = 0.3;

// Pendent (%) a partir del qual es considera risc màxim per aquest
// factor -- coincideix amb el llindar que fan servir metodologies
// oficials de perillositat estàtica (vegeu la recerca del projecte).
const PENDENT_RISC_MAXIM = 35;

const PES = {
  vegetacio: 0.5,
  pendent: 0.35,
  orientacio: 0.15,
};

// Color de les parcel·les mentre encara no es pot calcular el risc
// (falta el pendent mitjà) -- neutre, no relacionat amb cap escala.
const COLOR_NEUTRE = '#000000';

export class ServeiRisc {
  static COLOR_NEUTRE = COLOR_NEUTRE;

  /**
   * Color (HSL) per a un percentatge de risc: verd (0%) a roig (100%),
   * passant per grocs/taronges als valors intermedis -- una escala
   * contínua, no categories fixes (baix/mitjà/alt) com abans.
   */
  static colorSegonsRisc(index) {
    const p = Math.min(Math.max(index, 0), 100);
    const to = 120 - (120 * p) / 100; // 120° (verd) -> 0° (roig)
    return `hsl(${to}, 70%, 45%)`;
  }

  /** Risc base (0-1) d'una descripció de subparcela, per paraules clau. */
  static classificarSubparcela(dcc) {
    if (!dcc) return RISC_PER_DEFECTE;

    const text = dcc.toLowerCase();
    const entrada = PARAULES_CLAU_RISC.find(({ paraules }) =>
      paraules.some((paraula) => text.includes(paraula))
    );

    if (!entrada) {
      console.warn(`ServeiRisc: cap paraula clau reconeguda per a "${dcc}", es fa servir el risc per defecte`);
      return RISC_PER_DEFECTE;
    }
    return entrada.risc;
  }

  /**
   * Risc de vegetació (0-1) de tota la parcel·la: mitjana del risc de
   * cada subparcela, ponderada per la seva superfície (ssp).
   *
   * @param {Array<{dcc: string, ssp: string|number}>} subparceles
   * @returns {number|null} null si no hi ha subparceles (per exemple, cas del mas)
   */
  static calcularRiscVegetacio(subparceles) {
    if (!subparceles || subparceles.length === 0) return null;

    let sumaPonderada = 0;
    let sumaSuperficie = 0;
    for (const subparcela of subparceles) {
      const superficie = Number(subparcela.ssp) || 0;
      if (superficie <= 0) continue;
      sumaPonderada += ServeiRisc.classificarSubparcela(subparcela.dcc) * superficie;
      sumaSuperficie += superficie;
    }

    return sumaSuperficie > 0 ? sumaPonderada / sumaSuperficie : null;
  }

  /** Normalitza el pendent (%) a 0-1, saturant a partir de PENDENT_RISC_MAXIM. */
  static normalitzarPendent(pendentPercentatge) {
    return Math.min(pendentPercentatge / PENDENT_RISC_MAXIM, 1);
  }

  /** Normalitza l'orientació (graus, 0=Nord) a 0-1: màxim al sud, mínim al nord. */
  static normalitzarOrientacio(graus) {
    const rad = ((graus - 180) * Math.PI) / 180;
    return (1 + Math.cos(rad)) / 2;
  }

  /**
   * Calcula el risc d'incendi total (0-100%) combinant vegetació,
   * pendent i orientació. Si algun component no és disponible (sense
   * subparceles, o sense orientació -- només es calcula amb el mètode
   * de malla), es redistribueixen els pesos entre els components que sí
   * hi ha, en lloc de comptar-los com a zero.
   *
   * @param {{pendentMitja: number, orientacioMitjana: number|null, subparceles: Array}} dades
   * @returns {{indexPerillositat: number, riscVegetacio: number|null, riscPendent: number, riscOrientacio: number|null}}
   */
  static calcularRiscTotal({ pendentMitja, orientacioMitjana, subparceles }) {
    if (pendentMitja == null) {
      throw new Error(
        'ServeiRisc: cal el pendent mitjà (calcula\'l primer a la pàgina d\'altitud)'
      );
    }

    const riscVegetacio = ServeiRisc.calcularRiscVegetacio(subparceles);
    const riscPendent = ServeiRisc.normalitzarPendent(pendentMitja);
    const riscOrientacio =
      orientacioMitjana != null ? ServeiRisc.normalitzarOrientacio(orientacioMitjana) : null;

    const components = [
      { valor: riscVegetacio, pes: PES.vegetacio },
      { valor: riscPendent, pes: PES.pendent },
      { valor: riscOrientacio, pes: PES.orientacio },
    ].filter((c) => c.valor != null);

    const pesTotal = components.reduce((suma, c) => suma + c.pes, 0);
    const riscTotal = components.reduce(
      (suma, c) => suma + c.valor * (c.pes / pesTotal),
      0
    );

    return {
      indexPerillositat: riscTotal * 100,
      riscVegetacio,
      riscPendent,
      riscOrientacio,
    };
  }

  /**
   * Color (per pintar-la al mapa) i índex de perillositat d'una
   * parcel·la ja desada -- neutre si encara no té pendent mitjà
   * calculat. Necessita la BD per llegir-ne les subparceles: es fa
   * servir a totes les pàgines que pinten un mapa amb parcel·les
   * (llistat, selecció per a una agrupació...), per no duplicar
   * aquesta lògica a cadascuna.
   */
  static async colorIIndexDe(bd, parcela) {
    if (parcela.pendentMitja == null) {
      return { color: ServeiRisc.COLOR_NEUTRE, index: null };
    }

    const subparceles = await bd.llegirSubparcelesDe(parcela.id);
    const { indexPerillositat } = ServeiRisc.calcularRiscTotal({
      pendentMitja: parcela.pendentMitja,
      orientacioMitjana: parcela.orientacioMitjana,
      subparceles,
    });
    return { color: ServeiRisc.colorSegonsRisc(indexPerillositat), index: indexPerillositat };
  }
}
