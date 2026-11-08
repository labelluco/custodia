// Països (o regions) amb dades pròpies. Cada país diu:
//  - si un punt hi cau (conte),
//  - en quin sistema de coordenades es treballa allà (crsPer),
//  - d'on surten el relleu i la imatge (vegeu serveis/fontsDades.js),
//  - i, a la interfície, quins mètodes de cerca ofereix (modes).
// "mon" és la resta: dibuix i dades mundials. Afegir un país vol dir
// afegir-ne un aquí i les seves fonts a fontsDades.js.
//
// El contorn d'Espanya és una simplificació feta a mà: precís a les
// fronteres terrestres a escala de pocs quilòmetres i generós cap al mar
// (al mar no s'hi dibuixa). Si una zona fronterera hi cau "dins" però
// l'IGN no hi té dades, el generador de models torna sol a les dades
// mundials (vegeu generadorModel.js): l'error del contorn no fa mal.

import { puntDinsAnell } from '../geometria/poligon.js';
import { EPSG_UTM, EPSG_CANARIES, crsUtmPer } from '../geometria/projeccio.js';

// [lng, lat], perquè puntDinsAnell treballa en (x, y).
const PENINSULA = [
  // Costa atlàntica de Galícia i frontera amb Portugal (Minho, Douro, Tajo, Guadiana)
  [-9.3, 42.0], [-8.88, 41.87], [-8.64, 42.04], [-8.2, 42.13], [-8.08, 42.08], [-7.92, 41.86],
  [-7.6, 41.9], [-7.2, 41.88], [-6.9, 41.95], [-6.55, 41.98], [-6.3, 41.67], [-6.27, 41.5],
  [-6.93, 41.02], [-6.8, 40.75], [-6.79, 40.6], [-6.95, 40.25], [-7.0, 39.95], [-7.53, 39.66], [-7.3, 39.4],
  [-7.03, 38.88], [-7.3, 38.55], [-6.95, 38.2], [-7.25, 37.95], [-7.5, 37.55], [-7.4, 37.17],
  // Costa sud i mediterrània (mar endins)
  [-7.45, 36.9], [-6.2, 36.0], [-5.62, 35.95], [-5.2, 36.1], [-2.0, 36.5], [-0.4, 37.4],
  [0.4, 38.7], [0.9, 40.3], [1.6, 41.0], [2.9, 41.6], [3.35, 42.15], [3.2, 42.43],
  // Frontera amb França i Andorra (Pirineu)
  [2.86, 42.46], [1.93, 42.43], [1.79, 42.43], [1.41, 42.43], [1.1, 42.7], [0.7, 42.86],
  [0.4, 42.7], [-0.05, 42.75], [-0.55, 42.85], [-1.0, 43.05], [-1.45, 43.2], [-1.79, 43.38],
  // Costa cantàbrica (mar endins)
  [-1.8, 43.45], [-3.5, 43.9], [-8.0, 44.0], [-9.6, 43.3],
];

const caixa = (minLng, minLat, maxLng, maxLat) => [
  [minLng, minLat], [maxLng, minLat], [maxLng, maxLat], [minLng, maxLat],
];
const BALEARS = caixa(1.1, 38.55, 4.45, 40.2);
const CANARIES = caixa(-18.3, 27.5, -13.3, 29.5);
const CEUTA = caixa(-5.42, 35.86, -5.27, 35.93);
const MELILLA = caixa(-2.98, 35.26, -2.92, 35.32);

const esCanaries = ([lat, lng]) => puntDinsAnell([lng, lat], CANARIES);

export const PAISOS = {
  espanya: {
    id: 'espanya',
    modes: ['referencia', 'parcela', 'dibuix'],
    conte: ([lat, lng]) =>
      [PENINSULA, BALEARS, CANARIES, CEUTA, MELILLA].some((anell) => puntDinsAnell([lng, lat], anell)),
    crsPer: (punt) => (esCanaries(punt) ? EPSG_CANARIES : EPSG_UTM),
  },
  mon: {
    id: 'mon',
    modes: ['dibuix'],
    conte: () => true,
    crsPer: (punt) => crsUtmPer(punt),
  },
};

/** País amb dades pròpies on cau el punt [lat, lng], o "mon". */
export function paisDe(punt) {
  return PAISOS.espanya.conte(punt) ? PAISOS.espanya : PAISOS.mon;
}

/** Sistema de coordenades on s'ha de treballar una zona que comença en aquest punt. */
export function crsPer(punt) {
  return paisDe(punt).crsPer(punt);
}
