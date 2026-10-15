// Sistema de traduccions compartit (ve de Custòdia, js/i18n.js). El text
// ORIGINAL en català fa de clau del diccionari; si una traducció falta,
// es mostra el català -- mai una clau críptica.
//
// Diferències respecte a Custòdia:
//  - cada app hi registra el seu propi diccionari (configurarI18n), que
//    se suma al del nucli (textos dels components compartits);
//  - la clau de localStorage és per app, i l'accés va dins de try/catch
//    (pot fallar en mode privat o dins d'un iframe);
//  - establirIdioma pot canviar l'idioma sense recarregar la pàgina:
//    útil a les apps d'una sola pantalla, que no volen perdre l'estat.
//    En aquest cas s'emet l'esdeveniment "canvi-idioma" a document.
import { ES as ES_NUCLI } from './es.js';

const IDIOMES_DISPONIBLES = ['ca', 'es'];
const DICCIONARIS = { es: { ...ES_NUCLI } };
let clauEmmagatzematge = 'nucli-idioma';
let idiomaEnMemoria = null;

/**
 * @param {{clau?: string, diccionaris?: Record<string, Record<string, string>>}} opcions
 */
export function configurarI18n({ clau, diccionaris = {} } = {}) {
  if (clau) clauEmmagatzematge = clau;
  for (const [idioma, diccionari] of Object.entries(diccionaris)) {
    DICCIONARIS[idioma] = { ...(DICCIONARIS[idioma] ?? {}), ...diccionari };
  }
}

function llegirPreferencia() {
  try {
    return localStorage.getItem(clauEmmagatzematge);
  } catch {
    return null;
  }
}

/** Preferència desada > idioma del navegador > castellà si no és català. */
export function idiomaActual() {
  const desat = idiomaEnMemoria ?? llegirPreferencia();
  if (desat && IDIOMES_DISPONIBLES.includes(desat)) return desat;
  const navegador = (navigator.language || '').toLowerCase();
  return navegador.startsWith('ca') ? 'ca' : 'es';
}

export function establirIdioma(idioma, { recarregar = true } = {}) {
  if (!IDIOMES_DISPONIBLES.includes(idioma)) return;
  idiomaEnMemoria = idioma;
  try {
    localStorage.setItem(clauEmmagatzematge, idioma);
  } catch {
    // Sense emmagatzematge: l'idioma es manté només durant aquesta visita.
  }
  if (recarregar) {
    window.location.reload();
    return;
  }
  aplicarTraduccions();
  document.dispatchEvent(new CustomEvent('canvi-idioma', { detail: { idioma } }));
}

export function t(text) {
  const idioma = idiomaActual();
  if (idioma === 'ca') return text;
  const traduccio = DICCIONARIS[idioma]?.[text];
  if (traduccio === undefined) {
    console.warn(`i18n: falta la traducció a "${idioma}" per a: "${text}"`);
    return text;
  }
  return traduccio;
}

/** Tradueix data-i18n (text), data-i18n-placeholder, data-i18n-title i data-i18n-aria-label. */
export function aplicarTraduccions(arrel = document) {
  arrel.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  arrel.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  arrel.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.title = t(el.dataset.i18nTitle);
  });
  arrel.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
    el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel));
  });
  document.documentElement.lang = idiomaActual();
}

/** Selector CA/ES dins del contenidor indicat. */
export function inicialitzarSelectorIdioma(idContenidor, { recarregar = true } = {}) {
  const contenidor = document.getElementById(idContenidor);
  if (!contenidor) return;

  const pintar = () => {
    const actual = idiomaActual();
    contenidor.innerHTML = IDIOMES_DISPONIBLES.map(
      (idioma) =>
        `<button type="button" class="selector-idioma__opcio${idioma === actual ? ' selector-idioma__opcio--actiu' : ''}" data-idioma="${idioma}" aria-pressed="${idioma === actual}">${idioma.toUpperCase()}</button>`
    ).join('');
    contenidor.querySelectorAll('button').forEach((boto) => {
      boto.addEventListener('click', () => {
        establirIdioma(boto.dataset.idioma, { recarregar });
        if (!recarregar) pintar();
      });
    });
  };
  pintar();
}
