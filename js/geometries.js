// Controlador de geometries.html: mapa + llistat, igual que
// parceles.js però amb geometries (sense dades cadastrals: només nom
// i risc, sense polígon/parcela/ús/superfície). Amb cerca i ordenació.
import { BaseDades } from './serveis/basedades.js';
import { Mapa } from './ui/mapa.js';
import { ServeiRisc } from './serveis/risc.js';
import { inicialitzarOrdenacio } from './ui/ordenacio.js';
import { elementLlista } from './ui/llista.js';
import { avisar } from './ui/dialegs.js';
import { t, aplicarTraduccions, inicialitzarSelectorIdioma } from './i18n.js';
import { inicialitzarMenu } from './ui/menu.js';

aplicarTraduccions();
inicialitzarSelectorIdioma('selector-idioma');
inicialitzarMenu();

let termeCerca = '';

async function iniciar() {
  const bd = await BaseDades.obrir();
  const contenidorLlistat = document.getElementById('llistat-geometries');
  const missatgeBuit = document.getElementById('missatge-buit');
  const eines = document.getElementById('eines-llistat');
  const missatgeSenseResultats = document.getElementById('missatge-sense-resultats');
  const campCerca = document.getElementById('cerca-geometries');

  // El mapa és el fons de la pantalla: es mostra sempre.
  const mapa = new Mapa('mapa');
  const geometries = await bd.llegirTotesLesGeometries();

  if (geometries.length === 0) {
    missatgeBuit.hidden = false;
    eines.hidden = true;
    return;
  }
  missatgeBuit.hidden = true;

  const files = [];
  for (const geometria of geometries) {
    // Reutilitzat tal qual de ServeiRisc: encara que és pensat per a
    // parcel·les, funciona igual per a geometries (bd.llegirSubparcelesDe
    // hi retorna una llista buida, i el càlcul de risc ja sap
    // redistribuir els pesos quan falta la vegetació).
    const { color, index } = await ServeiRisc.colorIIndexDe(bd, geometria);
    files.push({ geometria, color, index });
  }

  function coincideix(fila) {
    if (!termeCerca) return true;
    return fila.geometria.nom.toLowerCase().includes(termeCerca);
  }

  function pintar() {
    const filesVisibles = files.filter(coincideix);
    missatgeSenseResultats.hidden = filesVisibles.length > 0;

    mapa.buidar();
    for (const { geometria, color } of filesVisibles) {
      mapa.afegirParcela(geometria, (g) => obrirDetall(g.id), color);
    }
    if (filesVisibles.length > 0) {
      mapa.ajustarVistaATotes();
    }

    contenidorLlistat.replaceChildren(
      ...filesVisibles.map(({ geometria, color, index }) =>
        elementLlista({
          titol: geometria.nom,
          risc: { color, index },
          href: `detall-geometria.html?id=${encodeURIComponent(geometria.id)}`,
          onSeleccionar: () => mapa.ressaltarParcela(geometria.id),
        })
      )
    );
  }

  inicialitzarOrdenacio(
    document.getElementById('ordre-geometries'),
    document.getElementById('ordre-geometries-sentit'),
    files,
    {
      nom: (f) => f.geometria.nom,
      risc: (f) => f.index,
    },
    pintar
  );

  campCerca.addEventListener('input', () => {
    termeCerca = campCerca.value.trim().toLowerCase();
    pintar();
  });

  pintar();
}

function obrirDetall(id) {
  window.location.href = `detall-geometria.html?id=${encodeURIComponent(id)}`;
}

iniciar().catch((error) => {
  console.error(error);
  avisar(t('No s\'han pogut carregar les geometries. Revisa la consola per a més detalls.'));
});
