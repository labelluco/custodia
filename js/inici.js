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

    const fila = document.createElement('tr');
    fila.className = `fila-parcela risc-${parcela.risc}`;
    fila.dataset.id = parcela.id;
    fila.innerHTML = `
      <td>${parcela.poblacio}</td>
      <td>${parcela.poligon}</td>
      <td>${parcela.parcelaCadastral}</td>
      <td class="us">${parcela.us ?? '—'}</td>
    `;
    // Tocar el llistat ressalta la parcel·la al mapa (no obre el detall);
    // per al detall, cal tocar la parcel·la pintada al mapa.
    fila.addEventListener('click', () => {
      mapa.ressaltarParcela(parcela.id);

      const anteriorSeleccionada = contenidorLlistat.querySelector('.fila-parcela--seleccionada');
      anteriorSeleccionada?.classList.remove('fila-parcela--seleccionada');
      fila.classList.add('fila-parcela--seleccionada');
    });
    contenidorLlistat.appendChild(fila);
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
