// Exportació a Wavefront OBJ (text), el format 3D més universal per
// obrir el model en Blender, SketchUp, MeshLab, QGIS 3D... A diferència
// de l'STL, l'OBJ reutilitza els vèrtexs compartits (fitxer molt més
// petit) i admet coordenades de textura, de manera que el programa
// receptor pot aplicar-hi l'ortofoto si se li dona la imatge.
//
// Es manté el conveni de coordenades del model: x = est, y = nord,
// z = amunt, en metres, relatius a un origen local (indicat en un
// comentari al fitxer per poder-lo tornar a situar en UTM).

/**
 * @param {ReturnType<import('../geometria/solid.js').construirModel>} model
 * @param {{origen: [number, number, number], zBase: number, ambLaterals?: boolean, requadreTextura?: {minX: number, minY: number, maxX: number, maxY: number}, aUV?: (x: number, y: number) => [number, number], crs?: string, descripcio?: string}} opcions
 *   origen: [x, y, z] que es resta a cada vèrtex (UTM i altitud);
 *   zBase: alçada de la base en coordenades ja relatives a l'origen;
 *   aUV: coordenada de textura de cada vèrtex, quan la imatge no és en el
 *   sistema del model (té prioritat sobre requadreTextura).
 * @returns {string}
 */
export function exportarObj(model, { origen, zBase, ambLaterals = true, requadreTextura = null, aUV = null, crs = 'EPSG:25830', descripcio = '' }) {
  const [ox, oy, oz] = origen;
  const n = model.vertexs.length / 3;
  const linies = [
    `# ${descripcio}`.trim(),
    '# Coordenades en metres: x = est, y = nord, z = altitud',
    `# Origen local (${crs} + altitud): ${ox.toFixed(2)} ${oy.toFixed(2)} ${oz.toFixed(2)}`,
    'o model',
  ];

  const v = model.vertexs;
  for (let i = 0; i < n; i++) {
    linies.push(`v ${(v[i * 3] - ox).toFixed(3)} ${(v[i * 3 + 1] - oy).toFixed(3)} ${(v[i * 3 + 2] - oz).toFixed(3)}`);
  }
  if (ambLaterals) {
    for (let i = 0; i < n; i++) {
      linies.push(`v ${(v[i * 3] - ox).toFixed(3)} ${(v[i * 3 + 1] - oy).toFixed(3)} ${zBase.toFixed(3)}`);
    }
  }
  const ambTextura = Boolean(aUV || requadreTextura);
  if (aUV) {
    for (let i = 0; i < n; i++) {
      const [u, w] = aUV(v[i * 3], v[i * 3 + 1]);
      linies.push(`vt ${u.toFixed(6)} ${w.toFixed(6)}`);
    }
  } else if (requadreTextura) {
    const { minX, minY, maxX, maxY } = requadreTextura;
    for (let i = 0; i < n; i++) {
      linies.push(`vt ${((v[i * 3] - minX) / (maxX - minX)).toFixed(6)} ${((v[i * 3 + 1] - minY) / (maxY - minY)).toFixed(6)}`);
    }
  }

  // Els índexs de l'OBJ comencen per 1.
  const cara = (a, b, c) =>
    ambTextura
      ? `f ${a + 1}/${a + 1} ${b + 1}/${b + 1} ${c + 1}/${c + 1}`
      : `f ${a + 1} ${b + 1} ${c + 1}`;

  linies.push('g superficie');
  for (let k = 0; k < model.superior.length; k += 3) {
    linies.push(cara(model.superior[k], model.superior[k + 1], model.superior[k + 2]));
  }

  if (ambLaterals) {
    const sota = (i) => i + n + 1;
    linies.push('g laterals');
    for (const anell of model.anells) {
      for (let i = 0; i < anell.length; i++) {
        const a = anell[i];
        const b = anell[(i + 1) % anell.length];
        linies.push(`f ${sota(a)} ${sota(b)} ${b + 1}`, `f ${sota(a)} ${b + 1} ${a + 1}`);
      }
    }
    linies.push('g base');
    for (let k = 0; k < model.inferior.length; k += 3) {
      linies.push(`f ${sota(model.inferior[k])} ${sota(model.inferior[k + 1])} ${sota(model.inferior[k + 2])}`);
    }
  }

  return `${linies.join('\n')}\n`;
}
