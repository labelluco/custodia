// Desa un fitxer generat al dispositiu. Al navegador fa servir un enllaç
// temporal amb "download"; dins d'una app instal·lada (TWA d'Android)
// el mateix enllaç obre el gestor de descàrregues del sistema.

/**
 * @param {BlobPart} contingut
 * @param {string} nomFitxer
 * @param {string} tipus Tipus MIME
 */
export function descarregarFitxer(contingut, nomFitxer, tipus) {
  const blob = new Blob([contingut], { type: tipus });
  const url = URL.createObjectURL(blob);
  const enllac = document.createElement('a');
  enllac.href = url;
  enllac.download = nomFitxer;
  document.body.appendChild(enllac);
  enllac.click();
  enllac.remove();
  // Es deixa un marge abans d'alliberar l'URL: alguns navegadors
  // comencen la descàrrega de manera asíncrona.
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** Nom de fitxer segur a partir d'un text qualsevol. */
export function nomFitxerSegur(text) {
  return (
    String(text)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'model'
  );
}
