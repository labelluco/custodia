// Vista inicial del mapa i record de l'última vista.
//
// La primera vegada, el mapa es centra a la ciutat de referència de la
// zona horària del dispositiu (Europe/Madrid -> Madrid, Atlantic/Canary ->
// Canàries, America/Mexico_City -> Mèxic...). Es fa així i no per IP
// perquè no cal enviar res a cap servei extern: la zona horària la sap el
// mateix dispositiu, i la taula de coordenades és local (dades/zonesHoraries.js).
// A partir d'aquí, es recorda l'última vista (centre i zoom) al dispositiu.

import { ZONES, ENLLACOS } from '../dades/zonesHoraries.js';

const VISTA_MON = { centre: [25, 5], zoom: 2, origen: 'mon' };
const ZOOM_PAIS = 6;

/** Centre segons la zona horària del dispositiu, o null si no se sap. */
export function vistaPerZonaHoraria(zona = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  const dades = ZONES[zona] ?? ZONES[ENLLACOS[zona]];
  if (!dades) return null;
  return { centre: [dades[0], dades[1]], zoom: ZOOM_PAIS, pais: dades[2], origen: 'zona-horaria' };
}

function llegirVistaDesada(clau) {
  try {
    const desada = JSON.parse(localStorage.getItem(clau) ?? 'null');
    if (desada && Array.isArray(desada.centre) && Number.isFinite(desada.zoom)) return { ...desada, origen: 'desada' };
  } catch {
    // Sense emmagatzematge o dada malmesa: es torna a calcular.
  }
  return null;
}

/**
 * Vista desada > vista per zona horària > tot el món. "origen" diu d'on ve:
 * l'app pot voler ajustar una vista calculada (no la desada) a l'espai que
 * li deixen els seus panells.
 */
export function vistaInicial(clau) {
  return llegirVistaDesada(clau) ?? vistaPerZonaHoraria() ?? VISTA_MON;
}

/** Desa la vista cada vegada que el mapa s'atura de moure. */
export function recordarVista(mapa, clau) {
  mapa.on('moveend', () => {
    const { lat, lng } = mapa.getCenter();
    try {
      localStorage.setItem(clau, JSON.stringify({ centre: [+lat.toFixed(5), +lng.toFixed(5)], zoom: mapa.getZoom() }));
    } catch {
      // Sense emmagatzematge: la vista no es recordarà.
    }
  });
}
