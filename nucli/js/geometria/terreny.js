// Model de terreny en graella regular (ràster), amb interpolació
// bilineal. La graella ve del MDT de l'IGN en format ESRI ASCII Grid
// (vegeu ServeiMDT): la primera fila de valors és la del NORD, i
// xllcorner/yllcorner són la cantonada inferior esquerra de la graella
// (no el centre de la primera cel·la). Cada valor representa el centre
// de la seva cel·la.

export class Terreny {
  /**
   * @param {{ncols: number, nrows: number, xll: number, yll: number, cellsize: number, valors: Float32Array}} graella
   */
  constructor({ ncols, nrows, xll, yll, cellsize, valors }) {
    if (valors.length !== ncols * nrows) {
      throw new Error(`Terreny: s'esperaven ${ncols * nrows} valors i n'hi ha ${valors.length}`);
    }
    this.ncols = ncols;
    this.nrows = nrows;
    this.xll = xll;
    this.yll = yll;
    this.cellsize = cellsize;
    this.valors = valors;
    this.yTop = yll + nrows * cellsize;
  }

  /** Requadre cobert per la graella, en les mateixes unitats (metres UTM). */
  get limits() {
    return {
      minX: this.xll,
      minY: this.yll,
      maxX: this.xll + this.ncols * this.cellsize,
      maxY: this.yTop,
    };
  }

  _valor(fila, columna) {
    const f = Math.max(0, Math.min(this.nrows - 1, fila));
    const c = Math.max(0, Math.min(this.ncols - 1, columna));
    return this.valors[f * this.ncols + c];
  }

  /**
   * Altitud interpolada (bilineal) en un punt qualsevol. Fora de la
   * graella es fa servir el valor de la vora més propera (no s'inventa
   * res: el model sempre es demana amb marge, vegeu ServeiMDT).
   */
  altitud(x, y) {
    // Posició contínua en "unitats de cel·la" respecte als centres:
    // el centre de la cel·la (fila 0, columna 0) és a (0, 0).
    const fc = (x - this.xll) / this.cellsize - 0.5;
    const ff = (this.yTop - y) / this.cellsize - 0.5;
    const c0 = Math.floor(fc);
    const f0 = Math.floor(ff);
    const tx = fc - c0;
    const ty = ff - f0;

    const a = this._valor(f0, c0);
    const b = this._valor(f0, c0 + 1);
    const c = this._valor(f0 + 1, c0);
    const d = this._valor(f0 + 1, c0 + 1);
    return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
  }
}
