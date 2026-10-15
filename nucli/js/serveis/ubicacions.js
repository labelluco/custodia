// Llistat de províncies i, donada una província, dels seus municipis --
// per oferir desplegables en lloc de text lliure. Ve de Custòdia.
//
// Estructura de la resposta confirmada amb dades reals el 2026-10-15:
// ConsultaProvincia -> <prov><cpine/><np/></prov>
// ConsultaMunicipio -> <muni><nm/><locat><cd/><cmc/></locat><loine><cp/><cm/></loine></muni>

const URL_CALLEJERO = 'https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC/OVCCallejero.asmx';

const perNom = (node, nom) => Array.from(node.getElementsByTagNameNS('*', nom));
const textDe = (node, nom) => perNom(node, nom)[0]?.textContent.trim() ?? null;

export class ServeiUbicacions {
  /** @returns {Promise<Array<{codi: string, nom: string}>>} */
  static async consultarProvincies() {
    const xml = await ServeiUbicacions._xml(`${URL_CALLEJERO}/ConsultaProvincia`, 'consultar les províncies');
    return perNom(xml, 'prov')
      .map((node) => ({ codi: textDe(node, 'cpine'), nom: textDe(node, 'np') }))
      .filter((p) => p.nom);
  }

  /** @returns {Promise<Array<{codi: string, nom: string}>>} */
  static async consultarMunicipis(provincia) {
    if (!provincia) throw new Error('ServeiUbicacions: cal indicar la província');
    const params = new URLSearchParams({ Provincia: provincia, Municipio: '' });
    const xml = await ServeiUbicacions._xml(`${URL_CALLEJERO}/ConsultaMunicipio?${params}`, 'consultar els municipis');
    return perNom(xml, 'muni')
      .map((node) => ({ codi: textDe(node, 'cm'), nom: textDe(node, 'nm') }))
      .filter((m) => m.nom);
  }

  static async _xml(url, descripcio) {
    let resposta;
    try {
      resposta = await fetch(url);
    } catch (error) {
      throw new Error(`ServeiUbicacions: no s'ha pogut ${descripcio} (${error.message})`);
    }
    if (!resposta.ok) {
      throw new Error(`ServeiUbicacions: el Cadastre ha retornat un error en ${descripcio} (${resposta.status})`);
    }
    const xml = new DOMParser().parseFromString(await resposta.text(), 'application/xml');
    if (xml.getElementsByTagName('parsererror').length > 0) {
      throw new Error('ServeiUbicacions: resposta del Cadastre no interpretable');
    }
    return xml;
  }
}
