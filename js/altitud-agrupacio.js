// Controlador d'altitud-agrupacio.html. Mostra, combinats en un sol
// mapa, els punts d'altitud ja calculats i desats de cada parcel·la de
// l'agrupació (vegeu Parcela.puntsAltitud) -- no torna a consultar
// l'IDEE ni recalcula res: només combina el que ja hi ha. El resum
// numèric surt del mateix servei d'agregació que fa servir
// detall-agrupacio.js.
import { BaseDades } from './serveis/basedades.js';
import { Mapa } from './ui/mapa.js';
import { ServeiOrientacio } from './serveis/orientacio.js';
import { calcularAgregatAgrupacio } from './serveis/agregacioAgrupacio.js';
import { iconaAjuda } from './ui/ajuda.js';
import { t, aplicarTraduccions, inicialitzarSelectorIdioma } from './i18n.js';
import { inicialitzarMenu } from './ui/menu.js';

aplicarTraduccions();
inicialitzarSelectorIdioma('selector-idioma');
inicialitzarMenu();

const contingutResum = document.getElementById('contingut-resum-agrupacio-altitud');

async function iniciar() {
  const parametres = new URLSearchParams(window.location.search);
  const id = parametres.get('id');

  if (!id) {
    contingutResum.textContent = t('No s\'ha indicat cap agrupació.');
    return;
  }

  const bd = await BaseDades.obrir();
  const agrupacio = await bd.llegirAgrupacio(id);

  if (!agrupacio) {
    contingutResum.textContent = t('No s\'ha trobat aquesta agrupació.');
    return;
  }

  document.title = `Custòdia — ${t('Altimetria')} (${agrupacio.nom})`;
  document.getElementById('enllac-tornar').href = `detall-agrupacio.html?id=${encodeURIComponent(id)}`;
  document.getElementById('subtitol-pagina').textContent = agrupacio.nom;

  const parceles = (await Promise.all(agrupacio.parcelaIds.map((pid) => bd.llegirParcela(pid)))).filter(
    Boolean
  );

  const mapa = new Mapa('mapa-agrupacio-altitud');
  for (const parcela of parceles) {
    mapa.afegirParcela(parcela);
    if (parcela.puntsAltitud?.length > 0) {
      pintarPunts(mapa, parcela.puntsAltitud, parcela.metodeAltitud);
    }
  }
  mapa.ajustarVistaATotes();

  const agregat = await calcularAgregatAgrupacio(bd, parceles);
  pintarResum(agregat);
}

/** Igual que a altitud.js: tria la funció de pintat segons el mètode amb què es va calcular cada parcel·la. */
function pintarPunts(mapa, punts, metode) {
  if (metode === 'vertexs') {
    mapa.afegirVertexsAmbAltitud(
      punts.map((p) => p.coordenades),
      punts.map((p) => p.altitud)
    );
  } else {
    mapa.afegirPuntsAmbOrientacio(
      punts.map((p) => ({
        ...p,
        etiqueta: p.orientacio == null ? null : t(ServeiOrientacio.etiquetaBruixola(p.orientacio)),
      }))
    );
  }
}

function pintarResum(agregat) {
  if (!agregat.ok) {
    const enllacos = agregat.senseCalcular
      .map(
        (p) =>
          `<a href="altitud.html?id=${encodeURIComponent(p.id)}">${p.poblacio} (${p.poligon}/${p.parcelaCadastral})</a>`
      )
      .join(', ');
    contingutResum.innerHTML = `
      <p>
        ${t('Cal calcular l\'altitud amb el mètode de malla per a totes les parcel·les de l\'agrupació. Falta per a:')}
        ${enllacos}.
      </p>
    `;
    return;
  }

  const ajudaPendent = iconaAjuda(
    t('Inclinació mitjana del terreny, calculada a partir del model digital d\'elevacions de l\'IDEE (vèrtexs del perímetre o una malla de punts interiors).')
  );
  const ajudaOrientacio = iconaAjuda(
    t('Direcció cap on "mira" el pendent del terreny. Només es calcula amb el mètode de malla, no amb els vèrtexs del perímetre.')
  );

  contingutResum.innerHTML = `
    <dl class="fitxa-parcela">
      <dt>${t('Altitud mínima')}</dt><dd>${agregat.altitudMinima.toFixed(0)} m</dd>
      <dt>${t('Altitud màxima')}</dt><dd>${agregat.altitudMaxima.toFixed(0)} m</dd>
      <dt>${t('Desnivell')}</dt><dd>${agregat.desnivell.toFixed(0)} m</dd>
      <dt>${t('Pendent mitjà')}${ajudaPendent}</dt><dd>${agregat.pendentMitja.toFixed(1)} %</dd>
      <dt>${t('Orientació mitjana')}${ajudaOrientacio}</dt><dd>${agregat.orientacioMitjana.toFixed(0)}° (${t(ServeiOrientacio.etiquetaBruixola(agregat.orientacioMitjana))})</dd>
    </dl>
  `;
}

iniciar().catch((error) => {
  console.error(error);
  contingutResum.textContent = t('No s\'ha pogut carregar l\'agrupació.');
});
