// Traduccions al castellà. Clau = text original en català (tal com
// apareix al codi/HTML), valor = la seva traducció. Només cal afegir-hi
// una entrada quan es tradueix un text nou -- si en falta alguna, l'app
// mostra el català en lloc de trencar-se (vegeu js/i18n.js).
export const ES = {
  // Capçalera / menú (compartit per totes les pàgines)
  'Inici': 'Inicio',
  'Afegir parcel·la': 'Añadir parcela',
  'Llistar': 'Listar',
  'Afegir': 'Añadir',
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
  'Afegir a la llista': 'Añadir a la lista',
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
  'Parcel·les per guardar': 'Parcelas para guardar',
  'Pots seguir afegint-ne més (d\'altres municipis també) abans de desar-les totes.':
    'Puedes seguir añadiendo más (de otros municipios también) antes de guardarlas todas.',
  'Afegida a la llista. Ja pots consultar-ne una altra, o desar-les totes.':
    'Añadida a la lista. Ya puedes consultar otra, o guardarlas todas.',
  'Guardar totes les parcel·les': 'Guardar todas las parcelas',
  'No s\'ha pogut desar la parcel·la:': 'No se ha podido guardar la parcela:',

  // Compartit (mapes, general)
  '← Tornar al llistat': '← Volver al listado',
  'Tornar a l\'agrupació': 'Volver a la agrupación',

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
  'Cal fer primer els càlculs d\'': 'Hay que hacer primero los cálculos de ',
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
  'Orientació mitjana': 'Orientación media',
  'Dades consultades el': 'Datos consultados el',
  'Referència cadastral': 'Referencia catastral',
  'Segur que vols esborrar la parcel·la de': '¿Seguro que quieres borrar la parcela de',
  'Aquesta acció no es pot desfer.': 'Esta acción no se puede deshacer.',
  'No s\'ha pogut carregar el detall de la parcel·la.': 'No se ha podido cargar el detalle de la parcela.',

  // Pàgina d'altitud (altitud.html / altitud.js)
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
  'Mostrar al mapa': 'Mostrar en el mapa',
  'Només el perímetre': 'Solo el perímetro',
  'Altitud': 'Altitud',
  'Orientació': 'Orientación',
  'Cotes màxima i mínima': 'Cotas máxima y mínima',
  'Cerca...': 'Buscar...',
  'Per població, polígon, parcel·la o ús.': 'Por población, polígono, parcela o uso.',
  'Cap parcel·la coincideix amb la cerca.': 'Ninguna parcela coincide con la búsqueda.',
  'Cerca pel nom...': 'Busca por el nombre...',
  'Cap agrupació coincideix amb la cerca.': 'Ninguna agrupación coincide con la búsqueda.',
  'Cap geometria coincideix amb la cerca.': 'Ninguna geometría coincide con la búsqueda.',
  'Cota màxima': 'Cota máxima',
  'Cota mínima': 'Cota mínima',
  'Altimetria': 'Altimetría',
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
  'Agrupacions': 'Agrupaciones',
  'Afegir agrupació': 'Añadir agrupación',
  '← Tornar a l\'inici': '← Volver al inicio',
  'Aquesta funcionalitat encara no està disponible -- estarà a punt en una propera versió.':
    'Esta funcionalidad todavía no está disponible -- estará lista en una próxima versión.',

  // Afegir agrupació (afegir-agrupacio.html / afegir-agrupacio.js)
  'Parcel·la triada': 'Parcela elegida',
  'Toca una parcel·la al mapa per afegir-la (o treure-la) de l\'agrupació.':
    'Toca una parcela en el mapa para añadirla (o quitarla) de la agrupación.',
  'Parcel·les de l\'agrupació': 'Parcelas de la agrupación',
  'Encara no has afegit cap parcel·la a l\'agrupació.':
    'Todavía no has añadido ninguna parcela a la agrupación.',
  'Nom de l\'agrupació': 'Nombre de la agrupación',
  'Nom': 'Nombre',
  'Guardar agrupació': 'Guardar agrupación',
  'Treure de l\'agrupació': 'Quitar de la agrupación',
  'Afegir a l\'agrupació': 'Añadir a la agrupación',
  'Treure': 'Quitar',
  'Cal indicar un nom per a l\'agrupació.': 'Hay que indicar un nombre para la agrupación.',
  'Cal afegir-hi almenys una parcel·la.': 'Hay que añadir al menos una parcela.',
  'No s\'ha pogut desar l\'agrupació:': 'No se ha podido guardar la agrupación:',
  'No s\'han pogut carregar les parcel·les.': 'No se han podido cargar las parcelas.',

  // Llistat d'agrupacions (agrupacions.html / agrupacions.js)
  'Toca una agrupació en el llistat per veure\'n les parcel·les al mapa. Per veure el detall, fes clic en una parcel·la o en el botó «Detall».':
    'Toca una agrupación en el listado para ver sus parcelas en el mapa. Para ver el detalle, haz clic en una parcela o en el botón «Detalle».',
  'Encara no has creat cap agrupació.': 'Todavía no has creado ninguna agrupación.',
  'Crea\'n una': 'Crea una',

  // Detall d'agrupació (detall-agrupacio.html / detall-agrupacio.js)
  'Detall de l\'agrupació': 'Detalle de la agrupación',
  'No s\'ha indicat cap agrupació.': 'No se ha indicado ninguna agrupación.',
  'No s\'ha trobat aquesta agrupació.': 'No se ha encontrado esta agrupación.',
  'Dades de l\'agrupació': 'Datos de la agrupación',
  'Nombre de parcel·les': 'Número de parcelas',
  'Superfície total': 'Superficie total',
  'Terreny (agregat)': 'Terreno (agregado)',
  'Cal calcular primer l\'altitud (mètode de malla) de totes les parcel·les de l\'agrupació.':
    'Hay que calcular primero la altitud (método de malla) de todas las parcelas de la agrupación.',
  'Cal calcular l\'altitud amb el mètode de malla per a totes les parcel·les de l\'agrupació abans de poder-ne calcular el risc conjunt. Falta per a:':
    'Hay que calcular la altitud con el método de malla para todas las parcelas de la agrupación antes de poder calcular su riesgo conjunto. Falta para:',
  'Segur que vols esborrar l\'agrupació': '¿Seguro que quieres borrar la agrupación',
  'Aquesta acció no es pot desfer (les parcel·les que la formen no s\'esborraran).':
    'Esta acción no se puede deshacer (las parcelas que la forman no se borrarán).',
  'No s\'ha pogut carregar l\'agrupació.': 'No se ha podido cargar la agrupación.',
  'Editar agrupació': 'Editar agrupación',

  // Còpia de seguretat (copia-seguretat.html / copia-seguretat.js)
  'Còpia de seguretat': 'Copia de seguridad',
  'Exportar': 'Exportar',
  'Es descarreguen quatre fitxers CSV (parceles, subparceles, agrupacions i geometries), amb totes les teves dades tal com estan ara mateix -- obribles amb qualsevol full de càlcul.':
    'Se descargan cuatro archivos CSV (parcelas, subparcelas, agrupaciones y geometrías), con todos tus datos tal como están ahora mismo -- abribles con cualquier hoja de cálculo.',
  'Exportar totes les dades': 'Exportar todos los datos',
  'Importar': 'Importar',
  'Selecciona un o més dels quatre fitxers CSV (es reconeixen pel seu nom). Compte: cada fitxer que seleccionis substitueix del tot les dades corresponents que ja tinguis -- no s\'hi afegeixen, se substitueixen.':
    'Selecciona uno o más de los cuatro archivos CSV (se reconocen por su nombre). Cuidado: cada archivo que selecciones sustituye del todo los datos correspondientes que ya tengas -- no se añaden, se sustituyen.',
  'Importar (substitueix les dades)': 'Importar (sustituye los datos)',
  'Fitxers exportats correctament.': 'Archivos exportados correctamente.',
  'No s\'ha pogut exportar:': 'No se ha podido exportar:',
  'Cal triar almenys un fitxer CSV.': 'Hay que elegir al menos un archivo CSV.',
  'Segur que vols importar aquests fitxers? Les dades corresponents que ja tinguis es perdran i se substituiran per les del fitxer. Aquesta acció no es pot desfer.':
    '¿Seguro que quieres importar estos archivos? Los datos correspondientes que ya tengas se perderán y se sustituirán por los del archivo. Esta acción no se puede deshacer.',
  'Cap dels fitxers triats s\'ha reconegut (els noms han de ser parceles.csv, subparceles.csv, agrupacions.csv o geometries.csv).':
    'Ninguno de los archivos elegidos se ha reconocido (los nombres deben ser parceles.csv, subparceles.csv, agrupacions.csv o geometries.csv).',
  'Importat correctament:': 'Importado correctamente:',
  'No s\'ha pogut importar:': 'No se ha podido importar:',
  'Esborrar agrupació': 'Borrar agrupación',
  'Veure punts d\'altitud': 'Ver puntos de altitud',

  // Punts d'altitud combinats (altitud-agrupacio.html / altitud-agrupacio.js)
  '← Tornar al detall': '← Volver al detalle',
  'Punts d\'altitud de l\'agrupació': 'Puntos de altitud de la agrupación',
  'Es mostren els punts ja calculats i desats de cada parcel·la, combinats en un sol mapa -- no es torna a consultar res.':
    'Se muestran los puntos ya calculados y guardados de cada parcela, combinados en un solo mapa -- no se vuelve a consultar nada.',
  'Punts d\'altitud': 'Puntos de altitud',
  'Cal calcular l\'altitud amb el mètode de malla per a totes les parcel·les de l\'agrupació. Falta per a:':
    'Hay que calcular la altitud con el método de malla para todas las parcelas de la agrupación. Falta para:',

  // Mapa de selecció al Cadastre (afegir.html / afegir.js)
  'Tria la parcel·la al mapa': 'Elige la parcela en el mapa',
  'Amplia el mapa fins que hi vegis les parcel·les i toca la que vulguis afegir. També pots ometre aquest pas i escriure les dades a mà, més avall.':
    'Amplía el mapa hasta que veas las parcelas y toca la que quieras añadir. También puedes omitir este paso y escribir los datos a mano, más abajo.',
  'Es mostren les parcel·les que cauen dins del requadre marcat (línia discontínua) o que en toquen alguna part -- desplaça el mapa fins que hi càpiga la teva zona.':
    'Se muestran las parcelas que caen dentro del recuadro marcado (línea discontinua) o que lo tocan en alguna parte -- desplaza el mapa hasta que quepa tu zona.',
  'Carregant les parcel·les d\'aquesta zona...': 'Cargando las parcelas de esta zona...',
  'No s\'ha pogut identificar el polígon i la parcel·la d\'aquesta finca.':
    'No se ha podido identificar el polígono y la parcela de esta finca.',
  'No s\'ha pogut identificar automàticament la província i el municipi d\'aquesta parcel·la. Selecciona\'ls manualment i escriu el polígon i la parcel·la a mà.':
    'No se ha podido identificar automáticamente la provincia y el municipio de esta parcela. Selecciónalos manualmente y escribe el polígono y la parcela a mano.',

  // Geometries (afegir-geometria, detall-geometria, geometries)
  'Geometries': 'Geometrías',
  'Afegir geometria': 'Añadir geometría',
  'Toca el mapa per afegir-hi punts (calen almenys 3 per definir un perímetre). No es consulten dades del Cadastre -- només es podrà calcular l\'altitud, el pendent, l\'orientació i el risc d\'incendi a partir d\'aquests.':
    'Toca el mapa para añadir puntos (hacen falta al menos 3 para definir un perímetro). No se consultan datos del Catastro -- solo se podrá calcular la altitud, la pendiente, la orientación y el riesgo de incendio a partir de estos.',
  'Desfer l\'últim punt': 'Deshacer el último punto',
  'Netejar-ho tot': 'Limpiarlo todo',
  'Nom de la geometria': 'Nombre de la geometría',
  'Guardar geometria': 'Guardar geometría',
  'Cal indicar un nom per a la geometria.': 'Hay que indicar un nombre para la geometría.',
  'Calen almenys 3 punts per definir un perímetre.': 'Hacen falta al menos 3 puntos para definir un perímetro.',
  'No s\'ha pogut desar la geometria:': 'No se ha podido guardar la geometría:',
  'Dades de la geometria': 'Datos de la geometría',
  'Esborrar geometria': 'Borrar geometría',
  'No s\'ha indicat cap geometria.': 'No se ha indicado ninguna geometría.',
  'No s\'ha trobat aquesta geometria.': 'No se ha encontrado esta geometría.',
  'Dades desades a la geometria.': 'Datos guardados en la geometría.',
  'No s\'ha pogut carregar la geometria.': 'No se ha podido cargar la geometría.',
  'No disponible (sense dades cadastrals)': 'No disponible (sin datos catastrales)',
  'Dades desades a la base de dades local en el moment de crear la geometria. Per tornar-la a moure, cal esborrar-la i afegir-la de nou.':
    'Datos guardados en la base de datos local en el momento de crear la geometría. Para volver a moverla, hay que borrarla y añadirla de nuevo.',
  'Segur que vols esborrar la geometria': '¿Seguro que quieres borrar la geometría',
  'No s\'ha pogut carregar el detall de la geometria.': 'No se ha podido cargar el detalle de la geometría.',
  'Les meves geometries': 'Mis geometrías',
  'Toca una geometria en el llistat per veure\'n el perímetre al mapa. Per veure el detall, fes clic en el perímetre o en el botó «Detall».':
    'Toca una geometría en el listado para ver su perímetro en el mapa. Para ver el detalle, haz clic en el perímetro o en el botón «Detalle».',
  'Encara no has afegit cap geometria.': 'Todavía no has añadido ninguna geometría.',
  'No s\'han pogut carregar les geometries. Revisa la consola per a més detalls.':
    'No se han podido cargar las geometrías. Revisa la consola para más detalles.',
};
