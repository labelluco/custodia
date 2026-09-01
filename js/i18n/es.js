// Traduccions al castellà. Clau = text original en català (tal com
// apareix al codi/HTML), valor = la seva traducció. Només cal afegir-hi
// una entrada quan es tradueix un text nou -- si en falta alguna, l'app
// mostra el català en lloc de trencar-se (vegeu js/i18n.js).
export const ES = {
  // Capçalera / menú (compartit per totes les pàgines)
  'Inici': 'Inicio',
  'Afegir parcel·la': 'Añadir parcela',
  'Tornar al llistat': 'Volver al listado',
  'Tornar al detall': 'Volver al detalle',

  // Pàgina d'inici (index.html / inici.js)
  'Les meves parcel·les': 'Mis parcelas',
  'Encara no has afegit cap parcel·la.': 'Todavía no has añadido ninguna parcela.',
  'Afegeix-ne una': 'Añade una',
  'Població': 'Población',
  'Polígon': 'Polígono',
  'Parcel·la': 'Parcela',
  'Ús': 'Uso',
  'Risc': 'Riesgo',
  'No s\'han pogut carregar les parcel·les. Revisa la consola per a més detalls.':
    'No se han podido cargar las parcelas. Revisa la consola para más detalles.',

  // Pàgina d'afegir (afegir.html / afegir.js)
  'Afegir una nova parcel·la': 'Añadir una nueva parcela',
  'Provincia': 'Provincia',
  'Carregant...': 'Cargando...',
  'Tria primer una província': 'Elige primero una provincia',
  'Consultar cadastre': 'Consultar catastro',
  'Ús (segons el Cadastre)': 'Uso (según el Catastro)',
  'Desglossament de subparceles': 'Desglose de subparcelas',
  'Desar parcel·la': 'Guardar parcela',
  'Tria una província': 'Elige una provincia',
  'p. ex. Teruel': 'p. ej. Teruel',
  'Tria un municipi': 'Elige un municipio',
  'Cal omplir provincia, polígon, parcel·la i població.':
    'Hay que rellenar provincia, polígono, parcela y población.',
  'Consultant el Cadastre...': 'Consultando el Catastro...',
  'No disponible': 'No disponible',
  'Cadastre consultat correctament.': 'Catastro consultado correctamente.',
  'No s\'ha pogut consultar el cadastre:': 'No se ha podido consultar el catastro:',
  'Primer cal consultar el cadastre.': 'Primero hay que consultar el catastro.',
  'Parcel·la desada correctament.': 'Parcela guardada correctamente.',
  'No s\'ha pogut desar la parcel·la:': 'No se ha podido guardar la parcela:',

  // Compartit (mapes, general)
  '← Tornar al llistat': '← Volver al listado',

  // Pàgina de detall (detall.html / detall.js)
  'No s\'ha indicat cap parcel·la.': 'No se ha indicado ninguna parcela.',
  'No s\'ha trobat aquesta parcel·la.': 'No se ha encontrado esta parcela.',
  'Risc d\'incendi calculat': 'Riesgo de incendio calculado',
  'Dades de la parcel·la': 'Datos de la parcela',
  'Subparceles (Cadastre)': 'Subparcelas (Catastro)',
  'Descripció': 'Descripción',
  'Superfície': 'Superficie',
  'Risc base': 'Riesgo base',
  'Índex prod.': 'Índice prod.',
  'Codi': 'Código',
  'Exportar track (GPX)': 'Exportar track (GPX)',
  'Esborrar parcel·la': 'Borrar parcela',
  'Cal calcular primer el pendent mitjà': 'Primero hay que calcular la pendiente media',
  'calcular-ho': 'calcularlo',
  'Índex de perillositat': 'Índice de peligrosidad',
  'Component vegetació': 'Componente vegetación',
  'No disponible (sense subparceles)': 'No disponible (sin subparcelas)',
  'Component pendent': 'Componente pendiente',
  'Component orientació': 'Componente orientación',
  'No disponible (cal el mètode de malla)': 'No disponible (hace falta el método de malla)',
  'Model propi, no un estàndard oficial — pensat per ajustar-lo amb l\'ús real.':
    'Modelo propio, no un estándar oficial — pensado para ajustarlo con el uso real.',
  'És un índex per': 'Es un índice para',
  'comparar parcel·les entre elles': 'comparar parcelas entre sí',
  'segons el mateix criteri, no una probabilitat ni una freqüència d\'incendis: un 62 no vol dir "62% de possibilitats de cremar-se", ni "es crema 6 anys de cada 10".':
    'según el mismo criterio, no una probabilidad ni una frecuencia de incendios: un 62 no significa "62% de posibilidades de quemarse", ni "se quema 6 años de cada 10".',
  'Pendent mitjà': 'Pendiente media',
  'Calcular de nou': 'Calcular de nuevo',
  'Calcular-ho': 'Calcularlo',
  'Orientació mitjana': 'Orientación media',
  'Calcular-ho (mètode de malla)': 'Calcularlo (método de malla)',
  'Dades consultades el': 'Datos consultados el',
  'Referència cadastral': 'Referencia catastral',
  'Segur que vols esborrar la parcel·la de': '¿Seguro que quieres borrar la parcela de',
  'Aquesta acció no es pot desfer.': 'Esta acción no se puede deshacer.',
  'No s\'ha pogut carregar el detall de la parcel·la.': 'No se ha podido cargar el detalle de la parcela.',

  // Pàgina d'altitud (altitud.html / altitud.js)
  'Altitud i pendent': 'Altitud y pendiente',
  'Calculant...': 'Calculando...',
  'Mètode de càlcul': 'Método de cálculo',
  'Vèrtexs del perímetre': 'Vértices del perímetro',
  'Malla de punts': 'Malla de puntos',
  'Distància entre punts (m)': 'Distancia entre puntos (m)',
  'Amb aquest mètode també es calcula l\'orientació mitjana del terreny.':
    'Con este método también se calcula la orientación media del terreno.',
  'Calcular': 'Calcular',
  'Desar a la parcel·la': 'Guardar en la parcela',
  'Encara no s\'ha calculat l\'altimetria d\'aquesta parcel·la.':
    'Todavía no se ha calculado la altimetría de esta parcela.',
  'Valors ja desats d\'un càlcul anterior. Selecciona un mètode i prem "Calcular" per refer-los.':
    'Valores ya guardados de un cálculo anterior. Selecciona un método y pulsa "Calcular" para rehacerlos.',
  'Toca un vèrtex del perímetre per veure la seva altitud.':
    'Toca un vértice del perímetro para ver su altitud.',
  'Toca un punt de la malla per veure la seva altitud i orientació.':
    'Toca un punto de la malla para ver su altitud y orientación.',
  'No s\'ha pogut calcular l\'altimetria:': 'No se ha podido calcular la altimetría:',
  'La distància entre punts ha de ser un número positiu': 'La distancia entre puntos debe ser un número positivo',
  'Cap punt de la malla cau dins del perímetre; prova amb una distància més petita':
    'Ningún punto de la malla cae dentro del perímetro; prueba con una distancia más pequeña',
  'La malla generarà {n} punts; la consulta pot trigar una mica. Vols continuar?':
    'La malla generará {n} puntos; la consulta puede tardar un poco. ¿Quieres continuar?',
  'Altitud mínima': 'Altitud mínima',
  'Altitud màxima': 'Altitud máxima',
  'Desnivell': 'Desnivel',
  'No calculada (terreny massa pla, o cal el mètode de malla)':
    'No calculada (terreno demasiado plano, o hace falta el método de malla)',
  'Dades desades a la parcel·la.': 'Datos guardados en la parcela.',
  'No s\'ha pogut desar:': 'No se ha podido guardar:',
  'No s\'ha pogut carregar la parcel·la.': 'No se ha podido cargar la parcela.',

  // Mapa (js/ui/mapa.js), compartit entre detall.html i altitud.html
  'pla (sense orientació definida)': 'llano (sin orientación definida)',
  'orientació:': 'orientación:',

  // Etiquetes de bruixola (ServeiOrientacio.etiquetaBruixola)
  'Nord': 'Norte',
  'Nord-est': 'Noreste',
  'Est': 'Este',
  'Sud-est': 'Sureste',
  'Sud': 'Sur',
  'Sud-oest': 'Suroeste',
  'Oest': 'Oeste',
  'Nord-oest': 'Noroeste',

  // Textos de les icones d'ajuda (afegides en aquesta ronda)
  'Índex propi (0-100) que combina vegetació, pendent i orientació per comparar parcel·les entre elles. No representa una probabilitat ni una freqüència real d\'incendis.':
    'Índice propio (0-100) que combina vegetación, pendiente y orientación para comparar parcelas entre sí. No representa una probabilidad ni una frecuencia real de incendios.',
  'Inclinació mitjana del terreny, calculada a partir del model digital d\'elevacions de l\'IDEE (vèrtexs del perímetre o una malla de punts interiors).':
    'Inclinación media del terreno, calculada a partir del modelo digital de elevaciones del IDEE (vértices del perímetro o una malla de puntos interiores).',
  'Direcció cap on "mira" el pendent del terreny. Només es calcula amb el mètode de malla, no amb els vèrtexs del perímetre.':
    'Dirección hacia donde "mira" la pendiente del terreno. Solo se calcula con el método de malla, no con los vértices del perímetro.',
  'Dades desades a la base de dades local en el moment de crear la parcel·la. Per tornar a consultar-les, cal esborrar la parcel·la i afegir-la de nou.':
    'Datos guardados en la base de datos local en el momento de crear la parcela. Para volver a consultarlos, hay que borrar la parcela y añadirla de nuevo.',

  // Ronda de retocs d'usabilitat
  'Identificació': 'Identificación',
  'Terreny': 'Terreno',
  'veure al Cadastre': 'ver en el Catastro',
  'Detall': 'Detalle',
  'Toca una parcel·la en el llistat per veure\'n el perímetre al mapa. Per veure el detall, fes clic en el perímetre o en el botó «Detall».':
    'Toca una parcela en el listado para ver su perímetro en el mapa. Para ver el detalle, haz clic en el perímetro o en el botón «Detalle».',
  'Resultats': 'Resultados',
  'Programari lliure': 'Software libre',
  'Codi font': 'Código fuente',
  'Contacte': 'Contacto',
  'Aquesta parcel·la forma part de': 'Esta parcela forma parte de',
  'l\'agrupació': 'la agrupación',
  'les agrupacions': 'las agrupaciones',
  'Cal treure-la de l\'agrupació abans de poder esborrar-la.':
    'Hay que sacarla de la agrupación antes de poder borrarla.',

  // Reestructuració de la navegació (pantalla d'inici, parceles.html)
  'Parcel·les': 'Parcelas',
  'Què vols fer?': '¿Qué quieres hacer?',
  'Agrupacions de parcel·les': 'Agrupaciones de parcelas',
  'Afegir agrupació': 'Añadir agrupación',
  '← Tornar a l\'inici': '← Volver al inicio',
  'Aquesta funcionalitat encara no està disponible -- estarà a punt en una propera versió.':
    'Esta funcionalidad todavía no está disponible -- estará lista en una próxima versión.',
};
