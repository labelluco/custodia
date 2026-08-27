// Consulta el llistat de províncies i, donada una província, el
// llistat dels seus municipis -- al mateix OVCCallejero.asmx que ja fem
// servir per a la resta de consultes al Cadastre (ConsultaProvincia i
// ConsultaMunicipio). Pensat perquè afegir.html pugui oferir
// desplegables en lloc de camps de text lliure, evitant errades
// tipogràfiques en escriure el nom de la província/municipi.
//
// AVÍS: l'estructura exacta de la resposta (noms dels elements XML) no
// s'ha pogut confirmar en directe -- es dedueix per analogia amb els
// camps que ja coneixem (cp/np per a codi/nom de província, cm/nm per
// a codi/nom de municipi, vistos a les respostes de Consulta_DNPPP).
// Cal validar-ho amb una resposta real i ajustar el parseig si cal,
// igual que en altres serveis d'aquest projecte.

const URL_CONSULTA_PROVINCIA =
  'https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC/OVCCallejero.asmx/ConsultaProvincia';
const URL_CONSULTA_MUNICIPI =
  'https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC/OVCCallejero.asmx/ConsultaMunicipio';

export class ServeiUbicacions {
  /** @returns {Promise<Array<{codi: string, nom: string}>>} Totes les províncies d'Espanya. */
  static async consultarProvincies() {
    const text = await ServeiUbicacions._peticio(URL_CONSULTA_PROVINCIA, 'consultar les províncies');
    const xml = ServeiUbicacions._parsejarXml(text);

    return Array.from(xml.querySelectorAll('prov'))
      .map((node) => ({
        codi: node.querySelector('cpine')?.textContent.trim(),
        nom: node.querySelector('np')?.textContent.trim(),
      }))
      .filter((p) => p.nom);
  }

  /**
   * @param {string} provincia Nom de la província (tal com el retorna consultarProvincies)
   * @returns {Promise<Array<{codi: string, nom: string}>>} Municipis d'aquella província.
   */
  static async consultarMunicipis(provincia) {
    if (!provincia) {
      throw new Error('ServeiUbicacions: cal indicar la província');
    }

    const params = new URLSearchParams({ Provincia: provincia, Municipio: '' });
    const url = `${URL_CONSULTA_MUNICIPI}?${params.toString()}`;

    const text = await ServeiUbicacions._peticio(url, 'consultar els municipis');
    const xml = ServeiUbicacions._parsejarXml(text);

    return Array.from(xml.querySelectorAll('muni'))
      .map((node) => ({
        codi: node.querySelector('cm')?.textContent.trim(),
        nom: node.querySelector('nm')?.textContent.trim(),
      }))
      .filter((m) => m.nom);
  }

  static async _peticio(url, descripcio) {
    let resposta;
    try {
      resposta = await fetch(url);
    } catch (error) {
      throw new Error(`ServeiUbicacions: no s'ha pogut ${descripcio} (${error.message})`);
    }
    if (!resposta.ok) {
      throw new Error(`ServeiUbicacions: el Cadastre ha retornat un error en ${descripcio} (${resposta.status})`);
    }
    return resposta.text();
  }

  static _parsejarXml(text) {
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'application/xml');
    if (xml.querySelector('parsererror')) {
      throw new Error('ServeiUbicacions: resposta del Cadastre no interpretable');
    }
    return xml;
  }
}
