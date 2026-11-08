// Visor 3D d'un model de terreny (vegeu geometria/solid.js), fet amb
// Three.js r128 (carregat per CDN, igual que a Custòdia: cal THREE i
// THREE.OrbitControls globals abans d'importar aquest mòdul).
//
// Ve de Custòdia (js/ui/mapa3d.js) i en manté les decisions:
//  - sistema de mà dreta X = est, Y = amunt, Z = -nord. Aquí el model
//    es construeix en coordenades del model (x = est, y = nord, z =
//    amunt) i es gira -90° sobre l'eix X: (x, y, z) -> (x, z, -y). És
//    una rotació (determinant +1), no un mirall: l'orientació dels
//    triangles (cap enfora) es conserva.
//  - llum real de Three.js (computeVertexNormals), sol del nord-oest a
//    45° d'alçada, com a la resta de l'app;
//  - exageració vertical 1 per defecte (fidelitat geomètrica).
//
// Novetats: superfície i laterals en malles separades (la superfície
// indexada, amb normals suaus; les parets amb normals planes), i quatre
// capes: ortofoto PNOA com a textura, color per altitud, color per
// pendent o neutre. Opcionalment, les cotes màxima i mínima (tija i etiqueta)
// i punts marcats per l'app (mostrarPunts: un punt d'observació, una antena...)
// i línies que segueixen el relleu (mostrarLinies: un track, una ruta).
//
// Per a apps que mouen el sol (Terra Sol): establirSol() posa la llum
// principal en la direcció del sol d'un instant, amb un disc que el
// representa, i la textura pot ser un canvas que l'app repinta i refresca
// (refrescarTextura) sense tornar a carregar res.
import { t, idiomaActual } from '../i18n/i18n.js';
import { colorAltitud, colorPendent } from '../serveis/escalaColor.js';
import { trianglesModel } from '../geometria/solid.js';

const COLOR_NEUTRE = '#b8ad95';
const COLOR_LATERALS = '#d9cfba';

/**
 * El costat més gran (px) d'una textura que pot fer servir aquest
 * dispositiu, sense passar de `limit`. Per demanar l'ortofoto tan gran com
 * es pugui pintar (vegeu generadorModel.js): una imatge més gran que el
 * límit de la targeta gràfica es reduiria igualment en carregar-la. Es
 * mira amb un context WebGL temporal, que s'allibera de seguida; sense
 * WebGL, 2048 (el que es feia servir abans).
 * @param {number} [limit] 4096 per defecte: el màxim que serveix la PNOA, i
 *   una textura de 8192² ja ocupa uns 256 MB de memòria gràfica.
 */
export function midaMaximaTextura(limit = 4096) {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return Math.min(2048, limit);
    const mida = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return Math.min(limit, Number.isFinite(mida) ? mida : 2048);
  } catch {
    return Math.min(2048, limit);
  }
}

export class Visor3D {
  constructor(contenidor) {
    this.contenidor = contenidor;
    this._model = null;
    this._opcions = null;
    this._textura = null;
    this._capa = 'neutre';
    this._grup = null;
    this._idAnimacio = null;
    this._marges = () => ({ esquerra: 0, dreta: 0, inferior: 0 });
    this._ambCotes = false;
    this._grupCotes = null;
    this._etiquetesCotes = [];
    this._punts = [];
    this._grupPunts = null;
    this._etiquetesPunts = [];
    this._linies = [];
    this._grupLinies = null;
    this._sol = null;
  }

  /**
   * Espai (px) tapat per panells de l'app a l'esquerra, a la dreta i a
   * sota. La càmera desplaça el seu centre òptic (setViewOffset) perquè
   * el model quedi centrat a la part visible, sense deformar-lo.
   * @param {() => {esquerra?: number, dreta?: number, inferior?: number}} funcio
   */
  establirMarges(funcio) {
    this._marges = funcio;
    this._redimensionar();
  }

