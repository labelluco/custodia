// Ordenació dels llistats (parcel·les, agrupacions, geometries) amb un
// desplegable "Ordena per" i un botó per invertir el sentit -- substitueix
// les capçaleres clicables de la taula, que no cabien al panell. No sap
// res del contingut: només ordena l'array de dades i torna a cridar la
// funció de pintat de cada pàgina.
//
// "columnes" és un objecte { clau: (fila) => valor }, una entrada per
// cada <option value="clau"> del desplegable. L'opció de valor buit
// torna a l'ordre original (el d'alta).

/** Compara dos valors, sigui quin sigui el seu tipus, amb els nuls sempre al final. */
function comparar(va, vb) {
  if (va == null && vb == null) return 0;
  if (va == null) return 1;
  if (vb == null) return -1;
  // numeric:true fa que "9" surti abans que "10" (no alfabèticament),
  // i funciona igual de bé amb text pur o amb números.
  return String(va).localeCompare(String(vb), 'ca', { numeric: true });
}

export function inicialitzarOrdenacio(select, botoSentit, dades, columnes, pintar) {
  const ordreOriginal = [...dades];
  let ascendent = true;

  function ordenar() {
    const extractor = columnes[select.value];
    if (extractor) {
      dades.sort((a, b) => {
        const resultat = comparar(extractor(a), extractor(b));
        return ascendent ? resultat : -resultat;
      });
    } else {
      dades.splice(0, dades.length, ...ordreOriginal);
      if (!ascendent) dades.reverse();
    }
    pintar();
  }

  select.addEventListener('change', ordenar);
  botoSentit.addEventListener('click', () => {
    ascendent = !ascendent;
    botoSentit.setAttribute('aria-pressed', ascendent ? 'false' : 'true');
    botoSentit.classList.toggle('boto-sentit--descendent', !ascendent);
    ordenar();
  });
}
