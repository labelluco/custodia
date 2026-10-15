// Vista 3D del relleu d'una parcel·la, agrupació o geometria, feta amb
// Three.js (carregat per CDN, igual que Leaflet -- cap canvi en com
// muntem el projecte). Reaprofiteix exactament les mateixes dades que
// ja fem servir per als filtres 2D (puntsAltitud + pasLatMalla/
// pasLngMalla), sense cap consulta ni càlcul nou.
//
// Accepta una entitat sola (parcel·la o geometria) o un array
// d'entitats (una agrupació, amb el relleu de cada parcel·la membre
// dibuixat per separat, però totes compartint el mateix punt de
// referència 3D perquè quedin ben posicionades les unes respecte a les
// altres -- igual que el mapa 2D ja mostra els perímetres de totes les
// parcel·les d'una agrupació junts).
//
// Es construeix una superfície triangulada real per cada entitat (no
// un punt sol per prisma): com que la malla té un pas constant
// (pasLatMalla/pasLngMalla), es pot reconstruir la posició de fila/
// columna de cada punt arrodonint la seva distància al punt més
// cantoner -- sense necessitat de guardar cap dada nova. Cada quatre
// punts veïns formen dos triangles; si algun hi falta (som a la vora
// real del perímetre), es deixa el forat, que és exactament el
// contorn de la parcel·la.
//
// Igual que al filtre 2D "Mostrar al mapa", es pot triar entre
// diverses capes (aplicarCapa): "ombres"/"cap" (un sol color base, i
// és la llum real de Three.js qui dona forma i relleu -- no un color
// d'ombra "cuinat" per nosaltres, com fèiem al 2D) o "altitud"/
// "pendent" (un color per vèrtex, el mateix degradat que el filtre 2D
// equivalent -- amb "altitud", el mínim i el màxim es calculen sobre
// TOTES les entitats juntes, per a una escala de color coherent a tota
// l'agrupació -- combinat igualment amb la llum). "Només el perímetre"
// (mostrarPerimetre), a diferència del 2D, no és un simple contorn pla:
// es projecta sobre la superfície real del relleu amb un raig cap
// avall (vegeu-ne el mètode), un per cada entitat. Encara no hi ha
// versió 3D d'"Orientació" (caldrien fletxes 3D pròpies).
//
// Necessita que THREE (i THREE.OrbitControls) estiguin carregats
// globalment via <script> abans d'importar aquest mòdul, igual que
// Mapa necessita L (Leaflet).
import { t } from '../i18n.js';
import { colorAltitud, colorPendent } from '../../nucli/js/serveis/escalaColor.js';

const METRES_PER_GRAU_LATITUD = 111320;

// Sense exagerar (1 = fidelitat geomètrica completa) -- si una
// parcel·la és plana de debò, es vol veure així, no exagerada.
const EXAGERACIO_VERTICAL = 1;

export class Mapa3D {
  constructor(idContenidor) {
    this.contenidor = document.getElementById(idContenidor);
    this._escena = null;
    this._camera = null;
    this._renderer = null;
    this._controls = null;
    this._idAnimacio = null;
    this._gestorRedimensio = null;
    this._gestorPantallaCompleta = null;
    this._brúixola = null;
    this._grupCotes = null;
    this._grupPerimetre = null;
    // Es desen per poder-los reutilitzar a mostrarCotes()/
    // mostrarPerimetre(), sense haver-los de recalcular.
    this._centreLat = null;
    this._centreLng = null;
    this._metresPerGrauLng = null;
    this._altitudMinima = null;
    this._escalaEscena = null;
    // Una entrada per entitat (parcel·la/geometria): { entitat,
    // geometria (BufferGeometry), malla (Mesh), puntsOrdenats }. Es
    // manté així (no un sol conjunt) perquè una agrupació en té
    // diverses alhora, cadascuna amb la seva pròpia malla.
    this._malles = [];
  }

