// Servidor estàtic mínim per provar una app en local (sense dependències).
// Ús, des de la carpeta de l'app:   node nucli/eines/servidor.mjs [port]
// i obrir http://localhost:8000 (localhost permet registrar el service worker).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, normalize, extname } from 'node:path';

const PORT = Number(process.argv[2] ?? 8000);
const ARREL = process.cwd();
const TIPUS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

createServer(async (peticio, resposta) => {
  try {
    const cami = decodeURIComponent(new URL(peticio.url, 'http://localhost').pathname);
    let fitxer = normalize(join(ARREL, cami));
    if (!fitxer.startsWith(ARREL)) throw new Error('fora de l\'arrel');
    if ((await stat(fitxer)).isDirectory()) fitxer = join(fitxer, 'index.html');
    const contingut = await readFile(fitxer);
    resposta.writeHead(200, { 'Content-Type': TIPUS[extname(fitxer)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
    resposta.end(contingut);
  } catch {
    resposta.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    resposta.end('No trobat');
  }
})
  .on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`El port ${PORT} ja està en ús (potser hi ha un altre servidor obert).`);
      console.error(`Tanca'l o fes servir un altre port:  node nucli/eines/servidor.mjs ${PORT + 1}`);
      process.exit(1);
    }
    throw error;
  })
  .listen(PORT, () => {
    console.log(`Servint ${ARREL} a http://localhost:${PORT}`);
    if (!existsSync(join(ARREL, 'index.html'))) {
      console.warn('Avís: aquesta carpeta no té index.html. Executa-ho des de la carpeta de l\'app (p. ex. terra3d).');
    }
  });
