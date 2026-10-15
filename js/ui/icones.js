// Icones de línia (sprite SVG) de tota l'app, en un sol lloc. Es
// fan servir amb <svg><use href="#i-nom"/></svg>; injectarIcones() les
// afegeix al document un sol cop (ho fa inicialitzarMenu, que criden
// totes les pàgines). Mateix estil que les de Terra 3D.

const TRAC = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

const ICONES = {
  enrere: '<path d="M15 18l-6-6 6-6"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  mes: '<path d="M12 5v14M5 12h14"/>',
  cercar: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  escut: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/>',
  desfer: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  paperera: '<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/>',
  descarregar: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 21h16"/>',
  pujar: '<path d="M12 21V9M7 14l5-5 5 5"/><path d="M4 3h16"/>',
  muntanya: '<path d="M3 20l6-10 4 6 3-4 5 8H3z"/>',
  ruta: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h6a4 4 0 0 0 0-8h-4a4 4 0 0 1 0-8h6"/>',
  llapis: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13 7l4 4"/>',
  ordre: '<path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4"/>',
  tancar: '<path d="M6 6l12 12M18 6L6 18"/>',
};

export function injectarIcones() {
  if (document.getElementById('icones-custodia')) return;
  const simbols = Object.entries(ICONES)
    .map(([nom, cos]) => `<symbol id="i-${nom}" viewBox="0 0 24 24" ${TRAC}>${cos}</symbol>`)
    .join('');
  document.body.insertAdjacentHTML(
    'afterbegin',
    `<svg id="icones-custodia" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${simbols}</defs></svg>`
  );
}
