// Controlador de index.html: la pantalla d'inici (menú d'icones). No té
// mapa ni llistat -- això viu ara a parceles.js -- només inicialitza el
// que comparteixen totes les pàgines.
import { aplicarTraduccions, inicialitzarSelectorIdioma } from './i18n.js';
import { inicialitzarMenu } from './ui/menu.js';

aplicarTraduccions();
inicialitzarSelectorIdioma('selector-idioma');
inicialitzarMenu();
