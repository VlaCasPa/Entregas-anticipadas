const map = L.map('map').setView([-12.055, -77.050], 13);  

L.tileLayer('http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {  
 maxZoom: 20,  
 subdomains: ['mt0','mt1','mt2','mt3'],  
 attribution: '&copy; Google',  
 opacity: 0.65,  
 className: 'mapa-google-gris'  
}).addTo(map);  

const urlCSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSz_DsP2CT07FaYNRe4MIX7cO25I01gUb9e_aboGNrIHyBzHiVCX-Ea800l6R76rQ/pub?gid=814807134&single=true&output=csv";  

// Dos capas independientes: Polígonos de fondo y Marcadores/IDs al frente absoluto
let grupoPoligonos = L.featureGroup().addTo(map);  
let grupoMarcadoresIDs = L.featureGroup().addTo(map);  

let mapaDatosSheets = {};  
let datosGlobalesCSV = [];
let geojsonDataGlobal = null;
let filtroActualGlobal = 'todos';

function normalizarID(texto) {  
 if (!texto) return "";  
 return texto.toString().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();  
}  

// Estilos de polígonos: Residual se renderiza con mayor énfasis visual
function estiloPoligono(feature) {  
 let tipo = feature.properties.tipo ? feature.properties.tipo.toLowerCase() : "";  
 if (tipo === "residual") {
   return { color: "#f472b6", fillColor: "#fce7f3", weight: 3, opacity: 1, fillOpacity: 0.65 };  
 }  
 if (tipo === "liberado") {  
   return { color: "#38bdf8", fillColor: "#e0f2fe", weight: 2, opacity: 0.9, fillOpacity: 0.5 };  
 }  
 if (tipo === "culminada") {  
   return { color: "#315738", fillColor: "#eaf2eb", weight: 2, opacity: 0.9, fillOpacity: 0.5 };  
 }  
 return { color: "#d4a39b", fillColor: "#f5ebe9", weight: 2, opacity: 0.8, fillOpacity: 0.4 };  
}  

Promise.all([  
 fetch('cerramientos.geojson').then(res => res.json()),  
 new Promise(resolve => {  
   Papa.parse(urlCSV, {  
     download: true,  
     header: true,  
     complete: results => resolve(results.data)  
   });  
 })  
]).then(([geojsonData, csvData]) => {  
 geojsonDataGlobal = geojsonData;
 datosGlobalesCSV = csvData;

 actualizarDashboardYMapa(csvData, geojsonData, 'todos');
});

