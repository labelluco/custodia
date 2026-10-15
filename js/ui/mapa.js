// Embolcall sobre Leaflet. Necessita que L estigui carregat globalment
// via <script> abans d'importar aquest mòdul.
import { t } from '../i18n.js';
import { colorAltitud, colorPendent, colorOmbres } from '../serveis/escalaColor.js';

const COLOR_NEUTRE = '#000000';

const CENTRE_PER_DEFECTE = [40.15, -0.65]; // zona interior de Castelló/Terol
const ZOOM_PER_DEFECTE = 11;

export class Mapa {
  constructor(idContenidor) {
    this.leafletMap = L.map(idContenidor).setView(CENTRE_PER_DEFECTE, ZOOM_PER_DEFECTE);

    const capaOsm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    });

    // Ortofoto PNOA de l'IGN, dades obertes. Es deixa com a base alternativa
    // (no superposada) perquè és útil veure el terreny real, no només el
    // mapa esquemàtic, sobretot per valorar l'estat real d'una parcel·la.
    const capaOrtofoto = L.tileLayer.wms('https://www.ign.es/wms-inspire/pnoa-ma?', {
      layers: 'OI.OrthoimageCoverage',
      format: 'image/jpeg',
      version: '1.3.0',
      maxZoom: 19,
      attribution: 'PNOA WMS. Cedit per © Instituto Geográfico Nacional de España',
    });

    capaOsm.addTo(this.leafletMap);

    L.control
      .layers({ 'Mapa': capaOsm, 'Ortofoto (PNOA)': capaOrtofoto })
      .addTo(this.leafletMap);

    this.capaParceles = L.layerGroup().addTo(this.leafletMap);
    // Capa a part per als filtres opcionals (altitud/orientació) de les
    // pàgines de detall -- separada de capaParceles perquè buidar-la no
    // afecti mai el perímetre de la parcel·la ni les altres capes.
    this.capaFiltre = L.layerGroup().addTo(this.leafletMap);
    this.parceles = [];
    this._capaRessaltada = null;

    this._afegirControlPantallaCompleta();
  }

  /**
   * Botó de pantalla completa: fa servir l'API nativa del navegador
   * (sense cap llibreria nova) sobre el propi contenidor del mapa.
   * Alguns navegadors mòbils (Safari a iOS, sobretot) no admeten
   * aquesta API per a elements que no siguin <video> -- en aquest cas,
   * el botó simplement no farà res en tocar-lo, no dona cap error.
   */
  _afegirControlPantallaCompleta() {
    const contenidor = this.leafletMap.getContainer();
    let boto;

    const ControlPantallaCompleta = L.Control.extend({
      onAdd: () => {
        boto = L.DomUtil.create('button', 'leaflet-bar leaflet-control boto-pantalla-completa');
        boto.type = 'button';
        boto.innerHTML = '⛶';
        boto.setAttribute('aria-label', t('Pantalla completa'));
        boto.title = t('Pantalla completa');

        L.DomEvent.disableClickPropagation(boto);
        L.DomEvent.on(boto, 'click', () => {
          if (document.fullscreenElement === contenidor) {
            document.exitFullscreen?.();
          } else {
            contenidor.requestFullscreen?.();
          }
        });

        return boto;
      },
    });

    new ControlPantallaCompleta({ position: 'topright' }).addTo(this.leafletMap);

    // Un cop canvia l'estat de pantalla completa (des del botó, la
    // tecla Esc, o el propi navegador), cal actualitzar la icona i
    // avisar Leaflet que la mida del contenidor ha canviat -- si no,
    // el mapa es queda mig en blanc fins que es torna a interactuar
    // amb ell.
    document.addEventListener('fullscreenchange', () => {
      const enPantallaCompleta = document.fullscreenElement === contenidor;
      boto.innerHTML = enPantallaCompleta ? '✕' : '⛶';
      setTimeout(() => this.leafletMap.invalidateSize(), 100);
    });
  }

  /**
   * @param {Object} parcela
   * @param {(parcela: Object) => void} [onClick]
   * @param {string} [color] Color del contorn/farciment. Per defecte,
   *   neutre (negre): Mapa ja no calcula cap color a partir d'un risc
   *   -- qui la crida (inici.js, detall.js) el calcula amb ServeiRisc
   *   i el passa ja fet, perquè Mapa només sap pintar, no avaluar risc.
   */
  afegirParcela(parcela, onClick, color = COLOR_NEUTRE) {
    const poligon = L.polygon(parcela.coordenades, {
      color,
      weight: 2,
      fillColor: color,
      fillOpacity: 0.35,
    });

    poligon.bindTooltip(`${parcela.poblacio ?? parcela.nom ?? ''}${parcela.us ? ` — ${parcela.us}` : ''}`);

    if (onClick) {
      poligon.on('click', () => onClick(parcela));
    }

    poligon.addTo(this.capaParceles);
    this.parceles.push({ parcela, capa: poligon });
  }

  /**
   * Ressalta una parcel·la concreta (li puja el gruix de la vora i hi fa
   * zoom), desfent el ressalt de l'anterior si n'hi havia. Pensat perquè
   * tocar un ítem del llistat "es noti" al mapa, tant amb ratolí com amb
   * tàctil -- el clic funciona igual en tots dos casos.
   */
  ressaltarParcela(id) {
    const entrada = this.parceles.find((p) => p.parcela.id === id);
    if (!entrada) return;

    if (this._capaRessaltada) {
      this._capaRessaltada.forEach((capa) => capa.setStyle({ weight: 2 }));
    }

    entrada.capa.setStyle({ weight: 5 });
    entrada.capa.bringToFront();
    entrada.capa.openTooltip();
    this._capaRessaltada = [entrada.capa];

    this.leafletMap.fitBounds(entrada.capa.getBounds(), { padding: [40, 40], maxZoom: 17 });
  }

  /**
   * Igual que ressaltarParcela, però per a diverses alhora (per
   * exemple, totes les parcel·les d'una agrupació) -- ajusta la vista
   * al conjunt de totes elles, no només a una.
   */
  ressaltarParceles(ids) {
    if (this._capaRessaltada) {
      this._capaRessaltada.forEach((capa) => capa.setStyle({ weight: 2 }));
    }

    const entrades = this.parceles.filter((p) => ids.includes(p.parcela.id));
    if (entrades.length === 0) return;

    const capes = entrades.map((e) => e.capa);
    capes.forEach((capa) => {
      capa.setStyle({ weight: 5 });
      capa.bringToFront();
    });
    this._capaRessaltada = capes;

    const limits = L.featureGroup(capes).getBounds();
    this.leafletMap.fitBounds(limits, { padding: [40, 40], maxZoom: 17 });
  }

  /** Treu només la capa de filtre (altitud/orientació), sense tocar el perímetre. */
  netejarFiltre() {
    this.capaFiltre.clearLayers();
  }

  /**
   * Dibuixa la "cel·la" d'un punt del filtre: un quadrat que cobreix
   * exactament l'espai fins als punts veïns (si es coneix el pas de la
   * graella -- distanciaMetres/coordenades), en lloc d'un punt sol que
   * deixa buits entre punts. Les dades calculades abans que
   * guardéssim el pas de la graella (pasLat/pasLng) encara no en
   * disposen -- es mostren com a punt sol fins que es recalculin.
   */
  _dibuixarCellaFiltre(punt, opcionsEstil) {
    if (punt.pasLat && punt.pasLng) {
      const [lat, lng] = punt.coordenades;
      // Es fa cada quadrat un pèl més gran que el pas exacte (2%),
      // perquè se solapi lleugerament amb els veïns en lloc de tocar-los
      // vora amb vora -- si dos quadrats de colors diferents es toquen
      // exactament, el difuminat (antialiasing) de la vora hi deixa una
      // línia fina igualment, encara que la vora de cada quadrat sigui
      // del mateix color que el seu propi farciment. IMPORTANT: com que
      // se solapen, el farciment de cada filtre ha de dur fillOpacity: 1
      // -- amb qualsevol transparència, a la franja de solapament es
      // veuria una barreja dels dos colors veïns, en lloc del color net
      // d'un d'ells, tornant a deixar una línia visible.
      const mitjaLat = (punt.pasLat / 2) * 1.02;
      const mitjaLng = (punt.pasLng / 2) * 1.02;
      const limits = [
        [lat - mitjaLat, lng - mitjaLng],
        [lat + mitjaLat, lng + mitjaLng],
      ];
      // La vora es força al mateix color que el farciment (mai el que
      // passi cada filtre per a la vora dels punts sols): així no es
      // distingeix mai cap línia entre quadrats veïns, a cap zoom --
      // però calia que existís (weight > 0), o un farciment que quedi
      // per sota d'un píxel de pantalla (mapa molt allunyat) es pot
      // arribar a arrodonir a "res" i el quadrat sencer desapareix.
      return L.rectangle(limits, { ...opcionsEstil, weight: 1, color: opcionsEstil.fillColor }).addTo(this.capaFiltre);
    }
    return L.circleMarker(punt.coordenades, { radius: 6, weight: 1, ...opcionsEstil }).addTo(this.capaFiltre);
  }

  /**
   * Filtre d'altitud: un quadrat de color per cada punt d'altimetria ja
   * calculat, en un degradat blau (més baix) -> roig (més alt) relatiu
   * al mínim i màxim d'aquesta mateixa parcel·la (o agrupació) --
   * deliberadament un degradat diferent del de risc (verd->roig), per
   * no confondre "més alt" amb "més risc".
   */
  afegirFiltreAltitud(punts) {
    this.netejarFiltre();
    const valors = punts.map((p) => p.altitud).filter((a) => a != null);
    if (valors.length === 0) return;
    const minim = Math.min(...valors);
    const maxim = Math.max(...valors);

    for (const p of punts) {
      if (p.altitud == null) continue;
      this._dibuixarCellaFiltre(p, {
        ...colorAltitud(p.altitud, minim, maxim),
        fillOpacity: 1,
      }).bindTooltip(`${Math.round(p.altitud)} m`);
    }
  }

  /**
   * Filtre d'orientació: la mateixa fletxa rotada que ja fem servir a
   * altitud.html (apunta cap on "mira" el pendent), en lloc d'un mapa
   * de colors abstracte -- molt més intuïtiu i coherent amb la resta
   * de l'app. Els punts sense orientació (plans) es marquen a part.
   */
  afegirFiltreOrientacio(punts) {
    this.netejarFiltre();
    for (const p of punts) {
      if (p.orientacio == null) continue;

      const icona = L.divIcon({
        className: '',
        html: `<div class="icona-orientacio" style="transform: rotate(${p.orientacio}deg);">&#8593;</div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      const marcador = L.marker(p.coordenades, { icon: icona });
      const textOrientacio = `${p.orientacio.toFixed(0)}°${p.etiqueta ? ` (${p.etiqueta})` : ''}`;
      marcador.bindTooltip(textOrientacio);
      marcador.on('click', () => marcador.openTooltip());
      marcador.addTo(this.capaFiltre);
    }
  }

  /**
   * Filtre de cotes: només els dos punts extrems (l'altitud màxima i la
   * mínima), no tots els de la malla/vèrtexs -- útil per localitzar-los
   * ràpidament sobre el terreny, sense el soroll visual de la resta de
   * punts.
   */
  afegirFiltreCotes(punts) {
    this.netejarFiltre();
    const ambAltitud = punts.filter((p) => p.altitud != null);
    if (ambAltitud.length === 0) return;

    const puntMaxim = ambAltitud.reduce((max, p) => (p.altitud > max.altitud ? p : max));
    const puntMinim = ambAltitud.reduce((min, p) => (p.altitud < min.altitud ? p : min));

    const afegirPunt = (punt, etiqueta, color) => {
      L.circleMarker(punt.coordenades, {
        radius: 8,
        color: 'white',
        weight: 2,
        fillColor: color,
        fillOpacity: 1,
      })
        .bindTooltip(`${etiqueta}: ${punt.altitud.toFixed(0)} m`)
        .addTo(this.capaFiltre);
    };

    // Mateixos colors que als extrems del degradat d'afegirFiltreAltitud
    // (roig = més alt, blau = més baix), perquè es reconegui d'un cop
    // d'ull sense haver de llegir el tooltip.
    afegirPunt(puntMaxim, t('Cota màxima'), 'hsl(0, 75%, 45%)');
    if (puntMinim !== puntMaxim) {
      afegirPunt(puntMinim, t('Cota mínima'), 'hsl(240, 75%, 45%)');
    }
  }

  /**
   * Filtre de pendent ("laderes"): un punt de color per cada punt
   * calculat, en un degradat verd (pla) -> roig (molt pendent).
   * Llindar de saturació propi, diferent del que fem servir per al
   * risc d'incendi -- aquí l'objectiu és només veure el relleu, no
   * avaluar risc.
   */
  afegirFiltrePendent(punts) {
    this.netejarFiltre();

    for (const p of punts) {
      if (p.pendent == null) continue;
      this._dibuixarCellaFiltre(p, {
        ...colorPendent(p.pendent),
        fillOpacity: 1,
      }).bindTooltip(`${p.pendent.toFixed(1)} %`);
    }
  }

  /**
   * Filtre d'ombres (hillshade): simula com incidiria la llum del sol
   * sobre el relleu, a partir del pendent i l'orientació de cada punt.
   * Paràmetres del sol (alçada 45°, azimut 315° = nord-oest) iguals
   * als que fa servir per defecte la majoria de programari SIG (QGIS,
   * ArcGIS) -- no és un valor arbitrari nostre.
   */
  afegirFiltreOmbres(punts) {
    this.netejarFiltre();

    for (const p of punts) {
      if (p.pendent == null) continue;
      const { color, fillColor, gris } = colorOmbres(p.pendent, p.orientacio);
      this._dibuixarCellaFiltre(p, { color, fillColor, fillOpacity: 1 }).bindTooltip(
        `${t('Il·luminació')}: ${gris}%`
      );
    }
  }

  /**
   * Una parcel·la "candidata" trobada al cercador del Cadastre (encara
   * no desada, sense id propi) -- estil senzill i diferenciat de les
   * parcel·les ja guardades, amb la referència cadastral com a tooltip.
   */
  afegirParcelaCandidata(coordenades, referenciaCadastral, onClick) {
    const poligon = L.polygon(coordenades, {
      color: '#396a49',
      weight: 2,
      fillColor: '#396a49',
      fillOpacity: 0.15,
    });
    poligon.bindTooltip(referenciaCadastral);
    if (onClick) {
      poligon.on('click', onClick);
    }
    poligon.addTo(this.capaParceles);
  }

  buidar() {
    this.capaParceles.clearLayers();
    this.parceles = [];
    this._capaRessaltada = null;
  }

  /**
   * Afegeix un marcador per cada vèrtex del perímetre, amb la seva
   * altitud com a tooltip en clicar-hi. Pensat per a la pàgina de
   * càlcul d'altimetria, no per a l'ús habitual (inici/detall).
   *
   * @param {Array<[number, number]>} coordenades Vèrtexs [lat, lng]
   * @param {number[]} altituds Una altitud (m) per vèrtex, mateix ordre
   */
  afegirVertexsAmbAltitud(coordenades, altituds) {
    coordenades.forEach((punt, i) => {
      const marcador = L.circleMarker(punt, {
        radius: 6,
        color: '#1b5e20',
        fillColor: '#a5d6a7',
        fillOpacity: 0.9,
        weight: 2,
      });
      marcador.bindTooltip(`${altituds[i].toFixed(0)} m`);
      marcador.on('click', () => marcador.openTooltip());
      marcador.addTo(this.leafletMap);
    });
  }

  /**
   * Com afegirVertexsAmbAltitud, però pintant una fletxa rotada segons
   * l'orientació de cada punt en lloc d'un cercle -- pensat per al
   * mètode de malla, on cada punt ja té una orientació local calculada.
   * Els punts sense orientació definida (terreny massa pla) es pinten
   * com un punt gris, sense fletxa.
   *
   * L'etiqueta de bruixola es rep ja calculada (per exemple, amb
   * ServeiOrientacio.etiquetaBruixola) en lloc que Mapa hagi de conèixer
   * cap servei -- aquesta classe només sap pintar, no calcular res.
   *
   * @param {Array<{coordenades: [number, number], altitud: number, orientacio: number|null, etiqueta?: string}>} punts
   */
  afegirPuntsAmbOrientacio(punts) {
    punts.forEach(({ coordenades, altitud, orientacio, etiqueta }) => {
      const html =
        orientacio == null
          ? '<div class="icona-orientacio icona-orientacio--plana"></div>'
          : `<div class="icona-orientacio" style="transform: rotate(${orientacio}deg);">&#8593;</div>`;

      const icona = L.divIcon({
        className: '',
        html,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      const marcador = L.marker(coordenades, { icon: icona });
      const textOrientacio =
        orientacio == null
          ? t('pla (sense orientació definida)')
          : `${orientacio.toFixed(0)}°${etiqueta ? ` (${etiqueta})` : ''}`;
      marcador.bindTooltip(`${altitud.toFixed(0)} m — ${t('orientació:')} ${textOrientacio}`);
      marcador.on('click', () => marcador.openTooltip());
      marcador.addTo(this.leafletMap);
    });
  }

  /**
   * Igual que afegirVertexsAmbAltitud, però per als punts d'una malla
   * interior (vegeu js/geometria/malla.js) -- mateix comportament
   * (clic per veure l'altitud), amb un estil diferent perquè es
   * distingeixin visualment dels vèrtexs del perímetre.
   */
  afegirPuntsMalla(punts, altituds) {
    punts.forEach((punt, i) => {
      const marcador = L.circleMarker(punt, {
        radius: 4,
        color: '#0d47a1',
        fillColor: '#90caf9',
        fillOpacity: 0.9,
        weight: 1,
      });
      marcador.bindTooltip(`${altituds[i].toFixed(0)} m`);
      marcador.on('click', () => marcador.openTooltip());
      marcador.addTo(this.leafletMap);
    });
  }

  ajustarVistaATotes() {
    if (this.parceles.length === 0) return;
    const grup = L.featureGroup(this.parceles.map((p) => p.capa));
    this.leafletMap.fitBounds(grup.getBounds(), { padding: [20, 20] });
  }
}