  /**
   * @param {ReturnType<import('../geometria/solid.js').construirModel>} model
   * @param {{exageracio?: number, gruixBaseMetres?: number, ambLaterals?: boolean, textura?: {url?: string, canvas?: HTMLCanvasElement, requadre: object}|null, capa?: 'ortofoto'|'altitud'|'neutre', direccioCamera?: number[]}} opcions
   *   direccioCamera: d'on mira la càmera al principi, [x, y, z] de l'escena
   *   (x = est, y = amunt, z = sud); per defecte, des del sud-est.
   */
  mostrar(model, opcions = {}) {
    this.destruir();
    this._model = model;
    this._opcions = { exageracio: 1, gruixBaseMetres: 5, ambLaterals: true, textura: null, ...opcions };
    this._capa = opcions.capa ?? (opcions.textura ? 'ortofoto' : 'neutre');

    this._escena = new THREE.Scene();
    this._llumCel = new THREE.HemisphereLight(0xffffff, 0xb3a98f, 0.6);
    this._escena.add(this._llumCel);
    this._llumSol = new THREE.DirectionalLight(0xffffff, 0.85);
    this._llumSol.position.set(-0.5, 0.707, -0.5);
    this._escena.add(this._llumSol);
    // Llum de farciment suau des del sud-est: sense ella, les parets que
    // no veuen el sol (les que es veuen des de la càmera inicial) queden
    // gairebé negres. No altera l'ombrejat del relleu, que domina el sol.
    this._llumFarciment = new THREE.DirectionalLight(0xffffff, 0.25);
    this._llumFarciment.position.set(0.6, 0.3, 0.7);
    this._escena.add(this._llumFarciment);

    const { clientWidth: amplada, clientHeight: alcada } = this.contenidor;
    this._camera = new THREE.PerspectiveCamera(40, amplada / Math.max(alcada, 1), 0.5, 200000);
    this._renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this._renderer.setClearColor(0x000000, 0);
    // Fins a 3 píxels per punt de pantalla: els mòbils en tenen 3 o més, i
    // amb el límit de 2 d'abans l'escena es pintava a dos terços de la
    // resolució i s'estirava (es veia tova a Android).
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3));
    this._renderer.outputEncoding = THREE.sRGBEncoding;
    this._renderer.setSize(amplada, alcada);
    this._aplicarMarges(amplada, alcada);
    this.contenidor.appendChild(this._renderer.domElement);

    this._controls = new THREE.OrbitControls(this._camera, this._renderer.domElement);
    this._controls.enableDamping = true;
    this._controls.dampingFactor = 0.08;
    // No deixar passar la càmera per sota del terra: el model no té
    // res d'interessant a sota i desorienta.
    this._controls.maxPolarAngle = Math.PI * 0.49;

    this._construirMalles();
    this._ajustarCamera();
    this._carregarTextura();
    this._afegirBruixola();
    this._aplicarSol();

    this._observador = new ResizeObserver(() => this._redimensionar());
    this._observador.observe(this.contenidor);
    this._animar();
  }

  /** Canvia exageració, gruix de base o laterals, sense moure la càmera. */
  actualitzar(opcions) {
    if (!this._model) return;
    Object.assign(this._opcions, opcions);
    this._construirMalles();
    this._aplicarSol();
  }

  /** 'ortofoto' | 'altitud' | 'pendent' | 'neutre' */
  aplicarCapa(capa) {
    this._capa = capa;
    if (!this._superficie) return;
    const material = this._superficie.material;
    const geometria = this._superficie.geometry;
    material.map = capa === 'ortofoto' ? this._textura : null;
    material.vertexColors = capa === 'altitud' || capa === 'pendent';
    if (material.vertexColors) {
      geometria.setAttribute('color', geometria.userData[capa === 'pendent' ? 'colorsPendent' : 'colorsAltitud']);
    }
    material.color.set(capa === 'neutre' ? COLOR_NEUTRE : '#ffffff');
    material.needsUpdate = true;
  }

  /** Mostra o amaga les cotes màxima i mínima (tija i etiqueta amb l'altitud). */
  mostrarCotes(mostrar) {
    this._ambCotes = mostrar;
    this._construirCotes();
  }

  /**
   * Punts marcats sobre el relleu: una tija vertical amb una esfera al cap
   * i una etiqueta HTML (classes .cota-3d i .cota-3d--punt de nucli.css).
   * La tija fa l'alçada real del punt sobre el terreny (amb l'exageració),
   * però com a mínim un 4 % de la mida del model: un pal de 10 m en un model
   * de 4 km no es veuria. Per això l'etiqueta diu l'alçada real.
   * @param {Array<{x: number, y: number, z: number, alcada?: number, etiqueta: string}>} punts
   *   x, y en el sistema del model; z, altitud del terreny; alcada, metres sobre el terreny.
   */
  mostrarPunts(punts) {
    this._punts = punts ?? [];
    this._construirPunts();
  }

  /**
   * Línies sobre el relleu (un track GPS, una ruta): un tub de color que
   * passa pels punts donats. El tub té un gruix proporcional a la mida del
   * model (un 0,25 %: uns 10 m en un model de 4 km), perquè una línia de
   * WebGL fa sempre 1 píxel i no es veuria; per la mateixa raó el centre
   * s'aixeca un radi sobre el terreny, o quedaria mig enterrat. Les
   * altituds han de ser les del terreny (no les del GPS, que el farien
   * surar o enfonsar-se), i s'hi aplica l'exageració del model.
   * @param {Array<{punts: Array<{x: number, y: number, z: number}>, color?: string}>} linies
   *   x, y en el sistema del model; z, altitud del terreny en aquell punt.
   */
  mostrarLinies(linies) {
    this._linies = linies ?? [];
    this._construirLinies();
  }

  /**
   * Il·luminació amb el sol d'un instant: la llum principal ve d'on és el
   * sol, i un disc groc el marca al cel. Amb el sol sota l'horitzó només
   * queda la llum tènue del cel. null torna a la llum fixa del nord-oest.
   * L'ombra que fa el relleu (un turó que tapa el sol) no la calcula el
   * visor: l'app la pot pintar a la textura.
   * @param {{azimut: number, alcada: number}|null} sol graus (azimut des del nord, en sentit horari)
   */
  establirSol(sol) {
    this._sol = sol;
    this._aplicarSol();
  }

  /** Torna a pujar a la targeta gràfica una textura de canvas que l'app ha repintat. */
  refrescarTextura() {
    if (this._textura) this._textura.needsUpdate = true;
  }

  _aplicarSol() {
    if (!this._llumSol) return;
    const sol = this._sol;
    if (!sol) {
      this._llumSol.position.set(-0.5, 0.707, -0.5);
      this._llumSol.intensity = 0.85;
      this._llumCel.intensity = 0.6;
      this._llumFarciment.intensity = 0.25;
      if (this._disc) this._disc.visible = false;
      if (this._raig) this._raig.visible = false;
      return;
    }
    const az = (sol.azimut * Math.PI) / 180;
    const alcada = (sol.alcada * Math.PI) / 180;
    // (est, nord, amunt) del model -> (x, y, z) de l'escena = (est, amunt, -nord).
    const direccio = new THREE.Vector3(Math.sin(az) * Math.cos(alcada), Math.sin(alcada), -Math.cos(az) * Math.cos(alcada));
    this._llumSol.position.copy(direccio);
    const dia = sol.alcada > 0;
    // Prop de l'horitzó, la llum del sol és més feble (més atmosfera).
    this._llumSol.intensity = dia ? 0.55 + 0.5 * Math.min(1, Math.sin(alcada) * 3) : 0;
    this._llumCel.intensity = dia ? 0.5 : 0.22;
    this._llumFarciment.intensity = 0;
    if (!this._disc && this._model) {
      const { limits } = this._model;
      const mida = Math.max(limits.maxX - limits.minX, limits.maxY - limits.minY);
      this._disc = new THREE.Mesh(new THREE.SphereGeometry(mida * 0.035, 24, 16), new THREE.MeshBasicMaterial({ color: '#ffd75e' }));
      this._disc.userData.distancia = mida * 0.75;
      // Una línia del mig del model fins al disc: d'on ve la llum, encara
      // que el disc quedi davant o darrere del model.
      this._raig = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
        new THREE.LineBasicMaterial({ color: '#d9a63a', transparent: true, opacity: 0.85 })
      );
      this._escena.add(this._disc, this._raig);
    }
    if (this._disc) {
      // El mig del model, a mitja alçada del relleu (amb l'exageració).
      const centre = new THREE.Vector3(0, ((this._model.altitudMaxima - this._model.altitudMinima) * this._opcions.exageracio) / 2, 0);
      this._disc.position.copy(centre).addScaledVector(direccio, this._disc.userData.distancia);
      this._disc.visible = sol.alcada > -1;
      this._raig.geometry.setFromPoints([centre, this._disc.position]);
      this._raig.visible = this._disc.visible;
    }
  }

  /** Torna a la vista inicial. */
  reiniciarVista() {
    if (this._model) this._ajustarCamera();
  }

  // Transformació comuna: centrat al mig del requadre i amb l'altitud
  // mínima a 0, perquè els nombres siguin petits (Float32 perd precisió
  // amb coordenades UTM de 7 xifres).
  _transformar() {
    const { limits, altitudMinima } = this._model;
    const cx = (limits.minX + limits.maxX) / 2;
    const cy = (limits.minY + limits.maxY) / 2;
    const exageracio = this._opcions.exageracio;
    return (x, y, z) => [x - cx, y - cy, (z - altitudMinima) * exageracio];
  }

  _construirMalles() {
    if (this._grup) {
      this._escena.remove(this._grup);
      this._grup.traverse((o) => {
        o.geometry?.dispose();
        o.material?.dispose();
      });
    }
    this._grup = new THREE.Group();
    // (x, y, z) del model -> (x, z, -y) de Three.js; vegeu la capçalera.
    this._grup.rotation.x = -Math.PI / 2;

    const model = this._model;
    const transformar = this._transformar();
    const n = model.vertexs.length / 3;

    // Superfície: indexada, perquè els vèrtexs compartits donin normals
    // suaus (sense facetes visibles).
    const posicions = new Float32Array(n * 3);
    const uvs = new Float32Array(n * 2);
    const colors = new Float32Array(n * 3);
    const colorsPendent = new Float32Array(n * 3);
    const pendents = pendentsPerVertex(model);
    const requadreTextura = this._opcions.textura?.requadre;
    const aUV = this._opcions.textura?.aUV;
    const color = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const x = model.vertexs[i * 3];
      const y = model.vertexs[i * 3 + 1];
      const z = model.vertexs[i * 3 + 2];
      posicions.set(transformar(x, y, z), i * 3);
      if (aUV) {
        // Imatges que no són en el sistema del model (Sentinel-2, en
        // lat/lng): la font dona la coordenada de textura de cada vèrtex.
        const [u, v] = aUV(x, y);
        uvs[i * 2] = u;
        uvs[i * 2 + 1] = v;
      } else if (requadreTextura) {
        uvs[i * 2] = (x - requadreTextura.minX) / (requadreTextura.maxX - requadreTextura.minX);
        uvs[i * 2 + 1] = (y - requadreTextura.minY) / (requadreTextura.maxY - requadreTextura.minY);
      }
      color.set(colorAltitud(z, model.altitudMinima, model.altitudMaxima).fillColor);
      colors.set([color.r, color.g, color.b], i * 3);
      color.set(colorPendent(pendents[i]).fillColor);
      colorsPendent.set([color.r, color.g, color.b], i * 3);
    }
    const geometriaSuperficie = new THREE.BufferGeometry();
    geometriaSuperficie.setAttribute('position', new THREE.BufferAttribute(posicions, 3));
    geometriaSuperficie.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometriaSuperficie.userData.colorsAltitud = new THREE.BufferAttribute(colors, 3);
    geometriaSuperficie.userData.colorsPendent = new THREE.BufferAttribute(colorsPendent, 3);
    geometriaSuperficie.setAttribute('color', geometriaSuperficie.userData.colorsAltitud);
    geometriaSuperficie.setIndex(new THREE.BufferAttribute(model.superior, 1));
    geometriaSuperficie.computeVertexNormals();

    this._superficie = new THREE.Mesh(
      geometriaSuperficie,
      new THREE.MeshStandardMaterial({
        roughness: 0.95,
        metalness: 0,
        // Sense laterals, la superfície és una làmina i s'ha de veure
        // també per sota; amb laterals és un sòlid tancat.
        side: this._opcions.ambLaterals ? THREE.FrontSide : THREE.DoubleSide,
      })
    );
    this._grup.add(this._superficie);

    if (this._opcions.ambLaterals) {
      const { posicions: totes, nSuperficie } = trianglesModel(model, {
        transformar,
        zBase: -this._opcions.gruixBaseMetres,
      });
      const geometriaLaterals = new THREE.BufferGeometry();
      geometriaLaterals.setAttribute('position', new THREE.BufferAttribute(totes.slice(nSuperficie * 9), 3));
      geometriaLaterals.computeVertexNormals();
      this._grup.add(
        new THREE.Mesh(geometriaLaterals, new THREE.MeshStandardMaterial({ color: COLOR_LATERALS, roughness: 1 }))
      );
    }

    this._escena.add(this._grup);
    this.aplicarCapa(this._capa);
    this._construirCotes();
    this._construirPunts();
    this._construirLinies();
  }

  /**
   * Cotes als vèrtexs d'altitud màxima i mínima: una tija fina a l'escena i,
   * a dalt, una etiqueta HTML amb l'altitud ("▲ 727 m" / "▼ 710 m"), amb
   * l'estil de la resta de la interfície (classes .cota-3d de nucli.css).
   * L'etiqueta no és un objecte 3D: es recol·loca a cada fotograma
   * projectant el cap de la tija a la pantalla (_posicionarCotes), i així
   * sempre mira la càmera i el text es llegeix nítid a qualsevol zoom.
   * Coordenades de l'escena: (x, y, z) del model -> (x, z, -y), com el grup.
   * Mida proporcional al model; es refan si canvia l'exageració.
   */
  _construirCotes() {
    if (this._grupCotes) {
      this._escena?.remove(this._grupCotes);
      this._grupCotes.traverse((o) => {
        o.geometry?.dispose();
        o.material?.dispose();
      });
      this._grupCotes = null;
    }
    for (const { element } of this._etiquetesCotes ?? []) element.remove();
    this._etiquetesCotes = [];
    if (!this._ambCotes || !this._model || !this._escena) return;

    const { vertexs, limits } = this._model;
    let iMax = 0;
    let iMin = 0;
    for (let i = 0; i < vertexs.length / 3; i++) {
      if (vertexs[i * 3 + 2] > vertexs[iMax * 3 + 2]) iMax = i;
      if (vertexs[i * 3 + 2] < vertexs[iMin * 3 + 2]) iMin = i;
    }

    const mida = Math.max(limits.maxX - limits.minX, limits.maxY - limits.minY);
    const alcada = mida * 0.08;
    const transformar = this._transformar();
    this._grupCotes = new THREE.Group();
    const materialTija = new THREE.MeshBasicMaterial({ color: '#23261f', transparent: true, opacity: 0.7 });

    const afegir = (i, tipus) => {
      const [x, y, z] = transformar(vertexs[i * 3], vertexs[i * 3 + 1], vertexs[i * 3 + 2]);
      const tija = new THREE.Mesh(new THREE.CylinderGeometry(mida * 0.0015, mida * 0.0015, alcada, 6), materialTija);
      tija.position.set(x, z + alcada / 2, -y);
      this._grupCotes.add(tija);

      // L'altitud real (sense exageració), que és la que surt al model.
      const altitud = Math.round(vertexs[i * 3 + 2]).toLocaleString(idiomaActual());
      const element = document.createElement('div');
      element.className = `cota-3d cota-3d--${tipus}`;
      element.setAttribute('aria-hidden', 'true');
      element.innerHTML = `<span class="cota-3d__icona">${tipus === 'maxima' ? '▲' : '▼'}</span>${altitud} m`;
      this.contenidor.appendChild(element);
      this._etiquetesCotes.push({ element, punt: new THREE.Vector3(x, z + alcada, -y) });
    };
    afegir(iMax, 'maxima');
    if (iMin !== iMax) afegir(iMin, 'minima');
    this._escena.add(this._grupCotes);
    this._posicionarCotes();
  }

  _construirPunts() {
    if (this._grupPunts) {
      this._escena?.remove(this._grupPunts);
      this._grupPunts.traverse((o) => {
        o.geometry?.dispose();
        o.material?.dispose();
      });
      this._grupPunts = null;
    }
    for (const { element } of this._etiquetesPunts ?? []) element.remove();
    this._etiquetesPunts = [];
    if (!this._punts?.length || !this._model || !this._escena) return;

    const { limits } = this._model;
    const mida = Math.max(limits.maxX - limits.minX, limits.maxY - limits.minY);
    const transformar = this._transformar();
    const exageracio = this._opcions.exageracio;
    this._grupPunts = new THREE.Group();
    const materialTija = new THREE.MeshBasicMaterial({ color: '#23261f', transparent: true, opacity: 0.8 });
    const materialCap = new THREE.MeshStandardMaterial({ color: '#f2c14e', roughness: 0.6, emissive: '#5a4310' });
    for (const { x: px, y: py, z: pz, alcada: alcadaReal = 0, etiqueta } of this._punts) {
      const [x, y, z] = transformar(px, py, pz);
      const alcada = Math.max(alcadaReal * exageracio, mida * 0.04);
      const tija = new THREE.Mesh(new THREE.CylinderGeometry(mida * 0.002, mida * 0.002, alcada, 8), materialTija);
      tija.position.set(x, z + alcada / 2, -y);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(mida * 0.007, 16, 12), materialCap);
      cap.position.set(x, z + alcada, -y);
      this._grupPunts.add(tija, cap);

      const element = document.createElement('div');
      element.className = 'cota-3d cota-3d--punt';
      element.setAttribute('aria-hidden', 'true');
      element.innerHTML = '<span class="cota-3d__icona">●</span>';
      element.append(etiqueta);
      this.contenidor.appendChild(element);
      this._etiquetesPunts.push({ element, punt: new THREE.Vector3(x, z + alcada + mida * 0.01, -y) });
    }
    this._escena.add(this._grupPunts);
    this._posicionarCotes();
  }

  _construirLinies() {
    if (this._grupLinies) {
      this._escena?.remove(this._grupLinies);
      this._grupLinies.traverse((o) => {
        o.geometry?.dispose();
        o.material?.dispose();
      });
      this._grupLinies = null;
    }
    if (!this._linies?.length || !this._model || !this._escena) return;

    const { limits } = this._model;
    const mida = Math.max(limits.maxX - limits.minX, limits.maxY - limits.minY);
    const radi = mida * 0.0025;
    const transformar = this._transformar();
    this._grupLinies = new THREE.Group();
    for (const { punts, color = '#e8452c' } of this._linies) {
      // Punts de l'escena (x, z, -y), sense repetits: un segment de
      // longitud zero fa que el tub perdi l'orientació.
      const vectors = [];
      for (const { x: px, y: py, z: pz } of punts) {
        const [x, y, z] = transformar(px, py, pz);
        const v = new THREE.Vector3(x, z + radi, -y);
        if (!vectors.length || vectors[vectors.length - 1].distanceToSquared(v) > 1e-6) vectors.push(v);
      }
      if (vectors.length < 2) continue;
      const cami = new THREE.CurvePath();
      for (let i = 1; i < vectors.length; i++) cami.add(new THREE.LineCurve3(vectors[i - 1], vectors[i]));
      const segments = Math.min(6000, vectors.length * 2);
      const tub = new THREE.Mesh(
        new THREE.TubeGeometry(cami, segments, radi, 6, false),
        new THREE.MeshStandardMaterial({ color, roughness: 0.5, emissive: color, emissiveIntensity: 0.35 })
      );
      this._grupLinies.add(tub);
    }
    this._escena.add(this._grupLinies);
  }

  /** Situa cada etiqueta (cotes i punts) sobre el cap de la seva tija, a la pantalla. */
  _posicionarCotes() {
    const etiquetes = [...(this._etiquetesCotes ?? []), ...(this._etiquetesPunts ?? [])];
    if (!etiquetes.length || !this._camera) return;
    const { clientWidth: amplada, clientHeight: alcada } = this.contenidor;
    const punt = new THREE.Vector3();
    for (const { element, punt: origen } of etiquetes) {
      // Amb setViewOffset, la projecció de la càmera ja és la del canvas
      // visible: les coordenades normalitzades van de -1 a 1 sobre el canvas.
      punt.copy(origen).project(this._camera);
      const visible = punt.z < 1;
      element.hidden = !visible;
      if (!visible) continue;
      element.style.transform =
        `translate(${((punt.x + 1) / 2) * amplada}px, ${((1 - punt.y) / 2) * alcada}px) translate(-50%, -100%)`;
    }
  }

  _carregarTextura() {
    const textura = this._opcions.textura;
    if (!textura) return;
    if (textura.canvas) {
      // Un canvas de l'app: es fa servir tal qual i es refresca amb refrescarTextura().
      this._textura = new THREE.CanvasTexture(textura.canvas);
      this._textura.encoding = THREE.sRGBEncoding;
      this._textura.anisotropy = this._renderer.capabilities.getMaxAnisotropy();
      this.aplicarCapa(this._capa);
      return;
    }
    new THREE.TextureLoader().setCrossOrigin('anonymous').load(
      textura.url,
      (carregada) => {
        if (!this._renderer) {
          carregada.dispose();
          return;
        }
        carregada.encoding = THREE.sRGBEncoding;
        carregada.anisotropy = this._renderer.capabilities.getMaxAnisotropy();
        this._textura = carregada;
        this.aplicarCapa(this._capa);
        this.contenidor.dispatchEvent(new CustomEvent('textura-carregada'));
      },
      undefined,
      () => {
        this.contenidor.dispatchEvent(new CustomEvent('error-textura'));
      }
    );
  }

  _ajustarCamera() {
    // Distància perquè l'esfera que envolta el model càpiga a la part
    // lliure del visor (descomptant els panells; vegeu establirMarges).
    const esfera = new THREE.Box3().setFromObject(this._grup).getBoundingSphere(new THREE.Sphere());
    const { clientWidth: amplada, clientHeight: alcada } = this.contenidor;
    const { esquerra = 0, dreta = 0, inferior = 0 } = this._marges();
    const tanVertical = Math.tan((this._camera.fov * Math.PI) / 360);
    const tanLliureVertical = (tanVertical * Math.max(alcada - inferior, 1)) / (alcada + inferior);
    const tanLliureHoritzontal = (tanVertical * Math.max(amplada - dreta - esquerra, 1)) / (alcada + inferior);
    const distancia = (esfera.radius / Math.min(tanLliureVertical, tanLliureHoritzontal)) * 1.05;

    // Des del sud-est i una mica elevat: el sol ve del nord-oest, i així
    // el relleu es veu amb la llum "de cara", com en un mapa ombrejat.
    const direccio = new THREE.Vector3(...(this._opcions.direccioCamera ?? [0.45, 0.6, 0.75])).normalize();
    this._controls.target.copy(esfera.center);
    this._camera.position.copy(esfera.center).addScaledVector(direccio, distancia);
    this._camera.near = distancia / 100;
    this._camera.far = distancia * 20;
    this._camera.updateProjectionMatrix();
    this._controls.update();
  }

  _afegirBruixola() {
    this._bruixola = document.createElement('div');
    this._bruixola.className = 'bruixola-3d';
    this._bruixola.setAttribute('aria-label', t('Nord'));
    this._bruixola.innerHTML = '<span class="bruixola-3d__fletxa">▲</span><span class="bruixola-3d__lletra">N</span>';
    this.contenidor.appendChild(this._bruixola);
  }

  _actualitzarBruixola() {
    // Angle de la càmera al voltant de l'eix vertical: 0 quan mira cap
    // al nord (-Z) des del sud. La brúixola gira al revés que la càmera.
    const angle = Math.atan2(
      this._camera.position.x - this._controls.target.x,
      this._camera.position.z - this._controls.target.z
    );
    this._bruixola.style.transform = `rotate(${(angle * 180) / Math.PI}deg)`;
  }

  _redimensionar() {
    if (!this._renderer) return;
    const { clientWidth: amplada, clientHeight: alcada } = this.contenidor;
    if (amplada === 0 || alcada === 0) return;
    this._aplicarMarges(amplada, alcada);
    this._renderer.setSize(amplada, alcada);
  }

  _aplicarMarges(amplada, alcada) {
    const { esquerra = 0, dreta = 0, inferior = 0 } = this._marges();
    // L'aspecte ha de ser el de la vista virtual sencera: si fos el de la
    // part visible, el model sortiria estirat.
    const ampladaVirtual = amplada + esquerra + dreta;
    this._camera.aspect = ampladaVirtual / (alcada + inferior);
    if (esquerra === 0 && dreta === 0 && inferior === 0) {
      this._camera.clearViewOffset();
    } else {
      // Vista virtual més gran, de la qual se'n mostra una finestra: el
      // centre virtual ha de caure al mig de l'espai lliure. En x, el
      // centre lliure és (amplada + esquerra - dreta) / 2 i el virtual,
      // ampladaVirtual / 2 - offsetX: per tant offsetX = dreta. En y,
      // amb el panell a sota, offsetY = inferior.
      this._camera.setViewOffset(ampladaVirtual, alcada + inferior, dreta, inferior, amplada, alcada);
    }
    this._camera.updateProjectionMatrix();
  }

  _animar() {
    this._idAnimacio = requestAnimationFrame(() => this._animar());
    this._controls.update();
    this._actualitzarBruixola();
    this._renderer.render(this._escena, this._camera);
    this._posicionarCotes();
  }

  destruir() {
    if (this._idAnimacio != null) cancelAnimationFrame(this._idAnimacio);
    this._idAnimacio = null;
    this._observador?.disconnect();
    this._grup?.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
    this._textura?.dispose();
    this._controls?.dispose();
    this._renderer?.dispose();
    this._renderer?.domElement.remove();
    this._bruixola?.remove();
    this._grupCotes?.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
    this._grupCotes = null;
    for (const { element } of this._etiquetesCotes ?? []) element.remove();
    this._etiquetesCotes = [];
    this._grupPunts?.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
    this._grupPunts = null;
    for (const { element } of this._etiquetesPunts ?? []) element.remove();
    this._etiquetesPunts = [];
    this._punts = [];
    this._grupLinies?.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
    this._grupLinies = null;
    this._linies = [];
    for (const objecte of [this._disc, this._raig]) {
      objecte?.geometry.dispose();
      objecte?.material.dispose();
    }
    this._disc = null;
    this._raig = null;
    this._llumSol = null;
    this._llumCel = null;
    this._llumFarciment = null;
    this._grup = null;
    this._superficie = null;
    this._textura = null;
    this._renderer = null;
    this._controls = null;
    this._escena = null;
    this._model = null;
  }
}

