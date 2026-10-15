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
// pendent o neutre. Opcionalment, agulles a les cotes màxima i mínima.
import { t } from '../i18n/i18n.js';
import { colorAltitud, colorPendent } from '../serveis/escalaColor.js';
import { trianglesModel } from '../geometria/solid.js';

const COLOR_NEUTRE = '#b8ad95';
const COLOR_LATERALS = '#d9cfba';

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
   * @param {{exageracio?: number, gruixBaseMetres?: number, ambLaterals?: boolean, textura?: {url: string, requadre: object}|null, capa?: 'ortofoto'|'altitud'|'neutre'}} opcions
   */
  mostrar(model, opcions = {}) {
    this.destruir();
    this._model = model;
    this._opcions = { exageracio: 1, gruixBaseMetres: 5, ambLaterals: true, textura: null, ...opcions };
    this._capa = opcions.capa ?? (opcions.textura ? 'ortofoto' : 'neutre');

    this._escena = new THREE.Scene();
    this._escena.add(new THREE.HemisphereLight(0xffffff, 0xb3a98f, 0.6));
    const sol = new THREE.DirectionalLight(0xffffff, 0.85);
    sol.position.set(-0.5, 0.707, -0.5);
    this._escena.add(sol);
    // Llum de farciment suau des del sud-est: sense ella, les parets que
    // no veuen el sol (les que es veuen des de la càmera inicial) queden
    // gairebé negres. No altera l'ombrejat del relleu, que domina el sol.
    const farciment = new THREE.DirectionalLight(0xffffff, 0.25);
    farciment.position.set(0.6, 0.3, 0.7);
    this._escena.add(farciment);

    const { clientWidth: amplada, clientHeight: alcada } = this.contenidor;
    this._camera = new THREE.PerspectiveCamera(40, amplada / Math.max(alcada, 1), 0.5, 200000);
    this._renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this._renderer.setClearColor(0x000000, 0);
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
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

    this._observador = new ResizeObserver(() => this._redimensionar());
    this._observador.observe(this.contenidor);
    this._animar();
  }

  /** Canvia exageració, gruix de base o laterals, sense moure la càmera. */
  actualitzar(opcions) {
    if (!this._model) return;
    Object.assign(this._opcions, opcions);
    this._construirMalles();
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

  /** Mostra o amaga les agulles de les cotes màxima (roja) i mínima (blava). */
  mostrarCotes(mostrar) {
    this._ambCotes = mostrar;
    this._construirCotes();
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
    const color = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const x = model.vertexs[i * 3];
      const y = model.vertexs[i * 3 + 1];
      const z = model.vertexs[i * 3 + 2];
      posicions.set(transformar(x, y, z), i * 3);
      if (requadreTextura) {
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
  }

  /**
   * Agulles (tija + cap) als vèrtexs d'altitud màxima i mínima, en
   * coordenades de l'escena: (x, y, z) del model -> (x, z, -y), com fa el
   * grup. Mida proporcional al model; es refan si canvia l'exageració.
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
    if (!this._ambCotes || !this._model || !this._escena) return;

    const { vertexs, limits } = this._model;
    let iMax = 0;
    let iMin = 0;
    for (let i = 0; i < vertexs.length / 3; i++) {
      if (vertexs[i * 3 + 2] > vertexs[iMax * 3 + 2]) iMax = i;
      if (vertexs[i * 3 + 2] < vertexs[iMin * 3 + 2]) iMin = i;
    }

    const mida = Math.max(limits.maxX - limits.minX, limits.maxY - limits.minY);
    const alcada = mida * 0.12;
    const radiCap = mida * 0.025;
    const transformar = this._transformar();
    this._grupCotes = new THREE.Group();

    const afegir = (i, colorCap) => {
      const [x, y, z] = transformar(vertexs[i * 3], vertexs[i * 3 + 1], vertexs[i * 3 + 2]);
      const agulla = new THREE.Group();
      const tija = new THREE.Mesh(
        new THREE.CylinderGeometry(radiCap * 0.12, radiCap * 0.12, alcada, 8),
        new THREE.MeshStandardMaterial({ color: '#3a3a3a', roughness: 0.5 })
      );
      tija.position.y = alcada / 2;
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(radiCap, 16, 16),
        new THREE.MeshStandardMaterial({ color: colorCap, roughness: 0.5 })
      );
      cap.position.y = alcada;
      agulla.add(tija, cap);
      agulla.position.set(x, z, -y);
      this._grupCotes.add(agulla);
    };
    afegir(iMax, '#c0392b');
    if (iMin !== iMax) afegir(iMin, '#2c5aa0');
    this._escena.add(this._grupCotes);
  }

  _carregarTextura() {
    const textura = this._opcions.textura;
    if (!textura) return;
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
    const direccio = new THREE.Vector3(0.45, 0.6, 0.75).normalize();
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
