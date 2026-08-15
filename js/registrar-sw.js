// Registra el service worker (si el navegador el suporta).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch((error) => {
      console.warn('No s\'ha pogut registrar el service worker:', error);
    });
  });
}