  /**
   * Munta l'escena i hi dibuixa el relleu de cada entitat rebuda
   * (parcel·la, geometria, o un array de qualsevol combinació -- per
   * exemple, totes les parcel·les d'una agrupació). Retorna false
   * (sense fer res més) si cap de les entitats té punts d'altimetria
   * calculats amb el mètode de malla -- cal el mateix que ja exigim
   * per als filtres 2D de pendent/ombres.
   */
  mostrarTerreny(entitatOArray) {
    this.destruir();

    const entitats = Array.isArray(entitatOArray) ? entitatOArray : [entitatOArray];
    const entitatsValides = entitats.filter(
      (e) => (e.puntsAltitud ?? []).some((p) => p.pendent != null) && e.pasLatMalla && e.pasLngMalla
    );
    if (entitatsValides.length === 0) return false;

    // Un sol punt de referència per a totes les entitats juntes (no un
    // per entitat), perquè totes quedin ben posicionades les unes
    // respecte a les altres en el mateix espai 3D.
    const totsElsPunts = entitatsValides.flatMap((e) => e.puntsAltitud.filter((p) => p.pendent != null));
    this._centreLat = totsElsPunts.reduce((acc, p) => acc + p.coordenades[0], 0) / totsElsPunts.length;
    this._centreLng = totsElsPunts.reduce((acc, p) => acc + p.coordenades[1], 0) / totsElsPunts.length;
    this._metresPerGrauLng = METRES_PER_GRAU_LATITUD * Math.cos((this._centreLat * Math.PI) / 180);
    this._altitudMinima = Math.min(...totsElsPunts.map((p) => p.altitud));

    this._escena = new THREE.Scene();
    this._escena.background = new THREE.Color('#dcd7c9');

    // Llum real de Three.js -- ara sí, també per al relleu: en lloc de
    // "cuinar" nosaltres mateixos un color d'ombra per punt
    // (colorOmbres), es deixa que Three.js calculi la llum de debò
    // sobre la forma real de la malla triangulada (per això calia
    // computeVertexNormals() més avall). La direcció ve del mateix sol
    // que ja fem servir arreu (nord-oest, 45° d'alçada), perquè el
    // resultat sigui coherent amb la resta de l'app.
    this._escena.add(new THREE.AmbientLight(0xffffff, 0.5));
    const llumDirectional = new THREE.DirectionalLight(0xffffff, 0.9);
    llumDirectional.position.set(-0.5, 0.707, -0.5);
    this._escena.add(llumDirectional);

    const amplaContenidor = this.contenidor.clientWidth;
    const altaContenidor = this.contenidor.clientHeight;
    this._camera = new THREE.PerspectiveCamera(50, amplaContenidor / altaContenidor, 0.1, 100000);

    this._renderer = new THREE.WebGLRenderer({ antialias: true });
    this._renderer.setSize(amplaContenidor, altaContenidor);
    this.contenidor.innerHTML = '';
    this.contenidor.appendChild(this._renderer.domElement);

    this._malles = entitatsValides.map((entitat) => this._construirMallaDe(entitat));
    for (const { malla } of this._malles) {
      this._escena.add(malla);
    }

    this._grupCotes = new THREE.Group();
    this._escena.add(this._grupCotes);
    this._grupPerimetre = new THREE.Group();
    this._escena.add(this._grupPerimetre);

    this._ajustarCameraA(this._malles.map((m) => m.malla));

    this._controls = new THREE.OrbitControls(this._camera, this._renderer.domElement);
    this._controls.target.set(0, 0, 0);
    this._controls.update();

    this._gestorRedimensio = () => this._redimensionar();
    window.addEventListener('resize', this._gestorRedimensio);

    this._afegirBotoPantallaCompleta();
    this._afegirBrúixola();

    this.aplicarCapa('ombres');
    this._animar();
    return true;
  }

