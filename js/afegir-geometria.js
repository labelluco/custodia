// Controlador d'afegir-geometria.html: dibuixar un perímetre a mà,
// clicant punts sobre el mapa, sense cap consulta al Cadastre -- útil
// per a finques o zones sense referència cadastral coneguda, o
// simplement per delimitar una àrea d'interès qualsevol.
import { BaseDades } from './serveis/basedades.js';
import { Mapa } from './ui/mapa.js';
import { Geometria } from './model/geometria.js';
import { t, aplicarTraduccions, inicialitzarSelectorIdioma } from './i18n.js';
import { inicialitzarMenu } from './ui/menu.js';

aplicarTraduccions();
inicialitzarSelectorIdioma('selector-idioma');
inicialitzarMenu();

const botoDesfer = document.getElementById('boto-desfer');
const botoNetejar = document.getElementById('boto-netejar');
const campNom = document.getElementById('nom-geometria');
const botoGuardar = document.getElementById('boto-guardar');
const missatgeEstat = document.getElementById('missatge-estat');

// Array de [lat, lng], en l'ordre en què s'han clicat.
let punts = [];
let mapa;
let capaPreview;

function iniciar() {
  mapa = new Mapa('mapa-geometria');
  capaPreview = L.layerGroup().addTo(mapa.leafletMap);

  mapa.leafletMap.on('click', (event) => {
    punts.push([event.latlng.lat, event.latlng.lng]);
    actualitzarBotons();
    pintarPreview();
  });
}

function actualitzarBotons() {
  botoDesfer.disabled = punts.length === 0;
  botoNetejar.disabled = punts.length === 0;
}

/** Repinta el perímetre en curs: un punt sol, una línia (2 punts), o un polígon (3 o més). */
function pintarPreview() {
  capaPreview.clearLayers();
  if (punts.length === 0) return;

  if (punts.length >= 2) {
    const forma =
      punts.length === 2
        ? L.polyline(punts, { color: '#396a49', weight: 3 })
        : L.polygon(punts, { color: '#396a49', weight: 3, fillOpacity: 0.25 });
    forma.addTo(capaPreview);
  }

  punts.forEach((punt, index) => {
    L.circleMarker(punt, {
      radius: 5,
      color: '#396a49',
      weight: 2,
      fillColor: 'white',
      fillOpacity: 1,
    })
      .bindTooltip(`${index + 1}`)
      .addTo(capaPreview);
  });
}

botoDesfer.addEventListener('click', () => {
  punts.pop();
  actualitzarBotons();
  pintarPreview();
});

botoNetejar.addEventListener('click', () => {
  punts = [];
  actualitzarBotons();
  pintarPreview();
});

botoGuardar.addEventListener('click', async () => {
  const nom = campNom.value.trim();

  if (!nom) {
    mostrarEstat(t('Cal indicar un nom per a la geometria.'), 'error');
    return;
  }
  if (punts.length < 3) {
    mostrarEstat(t('Calen almenys 3 punts per definir un perímetre.'), 'error');
    return;
  }

  botoGuardar.disabled = true;
  try {
    const bd = await BaseDades.obrir();
    const geometria = new Geometria({ nom, coordenades: punts, dataCreacio: new Date().toISOString() });
    const id = await bd.afegirGeometria(geometria);
    window.location.href = `detall-geometria.html?id=${encodeURIComponent(id)}`;
  } catch (error) {
    console.error(error);
    mostrarEstat(`${t('No s\'ha pogut desar la geometria:')} ${error.message}`, 'error');
  } finally {
    botoGuardar.disabled = false;
  }
});

function mostrarEstat(text, tipus) {
  missatgeEstat.textContent = text;
  missatgeEstat.className = `missatge-estat missatge-estat--${tipus}`;
  missatgeEstat.hidden = false;
}

iniciar();
