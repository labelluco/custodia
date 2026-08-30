// Menú de la capçalera: en pantalla ampla es mostra sencer (com sempre);
// en pantalla estreta, es col·lapsa darrere d'un botó d'hamburguesa
// (les regles de quan es mostra un o l'altre són a css/estils.css,
// amb una media query -- aquí només es gestiona obrir/tancar).

export function inicialitzarMenu() {
  const boto = document.getElementById('boto-menu');
  const menu = document.getElementById('menu-principal');
  if (!boto || !menu) return;

  boto.addEventListener('click', () => {
    const obert = menu.classList.toggle('menu--obert');
    boto.setAttribute('aria-expanded', obert ? 'true' : 'false');
  });

  // Tocar fora del menú (o d'un enllaç de dins) el tanca.
  document.addEventListener('click', (event) => {
    if (!menu.classList.contains('menu--obert')) return;
    if (menu.contains(event.target) || boto.contains(event.target)) return;
    menu.classList.remove('menu--obert');
    boto.setAttribute('aria-expanded', 'false');
  });
}
