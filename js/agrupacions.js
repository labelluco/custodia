// Controlador d'agrupacions.html. De moment és una pàgina de manteniment
// (la funcionalitat encara no està implementada) -- només inicialitza
// el que comparteixen totes les pàgines.
import { aplicarTraduccions, inicialitzarSelectorIdioma } from './i18n.js';
import { inicialitzarMenu } from './ui/menu.js';

aplicarTraduccions();
inicialitzarSelectorIdioma('selector-idioma');
inicialitzarMenu();
