// Disposició de les pantalles amb mapa a pantalla completa: el panell
// flotant (.panell) tapa una part del mapa -- a l'esquerra a
// l'escriptori, a baix al mòbil. Aquí es mesura quant en tapa, perquè:
//  - el mapa (Mapa) i el 3D (Mapa3D) centrin el que ensenyen a la part
//    que es veu, no darrere del panell;
//  - el CSS hi pugui apartar els controls de Leaflet, amb les variables
//    --panell-esquerra i --panell-inferior (vegeu css/estils.css).
// També gestiona l'ansa del full inferior (plegar/desplegar) al mòbil.

/** Píxels del mapa tapats pel panell: {esquerra, inferior}. */
export function margesPanell() {
  const panell = document.querySelector('.panell');
  if (!panell || panell.hidden) return { esquerra: 0, inferior: 0 };
  const r = panell.getBoundingClientRect();
  const amplada = window.innerWidth;
  // Lateral si ocupa menys de la meitat de l'amplada (escriptori); full
  // inferior si va d'una vora a l'altra (mòbil).
  if (r.width < amplada * 0.6) return { esquerra: Math.max(0, r.right), inferior: 0 };
  return { esquerra: 0, inferior: Math.max(0, window.innerHeight - r.top) };
}

function actualitzarVariables() {
  const { esquerra, inferior } = margesPanell();
  const arrel = document.documentElement.style;
  arrel.setProperty('--panell-esquerra', `${Math.round(esquerra)}px`);
  arrel.setProperty('--panell-inferior', `${Math.round(inferior)}px`);
  window.dispatchEvent(new Event('canvi-panell'));
}

export function inicialitzarDisposicio() {
  const panell = document.querySelector('.panell');
  if (!panell) return;

  actualitzarVariables();
  new ResizeObserver(actualitzarVariables).observe(panell);
  window.addEventListener('resize', actualitzarVariables);
  // Durant la transició de plegar/desplegar, el ResizeObserver ja avisa
  // a cada canvi de mida; transitionend assegura el valor final.
  panell.addEventListener('transitionend', actualitzarVariables);

  const ansa = panell.querySelector('.panell__ansa');
  ansa?.addEventListener('click', () => {
    const plegat = panell.classList.toggle('panell--plegat');
    ansa.setAttribute('aria-expanded', plegat ? 'false' : 'true');
    if (!plegat) panell.scrollTop = 0;
  });
}
