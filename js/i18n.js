// Traduccions de Custòdia: fa servir el sistema compartit del nucli
// (nucli/js/i18n/i18n.js) i hi registra el diccionari propi.
//
// Per què aquest fitxer intermedi i no importar el nucli directament
// des de cada pàgina: configurarI18n s'ha de cridar abans de la
// primera traducció. Com que tots els mòduls importen t() d'aquí, el
// navegador avalua aquest fitxer (i per tant la configuració) abans
// que cap d'ells el pugui fer servir -- sense haver de recordar-ho a
// cada pàgina. La clau 'custodia-idioma' és la de sempre: es conserva
// l'idioma que cada usuari ja tenia triat.
import { configurarI18n } from '../nucli/js/i18n/i18n.js';
import { ES } from './i18n/es.js';

configurarI18n({ clau: 'custodia-idioma', diccionaris: { es: ES } });

export {
  t,
  idiomaActual,
  establirIdioma,
  aplicarTraduccions,
  inicialitzarSelectorIdioma,
} from '../nucli/js/i18n/i18n.js';
