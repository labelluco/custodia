// Pestanyes segmentades (estil del nucli) que mostren un sol bloc alhora:
// cada botó porta data-pestanya="nom" i cada bloc data-panell-pestanya="nom".

/**
 * @param {Element} contenidor El grup de pestanyes (.pestanyes)
 * @param {(nom: string) => void} [onCanvi]
 * @returns {(nom: string) => void} funció per activar una pestanya per codi
 */
export function inicialitzarPestanyes(contenidor, onCanvi) {
  const botons = Array.from(contenidor.querySelectorAll('[data-pestanya]'));

  function activar(nom) {
    for (const boto of botons) boto.setAttribute('aria-selected', boto.dataset.pestanya === nom ? 'true' : 'false');
    document.querySelectorAll('[data-panell-pestanya]').forEach((bloc) => {
      bloc.hidden = bloc.dataset.panellPestanya !== nom;
    });
    onCanvi?.(nom);
  }

  for (const boto of botons) boto.addEventListener('click', () => activar(boto.dataset.pestanya));
  return activar;
}
