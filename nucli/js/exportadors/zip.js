// Fitxer ZIP sense compressió (mètode "store"), per agrupar diversos
// fitxers en una sola descàrrega (les peces d'un mosaic). Sense
// dependències: els STL binaris gairebé no es comprimeixen, i així no cal
// cap llibreria. Noms en UTF-8 (bit 11 de les banderes).
//
// Format: per a cada fitxer, una capçalera local i les dades; al final, el
// directori central i el registre de final. Tot en little-endian.

const TAULA_CRC = (() => {
  const taula = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    taula[n] = c >>> 0;
  }
  return taula;
})();

function crc32(dades) {
  let c = 0xffffffff;
  for (let i = 0; i < dades.length; i++) c = TAULA_CRC[(c ^ dades[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Data i hora en el format de MS-DOS que fa servir el ZIP. */
function dataDos(data) {
  const hora = (data.getHours() << 11) | (data.getMinutes() << 5) | (data.getSeconds() >> 1);
  const dia = ((data.getFullYear() - 1980) << 9) | ((data.getMonth() + 1) << 5) | data.getDate();
  return { hora, dia };
}

/**
 * @param {Array<{nom: string, dades: ArrayBuffer | Uint8Array | string}>} fitxers
 * @returns {Blob}
 */
export function crearZip(fitxers) {
  const codificador = new TextEncoder();
  const { hora, dia } = dataDos(new Date());
  const parts = [];
  const central = [];
  let desplacament = 0;

  for (const fitxer of fitxers) {
    const nom = codificador.encode(fitxer.nom);
    const dades =
      typeof fitxer.dades === 'string'
        ? codificador.encode(fitxer.dades)
        : fitxer.dades instanceof Uint8Array
          ? fitxer.dades
          : new Uint8Array(fitxer.dades);
    const crc = crc32(dades);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true); // versió necessària
    local.setUint16(6, 0x0800, true); // noms en UTF-8
    local.setUint16(8, 0, true); // sense compressió
    local.setUint16(10, hora, true);
    local.setUint16(12, dia, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, dades.length, true);
    local.setUint32(22, dades.length, true);
    local.setUint16(26, nom.length, true);
    local.setUint16(28, 0, true);
    parts.push(local.buffer, nom, dades);

    const registre = new DataView(new ArrayBuffer(46));
    registre.setUint32(0, 0x02014b50, true);
    registre.setUint16(4, 20, true); // versió que l'ha fet
    registre.setUint16(6, 20, true);
    registre.setUint16(8, 0x0800, true);
    registre.setUint16(10, 0, true);
    registre.setUint16(12, hora, true);
    registre.setUint16(14, dia, true);
    registre.setUint32(16, crc, true);
    registre.setUint32(20, dades.length, true);
    registre.setUint32(24, dades.length, true);
    registre.setUint16(28, nom.length, true);
    registre.setUint32(42, desplacament, true);
    central.push(registre.buffer, nom);

    desplacament += 30 + nom.length + dades.length;
  }

  const midaCentral = central.reduce((acc, part) => acc + part.byteLength, 0);
  const final = new DataView(new ArrayBuffer(22));
  final.setUint32(0, 0x06054b50, true);
  final.setUint16(8, fitxers.length, true);
  final.setUint16(10, fitxers.length, true);
  final.setUint32(12, midaCentral, true);
  final.setUint32(16, desplacament, true);

  return new Blob([...parts, ...central, final.buffer], { type: 'application/zip' });
}
