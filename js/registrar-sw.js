// Registra el service worker (si el navegador el suporta).
if ('serviceWorker' in navigator) {
  // Una versió nova del service worker s'activa de seguida (skipWaiting i
  // clients.claim), també amb la pàgina oberta: la pàgina continua amb el
  // codi vell, però el que es carrega després (mòduls o dades que encara no s'havien demanat) ja
  // ve de la versió nova, i les dues poden no encaixar (vist a Terra Sol el
  // 2026-10-17: "Cannot read properties of undefined (reading 'maxX')"). Per
  // això, quan canvia el service worker que controla la pàgina, es recarrega
  // una vegada. La primera instal·lació no compta: abans no hi havia cap
  // versió.
  const teniaVersio = Boolean(navigator.serviceWorker.controller);
  let recarregant = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!teniaVersio || recarregant) return;
    recarregant = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch((error) => {
      console.warn('No s\'ha pogut registrar el service worker:', error);
    });
  });
}
