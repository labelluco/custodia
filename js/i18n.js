// Sistema de traduccions molt senzill: el text ORIGINAL en català (l'idioma
// en què està escrita l'app) fa de clau del diccionari, i el valor és la
// seva traducció a cada idioma addicional. Si un text no té traducció
// encara, es mostra tal qual en català -- mai es trenca res ni surt cap
// clau críptica per una traducció que falti.
import { ES } from './i18n/es.js';

const DICCIONARIS = { es: ES };
const IDIOMES_DISPONIBLES = ['ca', 'es'];
const CLAU_LOCALSTORAGE = 'custodia-idioma';

/**
 * Idioma actiu: preferència ja triada per l'usuari (desada) > idioma del
 * navegador > català per defecte (l'idioma "font" de l'app).
 */
export function idiomaActual() {
  const desat = localStorage.getItem(CLAU_LOCALSTORAGE);
  if (desat && IDIOMES_DISPONIBLES.includes(desat)) return desat;

  const navegador = (navigator.language || '').toLowerCase();
  return navegador.startsWith('ca') ? 'ca' : 'es';
}

/** Canvia l'idioma, el desa, i recarrega la pàgina perquè s'apliqui arreu. */
export function establirIdioma(idioma) {
  if (!IDIOMES_DISPONIBLES.includes(idioma)) return;
  localStorage.setItem(CLAU_LOCALSTORAGE, idioma);
  window.location.reload();
}

/**
 * Tradueix un text (escrit en català al codi/HTML) a l'idioma actiu.
 * Si l'idioma actiu és el català, o si no hi ha traducció per a aquell
 * text concret, es retorna el text original -- mai undefined ni buit.
 */
export function t(text) {
  const idioma = idiomaActual();
  if (idioma === 'ca') return text;

  const diccionari = DICCIONARIS[idioma];
  const traduccio = diccionari?.[text];
  if (traduccio === undefined) {
    console.warn(`i18n: falta la traducció a "${idioma}" per a: "${text}"`);
    return text;
  }
  return traduccio;
}

/**
 * Aplica les traduccions a tots els elements marcats amb data-i18n (text)
 * o data-i18n-placeholder (placeholder d'un input) de la pàgina actual.
 * Cal cridar-ho un cop, en carregar cada pàgina.
 */
export function aplicarTraduccions() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.documentElement.lang = idiomaActual();
}

/** Insereix el selector d'idioma (CA/ES) dins del contenidor indicat. */
export function inicialitzarSelectorIdioma(idContenidor) {
  const contenidor = document.getElementById(idContenidor);
  if (!contenidor) return;

  const actual = idiomaActual();
  contenidor.innerHTML = IDIOMES_DISPONIBLES.map(
    (idioma) => `
      <button
        type="button"
        class="selector-idioma__opcio${idioma === actual ? ' selector-idioma__opcio--actiu' : ''}"
        data-idioma="${idioma}"
      >${idioma.toUpperCase()}</button>
    `
  ).join('');

  contenidor.querySelectorAll('button').forEach((boto) => {
    boto.addEventListener('click', () => establirIdioma(boto.dataset.idioma));
  });
}
