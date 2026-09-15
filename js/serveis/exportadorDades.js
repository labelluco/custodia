// Exportació i importació de totes les dades de l'app en format CSV --
// pensat com a còpia de seguretat (canviar de dispositiu, o simplement
// no perdre res en provar coses) i per poder-hi treballar amb un full
// de càlcul. Es generen quatre fitxers per separat (un per magatzem:
// parceles, subparceles, agrupacions, geometries), perquè les seves
// formes són massa diferents per encabir-les en un de sol sense
// forçar-ho.
//
// Els camps que no són text pla (coordenades, punts d'altimetria,
// llistes d'id) es guarden com a JSON dins la pròpia cel·la -- l'única
// manera de mantenir-ho tot en un format que qualsevol full de càlcul
// pugui obrir, sense perdre cap dada en arrodonir-la.
import { BaseDades } from './basedades.js';

// "numero"/"text" es converteixen amb Number()/tal qual; "json" es
// desa amb JSON.stringify i es torna a llegir amb JSON.parse.
const COLUMNES_PARCELA = {
  id: 'numero',
  nom: 'text',
  poligon: 'text',
  parcelaCadastral: 'text',
  poblacio: 'text',
  coordenades: 'json',
  referenciaCadastral: 'text',
  superficie: 'numero',
  us: 'text',
  provincia: 'text',
  codiProvincia: 'text',
  codiMunicipi: 'text',
  altitudMaxima: 'numero',
  altitudMinima: 'numero',
  desnivell: 'numero',
  pendentMitja: 'numero',
  orientacioMitjana: 'numero',
  dataCreacio: 'text',
  puntsAltitud: 'json',
  metodeAltitud: 'text',
};

const COLUMNES_GEOMETRIA = {
  id: 'numero',
  nom: 'text',
  coordenades: 'json',
  altitudMaxima: 'numero',
  altitudMinima: 'numero',
  desnivell: 'numero',
  pendentMitja: 'numero',
  orientacioMitjana: 'numero',
  dataCreacio: 'text',
  puntsAltitud: 'json',
  metodeAltitud: 'text',
};

const COLUMNES_SUBPARCELA = {
  id: 'numero',
  parcelaId: 'numero',
  cspr: 'text',
  ccc: 'text',
  dcc: 'text',
  ip: 'text',
  ssp: 'text',
};

const COLUMNES_AGRUPACIO = {
  id: 'numero',
  nom: 'text',
  parcelaIds: 'json',
};

