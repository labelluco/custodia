// Exportació a STL binari, el format que accepta qualsevol programa de
// laminat per a impressió 3D (Cura, PrusaSlicer, Bambu Studio...).
// Format: 80 bytes de capçalera, un uint32 amb el nombre de triangles i,
// per cada triangle, 50 bytes (normal + 3 vèrtexs en float32, i un
// uint16 d'atributs a 0). Tot en little-endian.
//
// Les unitats de l'STL no estan definides pel format: per conveni, els
// programes de laminat les interpreten com a mil·límetres -- per això el
// model s'ha d'escalar a mm abans d'arribar aquí.

/**
 * @param {Float32Array} posicions 9 valors per triangle (vegeu trianglesModel)
 * @param {string} [descripcio] Text curt (ASCII) per a la capçalera
 * @returns {ArrayBuffer}
 */
export function exportarStl(posicions, descripcio = 'Model 3D') {
  const nTriangles = posicions.length / 9;
  const buffer = new ArrayBuffer(84 + nTriangles * 50);
  const vista = new DataView(buffer);

  // La capçalera NO pot començar per "solid": alguns programes ho
  // interpretarien com un STL de text.
  const capcalera = `Binary STL - ${descripcio}`.replace(/[^\x20-\x7e]/g, '_').slice(0, 80);
  for (let i = 0; i < capcalera.length; i++) vista.setUint8(i, capcalera.charCodeAt(i));
  vista.setUint32(80, nTriangles, true);

  let desplacament = 84;
  for (let t = 0; t < nTriangles; t++) {
    const p = t * 9;
    const ux = posicions[p + 3] - posicions[p];
    const uy = posicions[p + 4] - posicions[p + 1];
    const uz = posicions[p + 5] - posicions[p + 2];
    const vx = posicions[p + 6] - posicions[p];
    const vy = posicions[p + 7] - posicions[p + 1];
    const vz = posicions[p + 8] - posicions[p + 2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const llargada = Math.hypot(nx, ny, nz) || 1;
    nx /= llargada;
    ny /= llargada;
    nz /= llargada;

    for (const valor of [nx, ny, nz]) {
      vista.setFloat32(desplacament, valor, true);
      desplacament += 4;
    }
    for (let k = 0; k < 9; k++) {
      vista.setFloat32(desplacament, posicions[p + k], true);
      desplacament += 4;
    }
    vista.setUint16(desplacament, 0, true);
    desplacament += 2;
  }
  return buffer;
}
