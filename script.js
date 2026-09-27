// Inicialización del Mapa centrado en Lima (Línea 2 del Metro)
const map = L.map('map').setView([-12.055, -77.050], 13);  

// Capa Base Google Maps (Gris tenue estético)
L.tileLayer('http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {  
 maxZoom: 20,  
 subdomains: ['mt0','mt1','mt2','mt3'],  
 attribution: '&copy; Google',  
 opacity: 0.65,  
 className: 'mapa-google-gris'  
}).addTo(map);  

// URL del CSV publicado desde Google Sheets (BD_Cerramientos)
const urlCSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSz_DsP2CT07FaYNRe4MIX7cO25I01gUb9e_aboGNrIHyBzHiVCX-Ea800l6R76rQ/pub?gid=814807134&single=true&output=csv";  

// Grupos de capas para gestión espacial
let grupoMarcadores = L.featureGroup().addTo(map);  
let grupoPoligonos = L.featureGroup().addTo(map);  

let mapaDatosSheets = {};  
let datosGlobalesCSV = [];
let geojsonDataGlobal = null;

// Función para normalizar IDs de comparación
function normalizarID(texto) {  
 if (!texto) return "";  
 return texto.toString().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();  
}  

// Estilos dinámicos para los polígonos del mapa según su tipo
function estiloPoligono(feature) {  
 let tipo = feature.properties.tipo ? feature.properties.tipo.toLowerCase() : "";  
   
 if (tipo === "residual") {  
   return { color: "#f472b6", fillColor: "#fce7f3", weight: 2, opacity: 0.9, fillOpacity: 0.5 };  
 } else if (tipo === "liberado") {  
   return { color: "#38bdf8", fillColor: "#e0f2fe", weight: 2, opacity: 0.9, fillOpacity: 0.5 };  
 } else if (tipo === "culminada") {  
   return { color: "#94a3b8", fillColor: "#e2e8f0", weight: 2, opacity: 0.9, fillOpacity: 0.5 };  
 } else {  
   return { color: "#d4a39b", fillColor: "#f5ebe9", weight: 2, opacity: 0.8, fillOpacity: 0.4 };  
 }  
}  

// Carga simultánea de datos espaciales (GeoJSON) y tabulares (Google Sheets CSV)
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