function escaparCamp(valor) {
  if (valor === null || valor === undefined) return '';
  let text = typeof valor === 'object' ? JSON.stringify(valor) : String(valor);
  if (/[",\r\n]/.test(text)) {
    text = `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function generarCsv(columnes, registres) {
  const claus = Object.keys(columnes);
  const capcalera = claus.join(',');
  const linies = registres.map((registre) => claus.map((clau) => escaparCamp(registre[clau])).join(','));
  return [capcalera, ...linies].join('\r\n');
}

function descarregar(nomFitxer, contingut) {
  const blob = new Blob([contingut], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const enllac = document.createElement('a');
  enllac.href = url;
  enllac.download = nomFitxer;
  document.body.appendChild(enllac);
  enllac.click();
  enllac.remove();
  URL.revokeObjectURL(url);
}

/**
 * Analitzador de CSV senzill (gestiona camps entre cometes amb comes,
 * salts de línia i cometes escapades "") -- no hi ha cap dependència
 * externa nova per a això.
 */
function parsejarCsv(text) {
  const files = [];
  let fila = [];
  let camp = '';
  let dinsCometes = false;
  let i = 0;

  const acabarCamp = () => {
    fila.push(camp);
    camp = '';
  };
  const acabarFila = () => {
    acabarCamp();
    files.push(fila);
    fila = [];
  };

  while (i < text.length) {
    const c = text[i];

    if (dinsCometes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          camp += '"';
          i += 2;
          continue;
        }
        dinsCometes = false;
        i++;
        continue;
      }
      camp += c;
      i++;
      continue;
    }

    if (c === '"') {
      dinsCometes = true;
      i++;
    } else if (c === ',') {
      acabarCamp();
      i++;
    } else if (c === '\r') {
      i++;
    } else if (c === '\n') {
      acabarFila();
      i++;
    } else {
      camp += c;
      i++;
    }
  }
  if (camp !== '' || fila.length > 0) {
    acabarFila();
  }

  return files.filter((f) => f.length > 1 || f[0] !== '');
}

function convertirCamp(text, tipus) {
  if (text === '' || text === undefined) return null;
  if (tipus === 'numero') {
    const n = Number(text);
    return Number.isNaN(n) ? null : n;
  }
  if (tipus === 'json') {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
  return text;
}

/** Reconstrueix els registres tipats a partir del text en brut d'un CSV. */
function llegirRegistres(textCsv, columnes) {
  const files = parsejarCsv(textCsv);
  if (files.length === 0) return [];

  const capcalera = files[0];
  return files.slice(1).map((fila) => {
    const registre = {};
    capcalera.forEach((clau, index) => {
      const tipus = columnes[clau];
      if (!tipus) return; // columna desconeguda al fitxer, s'ignora
      registre[clau] = convertirCamp(fila[index] ?? '', tipus);
    });
    return registre;
  });
}

export const ExportadorDades = {
  /** Descarrega els quatre fitxers CSV (un per magatzem) amb totes les dades actuals. */
  async exportarTot() {
    const bd = await BaseDades.obrir();

    const parceles = await bd.llegirTotesLesParceles();
    descarregar('parceles.csv', generarCsv(COLUMNES_PARCELA, parceles));

    const subparceles = [];
    for (const parcela of parceles) {
      subparceles.push(...(await bd.llegirSubparcelesDe(parcela.id)));
    }
    descarregar('subparceles.csv', generarCsv(COLUMNES_SUBPARCELA, subparceles));

    const agrupacions = await bd.llegirTotesLesAgrupacions();
    descarregar('agrupacions.csv', generarCsv(COLUMNES_AGRUPACIO, agrupacions));

    const geometries = await bd.llegirTotesLesGeometries();
    descarregar('geometries.csv', generarCsv(COLUMNES_GEOMETRIA, geometries));
  },

  /**
   * Importa (i substitueix del tot) les dades a partir dels fitxers
   * seleccionats -- es reconeixen pel seu nom exacte (parceles.csv,
   * subparceles.csv, agrupacions.csv, geometries.csv); els altres
   * s'ignoren. Es poden seleccionar tots quatre alhora o només alguns.
   *
   * @param {FileList|File[]} fitxers
   * @returns {Promise<string[]>} noms dels magatzems que s'han restaurat
   */
  async importar(fitxers) {
    const bd = await BaseDades.obrir();
    const restaurats = [];

    for (const fitxer of fitxers) {
      const text = await fitxer.text();

      if (fitxer.name === 'parceles.csv') {
        await bd.substituirParceles(llegirRegistres(text, COLUMNES_PARCELA));
        restaurats.push('parceles');
      } else if (fitxer.name === 'subparceles.csv') {
        await bd.substituirSubparceles(llegirRegistres(text, COLUMNES_SUBPARCELA));
        restaurats.push('subparceles');
      } else if (fitxer.name === 'agrupacions.csv') {
        await bd.substituirAgrupacions(llegirRegistres(text, COLUMNES_AGRUPACIO));
        restaurats.push('agrupacions');
      } else if (fitxer.name === 'geometries.csv') {
        await bd.substituirGeometries(llegirRegistres(text, COLUMNES_GEOMETRIA));
        restaurats.push('geometries');
      }
    }

    return restaurats;
  },
};