  /**
   * Construeix la malla triangulada d'una sola entitat (fent servir ja
   * el punt de referència comú establert a mostrarTerreny), sense
   * afegir-la encara a l'escena.
   */
  _construirMallaDe(entitat) {
    const punts = entitat.puntsAltitud.filter((p) => p.pendent != null);

    // Reconstrucció de la posició (fila, columna) de cada punt dins la
    // graella original, arrodonint al pas conegut -- necessari per
    // saber quins punts són veïns entre ells i poder-los connectar.
    const latMinima = Math.min(...punts.map((p) => p.coordenades[0]));
    const lngMinima = Math.min(...punts.map((p) => p.coordenades[1]));
    const puntPerCasella = new Map();
    for (const p of punts) {
      const fila = Math.round((p.coordenades[0] - latMinima) / entitat.pasLatMalla);
      const columna = Math.round((p.coordenades[1] - lngMinima) / entitat.pasLngMalla);
      puntPerCasella.set(`${fila},${columna}`, p);
    }

    // Un vèrtex per punt vàlid: només posició (X=longitud/Est,
    // Y=altitud, Z=-latitud/-Nord -- vegeu _aCoordenades3D per a per
    // què cal el signe negatiu). Es desa "puntsOrdenats" en el mateix
    // ordre que els vèrtexs, per poder-hi calcular colors per vèrtex
    // més endavant (aplicarCapa) sense tornar a construir res.
    const vertexs = [];
    const puntsOrdenats = [];
    const indexPerCasella = new Map();

    for (const [clau, p] of puntPerCasella) {
      indexPerCasella.set(clau, vertexs.length / 3);
      const [x, y, z] = this._aCoordenades3D(p.coordenades, p.altitud);
      vertexs.push(x, y, z);
      puntsOrdenats.push(p);
    }

    // Dos triangles per cada "cel·la" (el punt actual, el de la dreta,
    // el de sota, i el de la diagonal) -- només si els quatre punts hi
    // són tots. Si en falta algun, es deixa el forat, que és
    // exactament el contorn real de la parcel·la en aquell tram.
    const indexs = [];
    for (const clau of puntPerCasella.keys()) {
      const [fila, columna] = clau.split(',').map(Number);
      const clauDreta = `${fila},${columna + 1}`;
      const clauSota = `${fila + 1},${columna}`;
      const clauDiagonal = `${fila + 1},${columna + 1}`;

      if (puntPerCasella.has(clauDreta) && puntPerCasella.has(clauSota) && puntPerCasella.has(clauDiagonal)) {
        const a = indexPerCasella.get(clau);
        const b = indexPerCasella.get(clauDreta);
        const c = indexPerCasella.get(clauSota);
        const d = indexPerCasella.get(clauDiagonal);
        indexs.push(a, c, b, b, c, d);
      }
    }

    const geometria = new THREE.BufferGeometry();
    geometria.setAttribute('position', new THREE.Float32BufferAttribute(vertexs, 3));
    geometria.setIndex(indexs);
    // Imprescindible perquè la llum sàpiga cap a on "mira" cada
    // triangle -- sense les normals, Three.js no pot calcular cap
    // ombra real sobre la forma del relleu.
    geometria.computeVertexNormals();

    // side: DoubleSide perquè no cal preocupar-se de l'ordre exacte
    // dels vèrtexs de cada triangle -- es veu bé es miri des d'on es
    // miri.
    const material = new THREE.MeshStandardMaterial({ roughness: 0.9, side: THREE.DoubleSide });
    const malla = new THREE.Mesh(geometria, material);

    return { entitat, geometria, malla, puntsOrdenats };
  }

  /**
   * Canvia com es pinta el relleu ja construït, sense reconstruir res
   * més (l'escena, la càmera, els controls es queden igual -- no es
   * perd l'angle de vista en canviar de capa):
   *  - "cap"/"ombres": un sol color base, i és la llum real qui dona
   *    forma i relleu (vegeu la capçalera del fitxer).
   *  - "altitud"/"pendent": un color per vèrtex (el mateix degradat que
   *    el filtre 2D equivalent), combinat igualment amb la llum real
   *    per seguir tenint sensació de volum. Amb "altitud", el mínim i
   *    el màxim es calculen sobre totes les malles juntes, no cadascuna
   *    per separat -- perquè el color sigui comparable entre parcel·les
   *    d'una mateixa agrupació.
   */
  aplicarCapa(tipus) {
    if (this._malles.length === 0) return;

    let minimGlobal = null;
    let maximGlobal = null;
    if (tipus === 'altitud') {
      const totsElsValors = this._malles.flatMap((m) => m.puntsOrdenats.map((p) => p.altitud));
      minimGlobal = Math.min(...totsElsValors);
      maximGlobal = Math.max(...totsElsValors);
    }

    for (const { geometria, malla, puntsOrdenats } of this._malles) {
      if (tipus === 'altitud' || tipus === 'pendent') {
        const colors = [];
        for (const p of puntsOrdenats) {
          const { fillColor } =
            tipus === 'altitud' ? colorAltitud(p.altitud, minimGlobal, maximGlobal) : colorPendent(p.pendent);
          const color = new THREE.Color(fillColor);
          colors.push(color.r, color.g, color.b);
        }

        geometria.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometria.attributes.color.needsUpdate = true;
        malla.material.vertexColors = true;
        malla.material.color.set('#ffffff');
      } else {
        // "cap" (només el perímetre) i "ombres" es veuen igual en 3D:
        // no hi ha cap manera diferent i sensata de mostrar "només el
        // perímetre" quan el que s'ensenya és tot un relleu, així que
        // totes dues cauen en el mateix cas -- un sol color base,
        // sense color per vèrtex.
        malla.material.vertexColors = false;
        malla.material.color.set('#a9a28f');
      }
      malla.material.needsUpdate = true;
    }
  }

