// Ordenació d'una taula en clicar les capçaleres -- reutilitzat a
// parceles.html, agrupacions.html i geometries.html. No sap res del
// contingut de les files: només ordena l'array de dades que se li
// passa i torna a cridar la funció de pintat, que és responsabilitat
// de cada pàgina.
//
// "columnes" és un objecte { clau: (fila) => valor } -- una entrada
// per cada <th data-ordena="clau"> que es vulgui poder ordenar.

/** Compara dos valors, sigui quin sigui el seu tipus, amb els nuls sempre al final. */
function comparar(va, vb) {
  if (va == null && vb == null) return 0;
  if (va == null) return 1;
  if (vb == null) return -1;
  // numeric:true fa que "9" surti abans que "10" (no alfabèticament),
  // i funciona igual de bé amb text pur o amb números.
  return String(va).localeCompare(String(vb), 'ca', { numeric: true });
}

export function inicialitzarOrdenacio(capcalera, dades, columnes, pintar) {
  let claeActual = null;
  let ascendent = true;

  const capaleres = capcalera.querySelectorAll('th[data-ordena]');

  capaleres.forEach((th) => {
    th.classList.add('th-ordenable');
    th.addEventListener('click', () => {
      const clau = th.dataset.ordena;
      const extractor = columnes[clau];

      ascendent = claeActual === clau ? !ascendent : true;
      claeActual = clau;

      dades.sort((a, b) => {
        const resultat = comparar(extractor(a), extractor(b));
        return ascendent ? resultat : -resultat;
      });

      capaleres.forEach((altre) => altre.classList.remove('th-ordenable--asc', 'th-ordenable--desc'));
      th.classList.add(ascendent ? 'th-ordenable--asc' : 'th-ordenable--desc');

      pintar();
    });
  });
}
