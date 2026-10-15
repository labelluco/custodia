// Verificacions obligatòries de cada ronda (vegeu la skill de les apps):
//   1. node --check de tots els JS
//   2. claus i18n (data-i18n*, t('...')) creuades amb els diccionaris
//   3. fitxers reals vs. llista del service worker
//   4. recordatori de NOM_CACHE
//
// S'executa des de l'arrel de l'app:   node nucli/eines/verificar.mjs
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const arrel = process.cwd();
let errors = 0;
const error = (text) => {
  errors++;
  console.log(`  ✗ ${text}`);
};

// Fitxers que formen part de l'app publicada (no eines ni documentació).
const IGNORATS = /^(\.git|\.claude|node_modules|eines|nucli[\\/]eines|proves)([\\/]|$)|(^|[\\/])(README\.md|LLEGIU-ME\.\w+|LICENSE|VERSIO|\.gitignore|.*\.sh|.*\.mjs)$/;
function llistar(dir) {
  return readdirSync(dir).flatMap((nom) => {
    const cami = join(dir, nom);
    const rel = relative(arrel, cami);
    if (IGNORATS.test(rel)) return [];
    return statSync(cami).isDirectory() ? llistar(cami) : [rel.split(sep).join('/')];
  });
}
const fitxers = llistar(arrel);
const js = fitxers.filter((f) => f.endsWith('.js'));
const html = fitxers.filter((f) => f.endsWith('.html'));

console.log('1. Sintaxi JS');
for (const f of js) {
  const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
  if (r.status !== 0) error(`${f}\n${r.stderr}`);
}
console.log(`  ${js.length} fitxers comprovats`);

console.log('2. Traduccions');
const diccionaris = js.filter((f) => /i18n\/es\.js$/.test(f));
const diccionari = {};
for (const f of diccionaris) {
  const text = readFileSync(f, 'utf8');
  // Duplicats: un objecte JS amb claus repetides no dona error, només
  // es queda l'última -- s'han de buscar al text.
  const claus = [...text.matchAll(/^\s*(['"])((?:\\.|(?!\1).)*)\1\s*:/gm)].map((m) => m[2].replace(/\\(.)/g, '$1'));
  const vistes = new Set();
  for (const c of claus) {
    if (vistes.has(c) || c in diccionari) error(`clau duplicada a ${f}: "${c}"`);
    vistes.add(c);
  }
  Object.assign(diccionari, (await import(pathToFileURL(join(arrel, f)).href)).ES);
}
const usades = new Map();
const usar = (clau, on) => usades.set(clau, usades.get(clau) ?? on);
for (const f of html) {
  const text = readFileSync(f, 'utf8');
  for (const m of text.matchAll(/data-i18n(?:-placeholder|-title|-aria-label)?="([^"]*)"/g)) usar(m[1].replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&'), f);
}
for (const f of js) {
  const text = readFileSync(f, 'utf8');
  for (const m of text.matchAll(/\bt\(\s*(['"])((?:\\.|(?!\1).)*)\1\s*\)/g)) usar(m[2].replace(/\\(.)/g, '$1'), f);
}
for (const [clau, on] of usades) if (!(clau in diccionari)) error(`sense traducció (${on}): "${clau}"`);
const sobrants = Object.keys(diccionari).filter((c) => !usades.has(c));
console.log(`  ${usades.size} textos usats, ${Object.keys(diccionari).length} traduccions`);
if (sobrants.length) console.log(`  (info) traduccions no detectades en ús: ${sobrants.map((c) => `"${c}"`).join(', ')}`);

console.log('3. Service worker');
if (existsSync('service-worker.js')) {
  const sw = readFileSync('service-worker.js', 'utf8');
  const llista = [...(sw.match(/FITXERS_PER_CACHE\s*=\s*\[([\s\S]*?)\]/)?.[1] ?? '').matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]);
  const enSw = new Set(llista.filter((f) => f !== ''));
  for (const f of fitxers) if (f !== 'service-worker.js' && !enSw.has(f)) error(`no és a la llista del service worker: ${f}`);
  for (const f of enSw) if (!fitxers.includes(f)) error(`a la llista del service worker però no existeix: ${f}`);
  console.log(`4. NOM_CACHE actual: ${sw.match(/NOM_CACHE\s*=\s*'([^']+)'/)?.[1]} (puja'l si has canviat fitxers)`);
} else {
  console.log('  (sense service-worker.js)');
}

console.log(errors === 0 ? '\nTot correcte.' : `\n${errors} problema(es).`);
process.exit(errors === 0 ? 0 : 1);