  /**
   * Converteix unes coordenades (lat/lng) i una altitud a X/Y/Z de
   * l'escena -- reutilitzat per totes les malles, els marcadors de
   * cotes i el perímetre, perquè tot coincideixi exactament al mateix
   * lloc (i, amb una agrupació, totes les parcel·les quedin ben
   * posicionades les unes respecte a les altres).
   */
  _aCoordenades3D(coordenades, altitud) {
    const x = (coordenades[1] - this._centreLng) * this._metresPerGrauLng;
    const y = (altitud - this._altitudMinima) * EXAGERACIO_VERTICAL;
    // X = longitud (Est), Y = altitud (Amunt), i per tant Z ha de ser
    // -latitud (-Nord) -- no +latitud -- perquè Est × Amunt = -Nord en
    // un sistema de mà dreta com el del món real (i com el de
    // Three.js). Sense aquest signe negatiu, un dels eixos horitzontals
    // queda invertit respecte a l'altre: no és una simple rotació, és
    // un mirall.
    const z = -(coordenades[0] - this._centreLat) * METRES_PER_GRAU_LATITUD;
    return [x, y, z];
  }

  /**
   * Marca els punts d'altitud màxima i mínima de totes les malles
   * juntes (mateixos colors que el filtre 2D equivalent) -- s'afegeixen
   * a sobre del relleu ja dibuixat, no el substitueixen. Un marcador
   * tipus agulla (tija + cap esfèric, a l'estil Google Maps), no un
   * punt sol -- proporcional a l'escala general de l'escena, no al pas
   * de la malla, perquè es vegi bé sigui quina sigui la densitat de
   * punts.
   */
  mostrarCotes() {
    if (!this._grupCotes) return;
    this._grupCotes.clear();

    const totsElsPunts = this._malles.flatMap((m) => m.puntsOrdenats);
    if (totsElsPunts.length === 0) return;

    const puntMaxim = totsElsPunts.reduce((max, p) => (p.altitud > max.altitud ? p : max));
    const puntMinim = totsElsPunts.reduce((min, p) => (p.altitud < min.altitud ? p : min));

    const escala = this._escalaEscena ?? 10;
    const alcadaAgulla = escala * 0.14;
    const radiCap = escala * 0.03;
    const radiTija = radiCap * 0.1;

    // Gris fosc neutre per a la tija -- diferent tant del cap (roig o
    // blau) com dels colors del relleu, perquè es distingeixi bé com a
    // "l'agulla" en si, per sobre de qualsevol color de fons.
    const materialTija = new THREE.MeshStandardMaterial({ color: '#3a3a3a', roughness: 0.5 });

    const afegirAgulla = (punt, colorHex) => {
      const [x, y, z] = this._aCoordenades3D(punt.coordenades, punt.altitud);
      // MeshStandardMaterial (no Basic): a diferència del relleu, aquí
      // sí que volem que la llum de l'escena hi doni volum real.
      const materialCap = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.5 });

      const tija = new THREE.Mesh(new THREE.CylinderGeometry(radiTija, radiTija, alcadaAgulla, 8), materialTija);
      tija.position.y = alcadaAgulla / 2;

      const cap = new THREE.Mesh(new THREE.SphereGeometry(radiCap, 16, 16), materialCap);
      cap.position.y = alcadaAgulla;

