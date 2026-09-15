// Controlador de copia-seguretat.html: exportar totes les dades a CSV,
// o importar-les (substituint-les) a partir de fitxers CSV.
import { ExportadorDades } from './serveis/exportadorDades.js';
import { t, aplicarTraduccions, inicialitzarSelectorIdioma } from './i18n.js';
import { inicialitzarMenu } from './ui/menu.js';

aplicarTraduccions();
inicialitzarSelectorIdioma('selector-idioma');
inicialitzarMenu();

const botoExportar = document.getElementById('boto-exportar');
const campFitxers = document.getElementById('fitxers-importar');
const botoImportar = document.getElementById('boto-importar');
const missatgeEstat = document.getElementById('missatge-estat');

botoExportar.addEventListener('click', async () => {
  botoExportar.disabled = true;
  try {
    await ExportadorDades.exportarTot();
    mostrarEstat(t('Fitxers exportats correctament.'), 'exit');
  } catch (error) {
    console.error(error);
    mostrarEstat(`${t('No s\'ha pogut exportar:')} ${error.message}`, 'error');
  } finally {
    botoExportar.disabled = false;
  }
});

botoImportar.addEventListener('click', async () => {
  const fitxers = campFitxers.files;

  if (fitxers.length === 0) {
    mostrarEstat(t('Cal triar almenys un fitxer CSV.'), 'error');
    return;
  }

  const confirmat = confirm(
    t('Segur que vols importar aquests fitxers? Les dades corresponents que ja tinguis es perdran i se substituiran per les del fitxer. Aquesta acció no es pot desfer.')
  );
  if (!confirmat) return;

  botoImportar.disabled = true;
  try {
    const restaurats = await ExportadorDades.importar(fitxers);
    if (restaurats.length === 0) {
      mostrarEstat(
        t('Cap dels fitxers triats s\'ha reconegut (els noms han de ser parceles.csv, subparceles.csv, agrupacions.csv o geometries.csv).'),
        'error'
      );
      return;
    }
    mostrarEstat(`${t('Importat correctament:')} ${restaurats.join(', ')}.`, 'exit');
    campFitxers.value = '';
  } catch (error) {
    console.error(error);
    mostrarEstat(`${t('No s\'ha pogut importar:')} ${error.message}`, 'error');
  } finally {
    botoImportar.disabled = false;
  }
});

function mostrarEstat(text, tipus) {
  missatgeEstat.textContent = text;
  missatgeEstat.className = `missatge-estat missatge-estat--${tipus}`;
  missatgeEstat.hidden = false;
}
