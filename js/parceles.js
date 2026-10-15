// Controlador de parceles.html: mapa a pantalla completa + llistat al
// panell, amb cerca i ordenació.
import { BaseDades } from './serveis/basedades.js';
import { Mapa } from './ui/mapa.js';
import { ServeiRisc } from './serveis/risc.js';
import { inicialitzarOrdenacio } from './ui/ordenacio.js';
import { elementLlista, formatSuperficie } from './ui/llista.js';
import { avisar } from './ui/dialegs.js';
import { t, aplicarTraduccions, inicialitzarSelectorIdioma } from './i18n.js';
import { inicialitzarMenu } from './ui/menu.js';

aplicarTraduccions();
inicialitzarSelectorIdioma('selector-idioma');
inicialitzarMenu();

let termeCerca = '';

async function iniciar() {
  const bd = await BaseDades.obrir();
  const mapa = new Mapa('mapa');
  const contenidorLlistat = document.getElementById('llistat-parceles');
  const missatgeBuit = document.getElementById('missatge-buit');
  const eines = document.getElementById('eines-llistat');
  const missatgeSenseResultats = document.getElementById('missatge-sense-resultats');
  const campCerca = document.getElementById('cerca-parceles');

  const parceles = await bd.llegirTotesLesParceles();

  if (parceles.length === 0) {
    missatgeBuit.hidden = false;
    eines.hidden = true;
    return;
  }
  missatgeBuit.hidden = true;

  // Es calcula el color/índex de risc un sol cop per cada parcel·la, i
  // es guarda junt amb la resta de dades -- necessari per poder
  // reordenar-les i filtrar-les sense haver de tornar a calcular-ho
  // cada vegada.
  const files = [];
  for (const parcela of parceles) {
    const { color, index } = await ServeiRisc.colorIIndexDe(bd, parcela);
    files.push({ parcela, color, index });
  }

  /** Cert si la fila coincideix amb el terme de cerca actual (o si no hi ha cap cerca). */
  function coincideix(fila) {
    if (!termeCerca) return true;
    const { parcela } = fila;
    const text = [parcela.poblacio, parcela.poligon, parcela.parcelaCadastral, parcela.us]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return text.includes(termeCerca);
  }

  /**
   * Pinta mapa i llistat junts, a partir de l'ordre actual de "files" i
   * del terme de cerca vigent -- es crida de nou en reordenar o en
   * escriure a la cerca.
   */
  function pintar() {
    const filesVisibles = files.filter(coincideix);
    missatgeSenseResultats.hidden = filesVisibles.length > 0;

    mapa.buidar();
    for (const { parcela, color } of filesVisibles) {
      mapa.afegirParcela(parcela, (p) => obrirDetall(p.id), color);
    }
    if (filesVisibles.length > 0) {
      mapa.ajustarVistaATotes();
    }

    contenidorLlistat.replaceChildren(
      ...filesVisibles.map(({ parcela, color, index }) =>
        elementLlista({
          titol: `${parcela.poblacio} · ${parcela.poligon}/${parcela.parcelaCadastral}`,
          detall: [parcela.us, formatSuperficie(parcela.superficie)].filter(Boolean).join(' · '),
          risc: { color, index },
          href: `detall.html?id=${encodeURIComponent(parcela.id)}`,
          onSeleccionar: () => mapa.ressaltarParcela(parcela.id),
        })
      )
    );
  }

  inicialitzarOrdenacio(
    document.getElementById('ordre-parceles'),
    document.getElementById('ordre-parceles-sentit'),
    files,
    {
      poblacio: (f) => f.parcela.poblacio,
      poligon: (f) => f.parcela.poligon,
      parcela: (f) => f.parcela.parcelaCadastral,
      us: (f) => f.parcela.us,
      superficie: (f) => f.parcela.superficie,
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
  window.location.href = `detall.html?id=${encodeURIComponent(id)}`;
}

iniciar().catch((error) => {
  console.error(error);
  avisar(t('No s\'han pogut carregar les parcel·les. Revisa la consola per a més detalls.'));
});
