// Combina els valors ja calculats de cada parcel·la d'una agrupació en
// un únic resum (altitud, pendent, orientació, risc) -- no torna a
// calcular res des de zero (ni Horn ni cap consulta a l'IDEE), només
// combina el que ja hi ha desat a cada parcel·la. Es fa servir tant a
// detall-agrupacio.js com a altitud-agrupacio.js, que mostren tots dos
// el mateix tipus de resultat combinat.
import { ServeiRisc } from './risc.js';
import { ServeiOrientacio } from './orientacio.js';

/**
 * @param {BaseDades} bd
 * @param {Array} parceles Les parcel·les que formen l'agrupació
 * @returns {Promise<{ok: false, senseCalcular: Array} | {ok: true, altitudMinima: number, altitudMaxima: number, desnivell: number, pendentMitja: number, orientacioMitjana: number, risc: Object}>}
 *   Si alguna parcel·la encara no té pendent/orientació calculats (amb
 *   el mètode de malla), es retornen quines en lloc de combinar dades
 *   incompletes.
 */
export async function calcularAgregatAgrupacio(bd, parceles) {
  const senseCalcular = parceles.filter((p) => p.pendentMitja == null || p.orientacioMitjana == null);
  if (senseCalcular.length > 0) {
    return { ok: false, senseCalcular };
  }

  const totalSuperficie = parceles.reduce((acc, p) => acc + (p.superficie ?? 1), 0);
  const altitudMinima = Math.min(...parceles.map((p) => p.altitudMinima));
  const altitudMaxima = Math.max(...parceles.map((p) => p.altitudMaxima));
  const desnivell = altitudMaxima - altitudMinima;
  const pendentMitja =
    parceles.reduce((acc, p) => acc + p.pendentMitja * (p.superficie ?? 1), 0) / totalSuperficie;
  const orientacioMitjana = ServeiOrientacio.mitjanaCircularPonderada(
    parceles.map((p) => ({ angle: p.orientacioMitjana, pes: p.superficie ?? 1 }))
  );

  // El risc de vegetació surt de TOTES les subparceles de TOTES les
  // parcel·les juntes -- es reutilitza ServeiRisc.calcularRiscTotal tal
  // qual, com si l'agrupació fos una única parcel·la "virtual".
  const totesLesSubparceles = (
    await Promise.all(parceles.map((p) => bd.llegirSubparcelesDe(p.id)))
  ).flat();
  const risc = ServeiRisc.calcularRiscTotal({ pendentMitja, orientacioMitjana, subparceles: totesLesSubparceles });

  return { ok: true, altitudMinima, altitudMaxima, desnivell, pendentMitja, orientacioMitjana, risc };
}