function actualizarDashboardYMapa(csvData, geojsonData, filtroEstado) {
 filtroActualGlobal = filtroEstado;
 let countInicial = 0, countResidual = 0, countLiberado = 0, countCulminada = 0;  

 grupoPoligonos.clearLayers();
 grupoMarcadoresIDs.clearLayers();
 mapaDatosSheets = {};

 // 1. INDEXACIÓN DE DATOS CSV Y CONTEO COLUMNA D
 csvData.forEach(item => {  
   if (item.ID) {  
     let idNorm = normalizarID(item.ID);  
     mapaDatosSheets[idNorm] = item;  
  
     let keys = Object.keys(item);
     let valColD = item[keys[3]] ? item[keys[3]].trim().toLowerCase() : ""; // Columna D (Culminadas)
     let tipoC = item.Tipo_Cerramiento ? item.Tipo_Cerramiento.trim().toLowerCase() : "";  
     let tieneLib = item.Tiene_Liberacion ? item.Tiene_Liberacion.trim().toUpperCase() : "";  
  
     if (tieneLib === "SI") countLiberado++;  
     if (tipoC === "residual") countResidual++;  
     else if (tipoC === "inicial" || !tipoC) countInicial++;  
     
     if (valColD === "culminada" || tipoC === "culminada" || valColD === "si" || valColD === "culminado") {
       countCulminada++;
     }
   }  
 });  

 document.getElementById('kpi-inicial').innerText = countInicial;  
 document.getElementById('kpi-residual').innerText = countResidual;  
 document.getElementById('kpi-liberado').innerText = countLiberado;  
 document.getElementById('kpi-culminada').innerText = countCulminada;  

 // 2. ORDEN DE CARGA DE POLÍGONOS (Asegurando que Residual se cargue al final para quedar encima de los demás)
 let featuresOrdenadas = [...geojsonData.features].sort((a, b) => {
   let tA = (a.properties.tipo || "").toLowerCase();
   let tB = (b.properties.tipo || "").toLowerCase();
   if (tA === "residual") return 1;  // Residual al final (encima)
   if (tB === "residual") return -1;
   return 0;
 });

 let geojsonFiltrado = {
   type: "FeatureCollection",
   features: featuresOrdenadas.filter(feature => {
     if (filtroEstado === 'todos') return true;
     let tipoGeo = feature.properties.tipo ? feature.properties.tipo.toLowerCase() : "";
     if (filtroEstado === 'inicial') return tipoGeo === 'inicial' || !tipoGeo;
     if (filtroEstado === 'residual') return tipoGeo === 'residual';
     if (filtroEstado === 'liberado') return tipoGeo === 'liberado';
     if (filtroEstado === 'culminada') return tipoGeo === 'culminada';
     return true;
   })
 };

 let capaGeoJSON = L.geoJSON(geojsonFiltrado, {  
   style: estiloPoligono,  
   onEachFeature: function(feature, layer) {  
     let idGeo = normalizarID(feature.properties.id || feature.properties.ID);  
     let datos = mapaDatosSheets[idGeo] || { ID: feature.properties.id || 'N/A', Nombre: 'Estructura Línea 2 y 4' };  
     layer.bindPopup(generarHTMLPopup(datos.ID || feature.properties.id, datos));   
   }  
 }).addTo(grupoPoligonos);  

 // 3. CARGA DE MARCADORES E IDS (Capa superior absoluta)
 let boundsArray = [];
 csvData.forEach(item => {  
   if (item.ID) {  
     let idNorm = normalizarID(item.ID);  
     let tipoC = item.Tipo_Cerramiento ? item.Tipo_Cerramiento.trim().toLowerCase() : "";  
     let tieneLib = item.Tiene_Liberacion ? item.Tiene_Liberacion.trim().toUpperCase() : "";  
     let keys = Object.keys(item);
     let valColD = item[keys[3]] ? item[keys[3]].trim().toLowerCase() : "";

     let cumpleFiltro = true;
     if (filtroEstado === 'inicial') cumpleFiltro = (tipoC === 'inicial' || !tipoC);
     if (filtroEstado === 'residual') cumpleFiltro = (tipoC === 'residual');
     if (filtroEstado === 'liberado') cumpleFiltro = (tieneLib === 'SI');
     if (filtroEstado === 'culminada') cumpleFiltro = (tipoC === 'culminada' || valColD === "culminada" || valColD === "culminado");

     if (cumpleFiltro) {
       let lat = parseFloat(item.Latitud ? item.Latitud.toString().replace(',', '.') : "");  
       let lon = parseFloat(item.Longitud ? item.Longitud.toString().replace(',', '.') : "");  
  
       if (!isNaN(lat) && !isNaN(lon)) {  
         boundsArray.push([lat, lon]);
         let colorPunto = "#d4a39b";
         if (tipoC === 'residual') colorPunto = "#f472b6";
         else if (tieneLib === 'SI') colorPunto = "#38bdf8";
         else if (tipoC === 'culminada' || valColD === "culminada") colorPunto = "#315738";

         let marker = L.circleMarker([lat, lon], { radius: 7, fillColor: colorPunto, color: "#ffffff", weight: 2, opacity: 1, fillOpacity: 0.9 });  
         marker.bindTooltip(item.ID, { permanent: true, direction: 'right', className: 'id-tooltip', offset: [5, 0] });  
         marker.bindPopup(generarHTMLPopup(item.ID, item));
         marker.addTo(grupoMarcadoresIDs);  
       }  
     }
   }  
 });  

 // Hacer Zoom Out / Ajuste automático (fitBounds) de los elementos seleccionados al filtrar
 if (boundsArray.length > 0 && filtroEstado !== 'todos') {
   map.fitBounds(boundsArray, { padding: [50, 50], maxZoom: 15 });
 } else if (filtroEstado === 'todos' && boundsArray.length > 0) {
   map.setView([-12.055, -77.050], 13);
 }

 setTimeout(() => { map.invalidateSize(); }, 200);
}

