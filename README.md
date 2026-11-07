# Custòdia

Eina d'anàlisi i gestió del territori per a propietaris de finques rústiques
i entitats de custòdia del territori.

Custòdia és una PWA (Progressive Web App) de codi lliure que permet
registrar parcel·les rústiques sobre un mapa, consultar-ne les dades
cadastrals, calcular-ne el pendent i l'orientació, i obtenir-ne un índex
experimental de risc d'incendi a partir de la vegetació, el pendent i
l'orientació. Disponible en català i castellà.

## Funcionalitats

- **Afegir una parcel·la**: consulta directa al Cadastre (població, polígon,
  parcel·la) per obtenir-ne el perímetre, l'ús i el desglossament de
  subparceles, sense haver de dibuixar res a mà.
- **Càlcul d'altitud i pendent**: dos mètodes (vèrtexs del perímetre, o una
  malla de punts interiors), a partir del Model Digital del Terreny de
  l'IDEE. Amb el mètode de malla, també es calcula l'orientació mitjana.
- **Índex de risc d'incendi**: calculat automàticament combinant vegetació
  (segons les subparceles del Cadastre), pendent i orientació. És un model
  propi i experimental, no un estàndard oficial ni una probabilitat real
  d'incendi — pensat per comparar parcel·les entre elles, no com a valor
  absolut.
- **Mapa i llistat**: totes les parcel·les es veuen sobre un mapa a pantalla
  completa (amb un color segons l'índex de risc) i en un llistat al panell
  flotant, amb cerca, ordenació i accés directe al detall de cadascuna.
- **Agrupacions i geometries**: parcel·les agrupades (amb els valors
  agregats) i perímetres dibuixats a mà, sense referència cadastral.
- **Vista 3D del relleu**, com a Terra 3D: un bloc de terreny amb el
  perímetre exacte, generat al moment a partir del MDT de l'IGN, amb capes
  d'ortofoto, altitud, pendent i maqueta, cotes i tres nivells de detall.
  Sense connexió, es mostra el relleu amb els punts d'altimetria desats.
- **Còpia de seguretat** en CSV (exportar i importar).
- **Exportació GPX**: el perímetre de qualsevol parcel·la es pot exportar
  per fer-lo servir amb un GPS o una app de navegació al camp.
- **Multilingüe** (català/castellà), amb detecció automàtica de l'idioma
  del navegador i selector manual.
- **Ús sense connexió**: un cop carregada, l'app funciona offline (PWA amb
  service worker); totes les dades es guarden **localment al dispositiu**
  (IndexedDB) — no hi ha cap servidor ni compte d'usuari.

## Fonts de dades

Totes les dades procedeixen de fonts públiques i obertes:

- **Cadastre** (Sede Electrónica del Catastro): geometria de la parcel·la,
  referència cadastral, superfície, ús, i el desglossament de subparceles
  (descripció, superfície, índex de productivitat).
- **IDEE / IGN**: Model Digital del Terreny, per al càlcul
  d'altitud/pendent/orientació. Els vèrtexs del perímetre es consulten amb
  `getElevation`; la malla, amb una sola graella del WCS del MDT (5 m),
  interpolada localment (vegeu `ServeiAltimetria.consultarAltitudsMDT`).

Es va explorar també el **Mapa Forestal d'Espanya (MFE)** per obtenir el
tipus de vegetació de cada parcel·la, però el servei s'ha trobat
sistemàticament caigut; la funcionalitat es manté al codi
(`js/serveis/vegetacio.js`) però desconnectada, per si en el futur torna a
funcionar o es troba una font alternativa.

## Tecnologia

- JavaScript (mòduls ES natius, sense framework ni bundler)
- [Leaflet](https://leafletjs.com/) per als mapes, [proj4js](http://proj4js.org/)
  per a la conversió de coordenades i [Three.js](https://threejs.org/) r128
  per al 3D (totes via CDN, amb versió fixa)
- IndexedDB per a l'emmagatzematge local
- PWA: `manifest.json` + `service-worker.js` per a instal·lació i ús offline
- **Nucli compartit** amb les altres apps de la família
  ([nucli](https://github.com/labelluco/nucli)): Cadastre, províncies i
  municipis, MDT, escales de color, traduccions i estils base
  (`nucli/css/nucli.css`). És una **còpia** a `nucli/`, no un submòdul
  (Codeberg Pages no en serveix); s'actualitza amb `./actualitzar-nucli.sh`
  i `nucli/VERSIO` diu de quin commit ve. No s'edita mai la còpia.

## Estructura del repositori

```
custodia/
├── index.html                 Inici (accions principals)
├── parceles.html · agrupacions.html · geometries.html     Llistats (mapa + panell)
├── detall*.html               Detall (2D/3D, risc, dades)
├── afegir*.html               Afegir parcel·les, agrupacions i geometries
├── altitud*.html              Altimetria (càlcul i resum)
├── copia-seguretat.html       Exportar / importar CSV
├── manifest.json · service-worker.js
├── actualitzar-nucli.sh       Torna a copiar ../nucli a nucli/
├── nucli/                     Còpia del nucli compartit (no editar)
├── css/estils.css             Disposició pròpia (sobre nucli/css/nucli.css)
└── js/
    ├── model/                 Parcela, Agrupacio, Geometria (dades pures)
    ├── serveis/               Altimetria, orientació, risc, IndexedDB, GPX, CSV
    ├── geometria/             Malla de punts i gradients (càlcul pur)
    ├── ui/                    Mapa (Leaflet), Vista3D (visor del nucli, o
    │                          Mapa3D sense connexió), controls del mapa,
    │                          menú, disposició del panell, diàlegs...
    ├── i18n.js · i18n/es.js   Traduccions (sobre el sistema del nucli)
    └── <pàgina>.js            Un controlador per pàgina
```

## Executar en local

Com que és una PWA sense backend, n'hi ha prou amb servir els fitxers
estàtics (obrir-los directament com a `file://` no permet registrar el
service worker). Des de la carpeta de l'app:

```bash
node nucli/eines/servidor.mjs 8000
```

I obrir `http://localhost:8000` al navegador. Abans de publicar, cal passar
les verificacions: `node nucli/eines/verificar.mjs`.

## Publicar

El codi és a https://github.com/labelluco/custodia (públic, AGPL-3.0). Cada
push a `main` el publica Cloudflare Pages a **https://custodia-territori.pages.dev/**:
compila `www/` amb `node eines/preparar-www.mjs && cp service-worker.js www/`
(la llista de fitxers és la del service worker) i publica només aquesta
carpeta. Cal pujar `NOM_CACHE` a `service-worker.js` quan canvien els fitxers.

## Llicència

Aquest projecte es distribueix sota la llicència **AGPL-3.0**. Vegeu el
fitxer [LICENSE](./LICENSE).

## Contribuir

Els suggeriments, issues i pull requests són benvinguts. Aquest és un
projecte petit, en fase de desenvolupament actiu, obert a la col·laboració
amb entitats de l'economia social i solidària interessades en la gestió
del territori.
