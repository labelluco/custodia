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
- **Mapa i llistat**: totes les parcel·les es veuen sobre un mapa (amb un
  color segons l'índex de risc) i en una taula, amb accés directe al detall
  de cadascuna.
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
- **IDEE** (Infraestructura de Dades Espacials d'Espanya): Model Digital del
  Terreny, per al càlcul d'altitud/pendent/orientació.

Es va explorar també el **Mapa Forestal d'Espanya (MFE)** per obtenir el
tipus de vegetació de cada parcel·la, però el servei s'ha trobat
sistemàticament caigut; la funcionalitat es manté al codi
(`js/serveis/vegetacio.js`) però desconnectada, per si en el futur torna a
funcionar o es troba una font alternativa.

## Tecnologia

- JavaScript (mòduls ES natius, sense framework ni bundler)
- [Leaflet](https://leafletjs.com/) per als mapes, [proj4js](http://proj4js.org/)
  per a la conversió de coordenades (totes dues via CDN)
- IndexedDB per a l'emmagatzematge local
- PWA: `manifest.json` + `service-worker.js` per a instal·lació i ús offline
- Sistema de traduccions propi (`js/i18n.js`), sense dependències externes

## Estructura del repositori

```
custodia/
├── index.html            Pantalla d'inici: mapa + llistat de parcel·les
├── afegir.html            Formulari per afegir una nova parcel·la
├── detall.html            Detall d'una parcel·la (dades, risc, subparceles)
├── altitud.html            Càlcul d'altitud, pendent i orientació
├── manifest.json           Manifest de la PWA
├── service-worker.js       Cache per a ús offline
├── css/
│   └── estils.css
├── js/
│   ├── model/
│   │   └── parcela.js           Classe Parcela (dades pures)
│   ├── serveis/                  Consultes a serveis externs i lògica de negoci
│   │   ├── cadastre.js               Consulta al Cadastre (geometria, subparceles)
│   │   ├── ubicacions.js             Llistat de províncies/municipis
│   │   ├── altimetria.js             Altitud i pendent (IDEE)
│   │   ├── orientacio.js             Orientació mitjana
│   │   ├── risc.js                   Índex de risc d'incendi
│   │   ├── basedades.js              Accés a IndexedDB
│   │   ├── exportadorGpx.js          Exportació GPX
│   │   └── vegetacio.js              MFE (desconnectat, vegeu més amunt)
│   ├── geometria/                 Càlcul geomètric pur (sense IO)
│   │   ├── malla.js                  Generació de la malla de punts
│   │   └── gradient.js               Gradients (mètode de Horn)
│   ├── ui/                        Components d'interfície reutilitzables
│   │   ├── mapa.js                   Embolcall sobre Leaflet
│   │   ├── menu.js                   Menú de la capçalera (mòbil)
│   │   └── ajuda.js                  Icones d'ajuda amb explicació
│   ├── i18n.js / i18n/es.js       Sistema de traduccions
│   ├── inici.js                   Controlador de index.html
│   ├── afegir.js                  Controlador d'afegir.html
│   ├── detall.js                  Controlador de detall.html
│   ├── altitud.js                 Controlador d'altitud.html
│   └── registrar-sw.js            Registre del service worker
└── icones/                    Icones de la PWA
```

## Executar en local

Com que és una PWA sense backend, n'hi ha prou amb servir els fitxers
estàtics (obrir-los directament com a `file://` no permet registrar el
service worker). Per exemple, amb Python:

```bash
python3 -m http.server 8000
```

I obrir `http://localhost:8000` al navegador.

## Llicència

Aquest projecte es distribueix sota la llicència **AGPL-3.0**. Vegeu el
fitxer [LICENSE](./LICENSE).

## Contribuir

Els suggeriments, issues i pull requests són benvinguts. Aquest és un
projecte petit, en fase de desenvolupament actiu, obert a la col·laboració
amb entitats de l'economia social i solidària interessades en la gestió
del territori.
