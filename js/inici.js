// Controlador de index.html: mapa + llistat.
import { BaseDades } from './serveis/basedades.js';
import { Mapa } from './ui/mapa.js';

async function iniciar() {
  const bd = await BaseDades.obrir();
  const mapa = new Mapa('mapa');
  const contenidorLlistat = document.getElementById('llistat-parceles');
  const missatgeBuit = document.getElementById('missatge-buit');

  const parceles = await bd.llegirTotesLesParceles();

  if (parceles.length === 0) {
    missatgeBuit.hidden = false;
    return;
  }
  missatgeBuit.hidden = true;

  contenidorLlistat.innerHTML = '';

  for (const parcela of parceles) {
    mapa.afegirParcela(parcela, (p) => obrirDetall(p.id));

    const element = document.createElement('li');
    element.className = `item-parcela risc-${parcela.risc}`;
    element.innerHTML = `
      <span class="item-parcela__poblacio">${parcela.poblacio}</span>
      <span class="item-parcela__us">${parcela.us}</span>
      <span class="item-parcela__risc">Risc: ${parcela.risc}</span>
    `;
    element.addEventListener('click', () => obrirDetall(parcela.id));
    contenidorLlistat.appendChild(element);
  }

  mapa.ajustarVistaATotes();
}

function obrirDetall(id) {
  window.location.href = `detall.html?id=${encodeURIComponent(id)}`;
}

iniciar().catch((error) => {
  console.error(error);
  alert('No s\'han pogut carregar les parcel·les. Revisa la consola per a més detalls.');
});
