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

  // Grups desplegables (Parcel·les/Agrupacions/Geometries...): un clic
  // al seu botó obre o tanca el seu propi submenú, i tanca qualsevol
  // altre que estigués obert (només un desplegable obert alhora).
  const grups = menu.querySelectorAll('.menu__grup');
  grups.forEach((grup) => {
    const botoGrup = grup.querySelector('.menu__grup-boto');
    botoGrup.addEventListener('click', (event) => {
      event.stopPropagation();
      const jaEstavaObert = grup.classList.contains('menu__grup--obert');

      grups.forEach((altre) => {
        altre.classList.remove('menu__grup--obert');
        altre.querySelector('.menu__grup-boto').setAttribute('aria-expanded', 'false');
      });

      if (!jaEstavaObert) {
        grup.classList.add('menu__grup--obert');
        botoGrup.setAttribute('aria-expanded', 'true');
      }
    });
  });

  // Tocar fora del menú (o d'un enllaç de dins) el tanca.
  document.addEventListener('click', (event) => {
    grups.forEach((grup) => {
      if (grup.contains(event.target)) return;
      grup.classList.remove('menu__grup--obert');
      grup.querySelector('.menu__grup-boto').setAttribute('aria-expanded', 'false');
    });

    if (!menu.classList.contains('menu--obert')) return;
    if (menu.contains(event.target) || boto.contains(event.target)) return;
    menu.classList.remove('menu--obert');
    boto.setAttribute('aria-expanded', 'false');
  });
}