// Función principal de procesamiento de KPIs y renderizado de capas
function actualizarDashboardYMapa(csvData, geojsonData, filtroEstado) {
 let countInicial = 0;  
 let countResidual = 0;  
 let countLiberado = 0;  
 let countCulminada = 0;  

 grupoMarcadores.clearLayers();
 grupoPoligonos.clearLayers();
 mapaDatosSheets = {};

 // Indexar datos de la hoja por ID normalizado  
 csvData.forEach(item => {  
   if (item.ID) {  
     let idNorm = normalizarID(item.ID);  
     mapaDatosSheets[idNorm] = item;  
  
     let tipoC = item.Tipo_Cerramiento ? item.Tipo_Cerramiento.trim().toLowerCase() : "";  
     let tieneLib = item.Tiene_Liberacion ? item.Tiene_Liberacion.trim().toUpperCase() : "";  
     let estadoObra = item.Estado ? item.Estado.trim().toLowerCase() : "";  
  
     if (tieneLib === "SI") countLiberado++;  
     if (tipoC === "residual") countResidual++;  
     else if (tipoC === "inicial" || !tipoC) countInicial++;  

     if (estadoObra === "culminada" || tipoC === "culminada") {
       countCulminada++;
     }
  
     // Aplicar filtro por estado para los puntos/marcadores  
     let cumpleFiltro = true;
     if (filtroEstado === 'inicial') cumpleFiltro = (tipoC === 'inicial' || !tipoC);
     if (filtroEstado === 'residual') cumpleFiltro = (tipoC === 'residual');
     if (filtroEstado === 'liberado') cumpleFiltro = (tieneLib === 'SI');
     if (filtroEstado === 'culminada') cumpleFiltro = (tipoC === 'culminada' || estadoObra === 'culminada');

     if (cumpleFiltro) {
       let lat = parseFloat(item.Latitud ? item.Latitud.toString().replace(',', '.') : "");  
       let lon = parseFloat(item.Longitud ? item.Longitud.toString().replace(',', '.') : "");  
  
       if (!isNaN(lat) && !isNaN(lon)) {  
         let colorPunto = "#d4a39b";
         if (tipoC === 'residual') colorPunto = "#f472b6";
         else if (tieneLib === 'SI') colorPunto = "#38bdf8";
         else if (tipoC === 'culminada') colorPunto = "#94a3b8";

         let marker = L.circleMarker([lat, lon], {  
           radius: 7,  
           fillColor: colorPunto,  
           color: "#ffffff",  
           weight: 2,  
           opacity: 1,  
           fillOpacity: 0.9  
         });  
  
         marker.bindTooltip(item.ID, { permanent: true, direction: 'right', className: 'id-tooltip', offset: [5, 0] });  
         marker.addTo(grupoMarcadores);  
       }  
     }
   }  
 });  
  
 // Inyectar contadores actualizados en los KPIs del DOM  
 document.getElementById('kpi-inicial').innerText = countInicial;  
 document.getElementById('kpi-residual').innerText = countResidual;  
 document.getElementById('kpi-liberado').innerText = countLiberado;  
 document.getElementById('kpi-culminada').innerText = countCulminada;  
  
 // Filtrar y cargar capa GeoJSON de polígonos  
 L.geoJSON(geojsonData, {  
   filter: function(feature) {
     if (filtroEstado === 'todos') return true;
     let tipoGeo = feature.properties.tipo ? feature.properties.tipo.toLowerCase() : "";
     if (filtroEstado === 'inicial') return tipoGeo === 'inicial' || !tipoGeo;
     if (filtroEstado === 'residual') return tipoGeo === 'residual';
     if (filtroEstado === 'liberado') return tipoGeo === 'liberado';
     if (filtroEstado === 'culminada') return tipoGeo === 'culminada';
     return true;
   },
   style: estiloPoligono,  
   onEachFeature: function(feature, layer) {  
     let idGeo = normalizarID(feature.properties.id);  
     let datos = mapaDatosSheets[idGeo] || {};  
  
     let popupHtml = `  
       <div class="popup-container">  
         <h3 class="popup-title">${datos.ID || feature.properties.id}: ${datos.Nombre || 'Estructura L2'}</h3>  
         <div class="popup-subtitle">Tipo: ${datos.Tipo_Cerramiento || 'Cerramiento de Obra'}</div>  
         <div class="popup-dato">📅 <b>Fecha Constatación:</b> ${datos.Fecha_Constatacion || '-'}</div>  
         <div class="popup-dato">🚧 <b>Fecha Liberación:</b> ${datos.Fecha_Liberacion || '-'}</div>  
         <div class="popup-dato">📖 <b>Asiento de Obra:</b> ${datos.Asiento_Obra || '-'}</div>  
         <div class="popup-dato">📐 <b>Código de Plano:</b> ${datos.Codigo_Plano || '-'}</div>  
       </div>  
     `;  
     layer.bindPopup(popupHtml);  
   }  
 }).addTo(grupoPoligonos);  
  
 // Forzar redibujado de Leaflet para evitar grises o pantallas blancas
 setTimeout(() => { map.invalidateSize(); }, 200);
}

// Función que maneja la interacción de los botones de filtro por estado
function filtrarEstado(tipo) {
 document.querySelectorAll('.filtro-btn').forEach(btn => btn.classList.remove('active'));
 event.target.classList.add('active');

 if (geojsonDataGlobal && datosGlobalesCSV) {
   actualizarDashboardYMapa(datosGlobalesCSV, geojsonDataGlobal, tipo);
 }
}

// Control colapsable del menú de filtros para versión móvil
function toggleFiltros() {  
 const contenido = document.getElementById('filtrosContenido');  
 const icon = document.getElementById('filtro-icon');  
 contenido.classList.toggle('show');  
 icon.innerText = contenido.classList.contains('show') ? '▲' : '▼';  
}  

// Funcionalidad del botón Consultor IA
function abrirConsultorIA() {  
 alert("Asistente IA activo. Listo para procesar consultas sobre normativas de permisos de obra, interferencias y gestión contractual de la Línea 2.");  
}  

// Funcionalidad del botón Reporte TXT
function generarReporteTXT() {  
 let textoReporte = "=== REPORTE OPERATIVO DE CERRAMIENTOS - LÍNEA 2 ===\n";
 textoReporte += "Fecha de generación: " + new Date().toLocaleDateString() + "\n\n";
 
 let blob = new Blob([textoReporte], { type: "text/plain;charset=utf-8" });
 let link = document.createElement("a");
 link.href = URL.createObjectURL(blob);
 link.download = "Reporte_Cerramientos_Linea2.txt";
 link.click();
}
