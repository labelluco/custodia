// Controlador d'agrupacions.html: llistat de les agrupacions ja
// creades, amb el mateix estil de taula que el llistat de parcel·les
// (nom, nombre de parcel·les, superfície total) -- no s'hi repeteix la
// població de cada parcel·la (si una agrupació en té deu del mateix
// municipi, sortiria deu vegades i no aportaria res).
import { BaseDades } from './serveis/basedades.js';
import { t, aplicarTraduccions, inicialitzarSelectorIdioma } from './i18n.js';
import { inicialitzarMenu } from './ui/menu.js';

aplicarTraduccions();
inicialitzarSelectorIdioma('selector-idioma');
inicialitzarMenu();

const missatgeBuit = document.getElementById('missatge-buit');
const llistatAgrupacions = document.getElementById('llistat-agrupacions');

async function iniciar() {
  const bd = await BaseDades.obrir();
  const agrupacions = await bd.llegirTotesLesAgrupacions();

  if (agrupacions.length === 0) {
    missatgeBuit.hidden = false;
    return;
  }

  // Es necessita la superfície de cada parcel·la per sumar-la -- es
  // llegeixen totes un sol cop i s'indexen per id, en lloc de
  // consultar-les una a una per cada agrupació.
  const totesLesParceles = await bd.llegirTotesLesParceles();
  const parcelaPerId = new Map(totesLesParceles.map((p) => [p.id, p]));

  llistatAgrupacions.innerHTML = agrupacions
    .map((agrupacio) => {
      const parceles = agrupacio.parcelaIds.map((id) => parcelaPerId.get(id)).filter(Boolean);
      const superficieTotal = parceles.reduce((acc, p) => acc + (p.superficie ?? 0), 0);

      return `
        <tr>
          <td>${agrupacio.nom}</td>
          <td>${agrupacio.parcelaIds.length}</td>
          <td>${superficieTotal ? `${superficieTotal} m²` : '—'}</td>
          <td><a href="detall-agrupacio.html?id=${encodeURIComponent(agrupacio.id)}" class="boto-taula">${t('Detall')}</a></td>
        </tr>
      `;
    })
    .join('');
}

iniciar().catch((error) => {
  console.error(error);
});
