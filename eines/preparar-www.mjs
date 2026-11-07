// Copia els fitxers de l'app a www/, que és el que Capacitor posa dins de
// l'APK (webDir de capacitor.config.json).
//
// Per què una carpeta a part i no l'arrel: Capacitor copia tot el webDir a
// android/app/src/main/assets/public, i l'arrel conté android/ mateix,
// node_modules/, proves/... La llista de fitxers és la del service worker
// (FITXERS_PER_CACHE): és exactament el que forma l'app publicada, i el
// verificador ja comprova que hi sigui tot.
//
// Ús, des de l'arrel de l'app:   node eines/preparar-www.mjs
import { readFileSync, rmSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const sw = readFileSync('service-worker.js', 'utf8');
const llista = [...(sw.match(/FITXERS_PER_CACHE\s*=\s*\[([\s\S]*?)\]/)?.[1] ?? '').matchAll(/'\.\/([^']+)'/g)].map((m) => m[1]);
if (!llista.length) throw new Error('No trobo FITXERS_PER_CACHE a service-worker.js');

rmSync('www', { recursive: true, force: true });
for (const fitxer of llista) {
  const desti = join('www', fitxer);
  mkdirSync(dirname(desti), { recursive: true });
  copyFileSync(fitxer, desti);
}
console.log(`www/: ${llista.length} fitxers copiats`);
