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
//    En aquest cas s'emet l'esdeveniment "canvi-idioma" a document;
//  - cada app diu quins idiomes té i quin fa servir si el del dispositiu
//    no hi és (Custòdia: català i castellà; Terra Bloc: també anglès).
import { ES as ES_NUCLI } from './es.js';
import { EN as EN_NUCLI } from './en.js';

let idiomesDisponibles = ['ca', 'es'];
let idiomaPerDefecte = 'es';
const DICCIONARIS = { es: { ...ES_NUCLI }, en: { ...EN_NUCLI } };
let clauEmmagatzematge = 'nucli-idioma';
let idiomaEnMemoria = null;

/**
 * @param {{clau?: string, idiomes?: string[], perDefecte?: string, diccionaris?: Record<string, Record<string, string>>}} opcions
 *   idiomes: els que ofereix l'app (el català sempre, és l'idioma de les claus);
 *   perDefecte: el que es fa servir si el del dispositiu no és entre aquests.
 */
export function configurarI18n({ clau, idiomes, perDefecte, diccionaris = {} } = {}) {
  if (clau) clauEmmagatzematge = clau;
  if (idiomes) idiomesDisponibles = idiomes;
  if (perDefecte) idiomaPerDefecte = perDefecte;
  for (const [idioma, diccionari] of Object.entries(diccionaris)) {
    DICCIONARIS[idioma] = { ...(DICCIONARIS[idioma] ?? {}), ...diccionari };
  }
}

/** Idiomes que ofereix l'app, per ordre. */
export function idiomes() {
  return [...idiomesDisponibles];
}

function llegirPreferencia() {
  try {
    return localStorage.getItem(clauEmmagatzematge);
  } catch {
    return null;
  }
}

/**
 * Preferència desada > primer idioma del dispositiu que l'app tingui
 * (navigator.languages, en l'ordre de preferència de la persona) >
 * l'idioma per defecte de l'app.
 */
export function idiomaActual() {
  const desat = idiomaEnMemoria ?? llegirPreferencia();
  if (desat && idiomesDisponibles.includes(desat)) return desat;
  const preferits = navigator.languages?.length ? navigator.languages : [navigator.language || ''];
  for (const preferit of preferits) {
    const codi = preferit.toLowerCase().split('-')[0];
    if (idiomesDisponibles.includes(codi)) return codi;
  }
  return idiomaPerDefecte;
}

export function establirIdioma(idioma, { recarregar = true } = {}) {
  if (!idiomesDisponibles.includes(idioma)) return;
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

/** Selector d'idioma (CA/ES/EN...) dins del contenidor indicat. */
export function inicialitzarSelectorIdioma(idContenidor, { recarregar = true } = {}) {
  const contenidor = document.getElementById(idContenidor);
  if (!contenidor) return;

  const pintar = () => {
    const actual = idiomaActual();
    contenidor.innerHTML = idiomesDisponibles.map(
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
