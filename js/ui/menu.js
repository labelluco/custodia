// Navegació de l'app, amb l'estil de Terra 3D: a l'escriptori, unes
// pestanyes segmentades dins la barra superior; en pantalles estretes,
// un botó que obre un diàleg amb totes les seccions (i les accions
// d'afegir). Les seccions es defineixen aquí una sola vegada i es
// pinten a #navegacio, en lloc de repetir el menú a cada HTML.
//
// La secció activa la diu cada pàgina amb <body data-seccio="...">.
// inicialitzarMenu() també prepara el que comparteixen totes les
// pàgines: les icones i el panell flotant (vegeu disposicio.js).
import { t } from '../i18n.js';
import { injectarIcones } from './icones.js';
import { inicialitzarDisposicio } from './disposicio.js';

const SECCIONS = [
  { id: 'inici', nom: 'Inici', href: 'index.html' },
  { id: 'parceles', nom: 'Parcel·les', href: 'parceles.html', afegir: { nom: 'Afegir parcel·la', href: 'afegir.html' } },
  { id: 'agrupacions', nom: 'Agrupacions', href: 'agrupacions.html', afegir: { nom: 'Afegir agrupació', href: 'afegir-agrupacio.html' } },
  { id: 'geometries', nom: 'Geometries', href: 'geometries.html', afegir: { nom: 'Afegir geometria', href: 'afegir-geometria.html' } },
  { id: 'copia', nom: 'Còpia de seguretat', href: 'copia-seguretat.html' },
];

export function inicialitzarMenu() {
  injectarIcones();
  inicialitzarDisposicio();

  const actual = document.body.dataset.seccio;
  const nav = document.getElementById('navegacio');
  if (nav) {
    nav.innerHTML = SECCIONS.map(
      (s) =>
        `<a href="${s.href}" class="pestanyes__opcio"${s.id === actual ? ' aria-current="page" aria-selected="true"' : ''}>${t(s.nom)}</a>`
    ).join('');
  }

  const boto = document.getElementById('boto-menu');
  if (!boto) return;

  const dialeg = document.createElement('dialog');
  dialeg.className = 'dialeg dialeg-menu';
  dialeg.innerHTML = `
    <form method="dialog" class="dialeg__cos">
      <div class="dialeg-menu__capcalera">
        <h2 class="dialeg__titol">Custòdia</h2>
        <button type="submit" class="boto-icona boto-icona--pla" aria-label="${t('Tancar')}"><svg><use href="#i-tancar"/></svg></button>
      </div>
      <ul class="llista-menu">
        ${SECCIONS.map(
          (s) => `
            <li>
              <a href="${s.href}" class="llista-menu__enllac"${s.id === actual ? ' aria-current="page"' : ''}>${t(s.nom)}</a>
              ${s.afegir ? `<a href="${s.afegir.href}" class="llista-menu__afegir"><svg><use href="#i-mes"/></svg>${t(s.afegir.nom)}</a>` : ''}
            </li>`
        ).join('')}
      </ul>
    </form>
  `;
  document.body.appendChild(dialeg);

  boto.addEventListener('click', () => dialeg.showModal());
  // Tocar fora de la targeta (el fons) també el tanca.
  dialeg.addEventListener('click', (event) => {
    if (event.target === dialeg) dialeg.close();
  });
}
