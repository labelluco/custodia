// Escales de color pures per als valors de terreny (altitud, pendent,
// ombres) -- no saben res de Leaflet, Three.js ni de cap altra
// tecnologia de pintat, només "donat aquest valor, quin color li
// toca". Compartit entre Mapa (2D, Leaflet) i Mapa3D (Three.js), per
// no haver de mantenir la mateixa fórmula en dos llocs.

/**
 * Degradat blau (més baix) -> roig (més alt), relatiu al mínim i màxim
 * indicats -- deliberadament diferent del degradat de risc
 * (verd->roig), per no confondre "més alt" amb "més risc".
 */
export function colorAltitud(altitud, minim, maxim) {
  const proporcio = maxim === minim ? 0.5 : (altitud - minim) / (maxim - minim);
  const to = Math.round(240 - proporcio * 240);
  return { color: `hsl(${to}, 75%, 40%)`, fillColor: `hsl(${to}, 75%, 50%)` };
}

// Llindar de saturació visual propi, independent del que fa servir
// ServeiRisc per al risc d'incendi (35%) -- aquí l'objectiu és només
// veure el relleu, no avaluar risc.
const PENDENT_MAXIM_VISUAL = 60;

/** Degradat verd (pla) -> roig (molt pendent). */
export function colorPendent(pendent) {
  const proporcio = Math.min(pendent / PENDENT_MAXIM_VISUAL, 1);
  const to = Math.round(120 - proporcio * 120);
  return { color: `hsl(${to}, 75%, 40%)`, fillColor: `hsl(${to}, 75%, 50%)` };
}

// Paràmetres del sol per a l'ombrejat (hillshade) -- iguals als que fa
// servir per defecte la majoria de programari SIG (QGIS, ArcGIS): sol
// a 45° d'alçada, des del nord-oest.
const ALCADA_SOL = 45;
const AZIMUT_SOL = 315;
const ZENIT_RAD = ((90 - ALCADA_SOL) * Math.PI) / 180;
const AZIMUT_RAD = (AZIMUT_SOL * Math.PI) / 180;

/** Il·luminació (0-1) segons el pendent (%) i l'orientació (graus) d'un punt. */
export function illuminacioOmbres(pendent, orientacio) {
  const pendentRad = Math.atan(pendent / 100);
  // Un punt pla (pendent 0) no té orientació (null): no fa falta cap
  // valor real, ja que sin(pendentRad) hi val 0 i cancel·la aquest
  // terme de la fórmula igualment.
  const aspecteRad = ((orientacio ?? 0) * Math.PI) / 180;

  const illuminacio =
    Math.cos(ZENIT_RAD) * Math.cos(pendentRad) +
    Math.sin(ZENIT_RAD) * Math.sin(pendentRad) * Math.cos(AZIMUT_RAD - aspecteRad);
  return Math.max(0, Math.min(1, illuminacio));
}

/** Igual que illuminacioOmbres, però ja convertit a un color gris (hsl). */
export function colorOmbres(pendent, orientacio) {
  const gris = Math.round(illuminacioOmbres(pendent, orientacio) * 100);
  return {
    color: `hsl(0, 0%, ${Math.max(gris - 15, 0)}%)`,
    fillColor: `hsl(0, 0%, ${gris}%)`,
    gris,
  };
}
