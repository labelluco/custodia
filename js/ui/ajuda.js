// Gestiona les icones d'ajuda (".ajuda") de la pàgina: al passar el
// ratolí per damunt ja es mostren soles (CSS, :hover), però al mòbil no
// hi ha "passar per damunt" -- cal un toc que obri/tanqui l'explicació.
// Cal cridar-ho un cop després de pintar qualsevol contingut que
// n'inclogui (poden generar-se dinàmicament, per exemple a detall.js).

let inicialitzat = false;

export function inicialitzarAjudes() {
  if (inicialitzat) return; // l'escoltador es delega a tot el document, no cal repetir-ho
  inicialitzat = true;

  document.addEventListener('click', (event) => {
    const ajudaTocada = event.target.closest('.ajuda');

    document.querySelectorAll('.ajuda--oberta').forEach((el) => {
      if (el !== ajudaTocada) el.classList.remove('ajuda--oberta');
    });

    if (ajudaTocada) {
      ajudaTocada.classList.toggle('ajuda--oberta');
    }
  });
}

/** Marcatge de la icona d'ajuda, amb el text ja preparat per a l'atribut. */
export function iconaAjuda(text) {
  const escapat = text.replace(/"/g, '&quot;');
  return `<span class="ajuda" tabindex="0" data-ajuda="${escapat}">i</span>`;
}