/**
 * Pendent (%) de cada vèrtex de la superfície, amb l'exageració real (1):
 * mitjana de les normals dels triangles que el toquen, ponderada per
 * l'àrea (el producte vectorial ja hi és proporcional). Pendent =
 * component horitzontal / vertical de la normal.
 */
function pendentsPerVertex(model) {
  const { vertexs, superior } = model;
  const n = vertexs.length / 3;
  const normals = new Float64Array(n * 3);
  for (let k = 0; k < superior.length; k += 3) {
    const [a, b, c] = [superior[k], superior[k + 1], superior[k + 2]];
    const ux = vertexs[b * 3] - vertexs[a * 3];
    const uy = vertexs[b * 3 + 1] - vertexs[a * 3 + 1];
    const uz = vertexs[b * 3 + 2] - vertexs[a * 3 + 2];
    const vx = vertexs[c * 3] - vertexs[a * 3];
    const vy = vertexs[c * 3 + 1] - vertexs[a * 3 + 1];
    const vz = vertexs[c * 3 + 2] - vertexs[a * 3 + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    for (const i of [a, b, c]) {
      normals[i * 3] += nx;
      normals[i * 3 + 1] += ny;
      normals[i * 3 + 2] += nz;
    }
  }
  const pendents = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const nz = Math.abs(normals[i * 3 + 2]);
    const horitzontal = Math.hypot(normals[i * 3], normals[i * 3 + 1]);
    pendents[i] = nz > 0 ? (horitzontal / nz) * 100 : 0;
  }
  return pendents;
}