      const agulla = new THREE.Group();
      agulla.add(tija, cap);
      agulla.position.set(x, y, z);
      this._grupCotes.add(agulla);
    };

    // Mateixos colors que als extrems del filtre 2D d'altitud/cotes:
    // roig = més alt, blau = més baix.
    afegirAgulla(puntMaxim, '#c0392b');
    if (puntMinim !== puntMaxim) {
      afegirAgulla(puntMinim, '#2c5aa0');
    }
  }

  /** Treu els marcadors de cotes, sense tocar la resta del relleu. */
  amagarCotes() {
    this._grupCotes?.clear();
  }

  /**
   * Altitud (en coordenades 3D, no en metres reals) del punt de
   * qualsevol malla més proper a unes coordenades donades -- fet
   * servir quan un punt del perímetre cau just fora de la seva malla
   * real i el raig de mostrarPerimetre no hi troba cap intersecció.
   */
  _altitudMesPropera(coordenades) {
    const totsElsPunts = this._malles.flatMap((m) => m.puntsOrdenats);
    if (totsElsPunts.length === 0) return 0;

    let puntMesProper = totsElsPunts[0];
    let distanciaMinima = Infinity;
    for (const p of totsElsPunts) {
      const dLat = p.coordenades[0] - coordenades[0];
      const dLng = p.coordenades[1] - coordenades[1];
      const distancia = dLat * dLat + dLng * dLng;
      if (distancia < distanciaMinima) {
        distanciaMinima = distancia;
        puntMesProper = p;
      }
    }

    const [, y] = this._aCoordenades3D(puntMesProper.coordenades, puntMesProper.altitud);
    return y;
  }

  /**
   * Dibuixa el contorn de cada entitat que es va passar a
   * mostrarTerreny() com una línia, projectada sobre la superfície real
   * del relleu -- amb un raig cap avall des de ben amunt, cercant
   * exactament on toca qualsevol de les malles en cada punt del
   * perímetre. Útil per veure clarament on cau el límit de cada
   * parcel·la sobre el terreny (les coordenades del perímetre no
   * porten altitud pròpia, com sí que en tenen els punts de la malla).
   */
  mostrarPerimetre() {
    if (this._malles.length === 0 || !this._grupPerimetre) return;
    this._grupPerimetre.clear();

    const escala = this._escalaEscena ?? 10;
    const raycaster = new THREE.Raycaster();
    const altariaDeCerca = escala * 10; // ben per sobre de qualsevol relleu real
    const objectesDeLesMalles = this._malles.map((m) => m.malla);

    for (const { entitat } of this._malles) {
      const puntsLinia = [];
      for (const coord of entitat.coordenades) {
        const x = (coord[1] - this._centreLng) * this._metresPerGrauLng;
        const z = -(coord[0] - this._centreLat) * METRES_PER_GRAU_LATITUD;

        raycaster.set(new THREE.Vector3(x, altariaDeCerca, z), new THREE.Vector3(0, -1, 0));
        const interseccions = raycaster.intersectObjects(objectesDeLesMalles);
        // Com que la malla té un pas fix, sol quedar-se una mica per
        // dins del perímetre real -- alguns punts del contorn cauen
        // just fora seu, i el raig no hi troba res. En lloc d'una
        // alçada fixa, es fa servir l'altitud del punt de malla més
        // proper (molt més raonable que un pla, ja que el relleu no
        // sol canviar gaire en la distància d'un sol pas de malla).
        const y = interseccions.length > 0 ? interseccions[0].point.y : this._altitudMesPropera(coord);

        // Un pèl per sobre de la superfície (no exactament a sobre),
        // perquè no hi hagi "parpelleig" amb ella (el conegut
        // "z-fighting") -- una xifra petita i fixa, no proporcional a
        // la mida de la parcel·la: ara que l'alçada és fidel del tot
        // (sense exagerar), un marge relatiu a l'amplada quedaria
        // massa gran comparat amb el desnivell real, i la línia
        // semblaria "flotar".
        const MARGE_PERIMETRE_METRES = 0.15;
        puntsLinia.push(new THREE.Vector3(x, y + MARGE_PERIMETRE_METRES, z));
      }

      const geometriaLinia = new THREE.BufferGeometry().setFromPoints(puntsLinia);
      const materialLinia = new THREE.LineBasicMaterial({ color: '#396a49', linewidth: 2 });
      // LineLoop tanca el polígon sol (torna al primer punt), no cal
      // duplicar-lo a mà.
      this._grupPerimetre.add(new THREE.LineLoop(geometriaLinia, materialLinia));
    }
  }

  /** Treu la línia del perímetre, sense tocar la resta del relleu. */
  amagarPerimetre() {
    this._grupPerimetre?.clear();
  }

  /** Situa la càmera a una distància i angle raonables perquè es vegi tot el relleu de seguida. */
  _ajustarCameraA(objectes) {
    const limits = new THREE.Box3();
    for (const objecte of objectes) {
      limits.expandByObject(objecte);
    }
    const mida = new THREE.Vector3();
    limits.getSize(mida);
    const radi = Math.max(mida.x, mida.z, 10);
    // Es desa perquè mostrarCotes() pugui fer les agulles proporcionals
    // a la mida general de l'escena, no al pas (molt més petit) de la
    // malla.
    this._escalaEscena = radi;

    this._camera.position.set(0, radi * 0.9, radi * 1.1);
    this._camera.lookAt(0, 0, 0);
  }

  /** Botó de pantalla completa, igual que al mapa 2D (Mapa), però fet a mà (aquí no hi ha controls de Leaflet). */
  _afegirBotoPantallaCompleta() {
    const boto = document.createElement('button');
    boto.type = 'button';
    boto.className = 'boto-pantalla-completa boto-pantalla-completa--3d';
    boto.innerHTML = '⛶';
    boto.setAttribute('aria-label', t('Pantalla completa'));
    boto.title = t('Pantalla completa');

    boto.addEventListener('click', () => {
      if (document.fullscreenElement === this.contenidor) {
        document.exitFullscreen?.();
      } else {
        this.contenidor.requestFullscreen?.();
      }
    });
    this.contenidor.appendChild(boto);

    this._gestorPantallaCompleta = () => {
      const enPantallaCompleta = document.fullscreenElement === this.contenidor;
      boto.innerHTML = enPantallaCompleta ? '✕' : '⛶';
      this._redimensionar();
    };
    document.addEventListener('fullscreenchange', this._gestorPantallaCompleta);
  }

  /**
   * Petita brúixola superposada (no forma part de l'escena 3D, és un
   * element HTML) que gira en sentit contrari a la càmera, perquè
   * sempre assenyali el nord real encara que es giri el model amb els
   * controls d'òrbita.
   */
  _afegirBrúixola() {
    this._brúixola = document.createElement('div');
    this._brúixola.className = 'brúixola-3d';
    this._brúixola.innerHTML = '<span class="brúixola-3d__fletxa">▲</span><span class="brúixola-3d__lletra">N</span>';
    this.contenidor.appendChild(this._brúixola);
  }

  /** Actualitza la rotació de la brúixola segons l'angle actual de la càmera. */
  _actualitzarBrúixola() {
    if (!this._brúixola) return;
    // Angle de la càmera al voltant de l'eix Y, respecte al punt on
    // mira -- amb aquest conveni (atan2(x, z)), val 0 quan la càmera
    // és al costat +Z (posició inicial) mirant cap al nord (-Z).
    const angleCamera = Math.atan2(
      this._camera.position.x - this._controls.target.x,
      this._camera.position.z - this._controls.target.z
    );
    const graus = (angleCamera * 180) / Math.PI;
    this._brúixola.style.transform = `rotate(${graus}deg)`;
  }

  _redimensionar() {
    if (!this._renderer) return;
    const amplada = this.contenidor.clientWidth;
    const alcada = this.contenidor.clientHeight;
    this._camera.aspect = amplada / alcada;
    this._camera.updateProjectionMatrix();
    this._renderer.setSize(amplada, alcada);
  }

  _animar() {
    this._idAnimacio = requestAnimationFrame(() => this._animar());
    this._controls?.update();
    this._actualitzarBrúixola();
    this._renderer.render(this._escena, this._camera);
  }

  /** Atura l'animació i allibera els recursos de Three.js -- cal cridar-ho abans de tornar al mapa 2D. */
  destruir() {
    if (this._idAnimacio != null) {
      cancelAnimationFrame(this._idAnimacio);
      this._idAnimacio = null;
    }
    if (this._gestorRedimensio) {
      window.removeEventListener('resize', this._gestorRedimensio);
      this._gestorRedimensio = null;
    }
    if (this._gestorPantallaCompleta) {
      document.removeEventListener('fullscreenchange', this._gestorPantallaCompleta);
      this._gestorPantallaCompleta = null;
    }
    this._controls?.dispose();
    this._renderer?.dispose();
    if (this.contenidor) {
      this.contenidor.innerHTML = '';
    }
    this._escena = null;
    this._camera = null;
    this._renderer = null;
    this._controls = null;
    this._brúixola = null;
    this._grupCotes = null;
    this._grupPerimetre = null;
    this._escalaEscena = null;
    this._malles = [];
  }
}
