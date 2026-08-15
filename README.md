# Custòdia

Eina de gestió forestal per a propietaris i entitats locals.

Custòdia és una PWA (Progressive Web App) de codi lliure que permet a
propietàries i propietaris de finques rústiques registrar les seves
parcel·les sobre un mapa, indicant-ne l'ús (agrícola, forestal, pastura...)
i el risc d'incendi. L'objectiu és facilitar una visió clara del territori
propi i, en el futur, donar suport a entitats gestores de bancs de terres
locals a l'hora de prioritzar cessions segons risc i impacte.

## Estat del projecte

Versió MVP (Minimum Viable Product). Funcionalitats mínimes:

- Registrar una parcel·la (polígon, parcel·la, població) consultant el
  Cadastre per obtenir-ne el perímetre.
- Assignar manualment l'ús i el risc d'incendi de cada parcel·la.
- Veure totes les parcel·les sobre un mapa (Leaflet) i en un llistat.
- Consultar el detall d'una parcel·la concreta.

Totes les dades es guarden **localment al navegador** (IndexedDB) — no hi
ha cap servidor ni base de dades compartida en aquesta versió.

## Tecnologia

- JavaScript (mòduls ES natius, sense framework ni bundler)
- [Leaflet](https://leafletjs.com/) per als mapes (via CDN)
- IndexedDB per a l'emmagatzematge local
- PWA: `manifest.json` + `service-worker.js` per a instal·lació i ús offline
- Consulta al Cadastre mitjançant el servei WFS de la Sede Electrónica del
  Catastro (dades obertes)

## Estructura del repositori

```
custodia/
├── index.html          Pantalla d'inici: mapa + llistat de parcel·les
├── afegir.html          Formulari per afegir una nova parcel·la
├── detall.html          Detall d'una parcel·la
├── manifest.json        Manifest de la PWA
├── service-worker.js    Cache bàsica per a ús offline
├── css/
│   └── estils.css
├── js/
│   ├── model/
│   │   └── parcela.js       Classe Parcela (dades pures)
│   ├── serveis/
│   │   ├── cadastre.js      Consulta al WFS del Cadastre
│   │   └── basedades.js     Accés a IndexedDB
│   ├── ui/
│   │   └── mapa.js          Classe Mapa (embolcall sobre Leaflet)
│   ├── inici.js             Controlador de index.html
│   ├── afegir.js            Controlador d'afegir.html
│   └── detall.js            Controlador de detall.html
└── icones/               Icones de la PWA
```

## Executar en local

Com que és una PWA sense backend, n'hi ha prou amb servir els fitxers
estàtics. Per exemple, amb Python:

```bash
python3 -m http.server 8000
```

I obrir `http://localhost:8000` al navegador.

## Llicència

Aquest projecte es distribueix sota la llicència **AGPL-3.0**. Vegeu el
fitxer [LICENSE](./LICENSE).

## Contribuir

Els suggeriments, issues i pull requests són benvinguts. Aquest és un
projecte petit, en fase inicial, obert a la col·laboració amb entitats de
l'economia social i solidària interessades en la gestió del territori.
