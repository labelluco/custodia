# Custòdia — instruccions per a agents

## Context privat
Abans de començar qualsevol tasca: si no existeix ../notes-abelluco, clona el repositori privat
notes-abelluco al costat d'aquest; fes-hi git pull i llegeix normes-comunes.md i projectes/custodia.md.
Cada vegada que acabis una tasca: si s'han pres decisions rellevants, actualitza projectes/custodia.md,
aquest AGENTS.md i DECISIONS.md, i fes commit i push dels dos repositoris.

## Què és
Gestió de finques rústiques: parcel·les cadastrals, agrupacions i geometries dibuixades, amb altimetria, pendent,
orientació i un índex de risc d'incendi comparatiu. PWA lliure (AGPL-3.0), repositori públic.

## Estructura
- Una pàgina HTML per pantalla (`parceles.html`, `detall*.html`, `afegir*.html`, `altitud*.html`...) i un controlador per pàgina a `js/<pàgina>.js`
- `js/model/` (Geometria → Parcela, Agrupacio), `js/serveis/` (basedades, altimetria, orientació, risc...), `js/geometria/`, `js/ui/`
- `manifest.json`, `service-worker.js` (llista de fitxers i `NOM_CACHE`)
- `nucli/` és una CÒPIA del repositori nucli (Terra nucli): no s'edita mai aquí. Els canvis es fan a ../nucli
  i es copien amb `./actualitzar-nucli.sh` (vegeu «Canvis que afecten el nucli» a ../notes-abelluco/normes-comunes.md).

## Normes
- Codi simple, llegible i fàcil de mantenir. Sense dependències noves sense preguntar.
- Textos de la interfície en català, amb traduccions a castellà i anglès (`js/i18n/`; el text català és la clau).
- No toquis fitxers fora dels que demana la tasca.
- Mai escriguis claus, contrasenyes ni tokens en cap fitxer.
- Cap canvi es fusiona a main sense l'OK de Mario.
- Quan canviïn els fitxers publicats, puja `NOM_CACHE` a `service-worker.js`.

## Compilar i provar
```
node nucli/eines/servidor.mjs 8000
node nucli/eines/verificar.mjs
```
No hi ha proves en Node. Desenvolupament a Windows (CRLF).

## Delegar i auditar
Segueix les seccions "Delegar a Codex" i "Auditoria creuada" de ../notes-abelluco/normes-comunes.md:
delega per iniciativa pròpia les subtasques aïllables, registra-ho a delegacions.md i demana auditoria
a Codex (només lectura) abans de publicar o en canvis delicats.

## Publicar
Cada push a `main` publica la web a Cloudflare Pages: no facis push sense l'OK de Mario.
