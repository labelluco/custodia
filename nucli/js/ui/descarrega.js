// Desa un fitxer generat al dispositiu.
//
//  - Al navegador: un enllaç temporal amb "download".
//  - A l'app d'Android (Capacitor): l'enllaç no fa res dins del WebView, així
//    que el fitxer s'escriu a la cache de l'app (connector Filesystem) i
//    s'obre el diàleg de compartir d'Android (connector Share), des d'on es
//    pot desar a Baixades o a Drive, obrir amb un visor de PDF, enviar...
//    Sense bundler: es crida pel pont natiu (window.Capacitor.nativePromise),
//    com el GPS de Terra Rutes. Si l'app no porta aquests connectors, es fa
//    servir el camí del navegador.

const CANCELAT = /cancel/i;

/**
 * @param {BlobPart} contingut
 * @param {string} nomFitxer
 * @param {string} tipus Tipus MIME
 * @returns {Promise<void>}
 */
export async function descarregarFitxer(contingut, nomFitxer, tipus) {
  const blob = new Blob([contingut], { type: tipus });
  if (potCompartirNatiu()) {
    await desarICompartir(blob, nomFitxer);
    return;
  }
  const url = URL.createObjectURL(blob);
  const enllac = document.createElement('a');
  enllac.href = url;
  enllac.download = nomFitxer;
  document.body.appendChild(enllac);
  enllac.click();
  enllac.remove();
  // Es deixa un marge abans d'alliberar l'URL: alguns navegadors
  // comencen la descàrrega de manera asíncrona.
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function potCompartirNatiu() {
  const capacitor = globalThis.Capacitor;
  return Boolean(
    capacitor?.isNativePlatform?.() &&
      capacitor.isPluginAvailable?.('Filesystem') &&
      capacitor.isPluginAvailable?.('Share')
  );
}

async function desarICompartir(blob, nomFitxer) {
  const { nativePromise } = globalThis.Capacitor;
  // A la cache: Android la pot buidar quan vulgui, i és el lloc pensat per a
  // fitxers que només cal que existeixin mentre es comparteixen.
  const { uri } = await nativePromise('Filesystem', 'writeFile', {
    path: nomFitxer,
    data: await blobABase64(blob),
    directory: 'CACHE',
  });
  try {
    await nativePromise('Share', 'share', { title: nomFitxer, files: [uri] });
  } catch (error) {
    // Tancar el diàleg sense triar res no és cap error.
    if (!CANCELAT.test(error?.message ?? '')) throw error;
  }
}

/** Contingut d'un Blob en base64 (sense el prefix "data:...;base64,"). */
function blobABase64(blob) {
  return new Promise((resoldre, rebutjar) => {
    const lector = new FileReader();
    lector.onload = () => resoldre(String(lector.result).split(',')[1] ?? '');
    lector.onerror = () => rebutjar(lector.error);
    lector.readAsDataURL(blob);
  });
}

/** Nom de fitxer segur a partir d'un text qualsevol. */
export function nomFitxerSegur(text) {
  return (
    String(text)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'model'
  );
}