function generarHTMLPopup(idEstructura, datos) {
  return `  
    <div style="min-width: 200px; font-size: 11px;">  
      <h3 style="font-size: 12px; font-weight: 700; color: #0f172a; margin: 0 0 4px 0;">${idEstructura}: ${datos.Nombre || 'Estructura L2 y L4'}</h3>  
      <div style="color: #64748b; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">Tipo: ${datos.Tipo_Cerramiento || 'Cerramiento'}</div>  
      <div>📅 <b>Constatación:</b> ${datos.Fecha_Constatacion || '-'}</div>  
      <div>🚧 <b>Liberación:</b> ${datos.Fecha_Liberacion || '-'}</div>  
      <div>📖 <b>Asiento:</b> ${datos.Asiento_Obra || '-'}</div>  
      <div>📐 <b>Plano:</b> ${datos.Codigo_Plano || '-'}</div>  
    </div>  
  `;
}

function filtrarEstado(tipo) {
 document.querySelectorAll('.filtro-btn').forEach(btn => btn.classList.remove('active'));
 event.target.classList.add('active');
 if (geojsonDataGlobal && datosGlobalesCSV) actualizarDashboardYMapa(datosGlobalesCSV, geojsonDataGlobal, tipo);
}

function toggleFiltros() {  
 const contenido = document.getElementById('filtrosContenido');  
 const icon = document.getElementById('filtro-icon');  
 contenido.classList.toggle('show');  
 icon.innerText = contenido.classList.contains('show') ? '▲' : '▼';  
}  

function toggleConsultorIA() {
 document.getElementById('desplegableIA').classList.toggle('show');
}

// Consultor de Datos Inteligente que responde por ID específico
function ejecutarConsultaIA() {
 let consulta = document.getElementById('inputConsultaIA').value.trim().toUpperCase();
 let cajaResp = document.getElementById('respuestaIA');
 
 if(!consulta) { 
   cajaResp.innerText = "Por favor, ingrese un ID de estructura (Ej: E04, PV02)."; 
   return; 
 }

 let idNorm = normalizarID(consulta);
 let datosID = mapaDatosSheets[idNorm];

 if (datosID) {
   cajaResp.innerHTML = `<b>Datos para [${datosID.ID}]:</b><br>` +
                        `- Nombre: ${datosID.Nombre || 'N/A'}<br>` +
                        `- Tipo: ${datosID.Tipo_Cerramiento || 'N/A'}<br>` +
                        `- Constatación: ${datosID.Fecha_Constatacion || 'N/A'}<br>` +
                        `- Liberación: ${datosID.Fecha_Liberacion || 'N/A'}<br>` +
                        `- Asiento: ${datosID.Asiento_Obra || 'N/A'}`;
 } else {
   cajaResp.innerText = `No se encontraron registros exactos para el ID "${consulta}". Verifique la nomenclatura.`;
 }
}

function copiarReporteTexto() {
 let textoReporte = "=== REPORTE OPERATIVO LÍNEA 2 Y 4 ===\n";
 textoReporte += "- Cerco Inicial: " + document.getElementById('kpi-inicial').innerText + "\n";
 textoReporte += "- Área Residual: " + document.getElementById('kpi-residual').innerText + "\n";
 textoReporte += "- Área Liberada: " + document.getElementById('kpi-liberado').innerText + "\n";
 textoReporte += "- Culminadas: " + document.getElementById('kpi-culminada').innerText + "\n";
 textoReporte += "Diseñado por Vladimir Casas.";

 navigator.clipboard.writeText(textoReporte).then(() => {
   alert("¡Reporte copiado al portapapeles!");
 });
}
