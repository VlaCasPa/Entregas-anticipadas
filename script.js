const map = L.map('map').setView([-12.055, -77.050], 13);  

L.tileLayer('http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {  
 maxZoom: 20,  
 subdomains: ['mt0','mt1','mt2','mt3'],  
 attribution: '&copy; Google',  
 opacity: 0.65,  
 className: 'mapa-google-gris'  
}).addTo(map);  

const urlCSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSz_DsP2CT07FaYNRe4MIX7cO25I01gUb9e_aboGNrIHyBzHiVCX-Ea800l6R76rQ/pub?gid=814807134&single=true&output=csv";  

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

 // 1. PROCESAMIENTO ÚNICO POR ESTRUCTURA (Evaluación exacta de las estructuras únicas de la BD)
 let estructurasUnicasMap = new Map();

 csvData.forEach(item => {  
   if (item.ID) {  
     let idNorm = normalizarID(item.ID);  
     mapaDatosSheets[idNorm] = item;  

     if (!estructurasUnicasMap.has(idNorm)) {
       let keys = Object.keys(item);
       // Evaluación precisa de la Columna D o estado de culminación
       let valColD = item[keys[3]] ? item[keys[3]].trim().toLowerCase() : ""; 
       let tipoC = item.Tipo_Cerramiento ? item.Tipo_Cerramiento.trim().toLowerCase() : "";  
       let tieneLib = item.Tiene_Liberacion ? item.Tiene_Liberacion.trim().toUpperCase() : "";  

       let esCulminada = (valColD === "culminada" || tipoC === "culminada" || valColD === "culminado" || valColD === "si");
       let esResidual = (tipoC.includes("residual") || tipoC === "residual");
       let esLiberado = (tieneLib === "SI" || tipoC.includes("liberado"));

       let estadoCalculado = 'inicial';
       if (esCulminada) {
         countCulminada++;
         estadoCalculado = 'culminada';
       } else if (esResidual) {
         countResidual++;
         estadoCalculado = 'residual';
       } else if (esLiberado) {
         countLiberado++;
         estadoCalculado = 'liberado';
       } else {
         countInicial++;
         estadoCalculado = 'inicial';
       }

       estructurasUnicasMap.set(idNorm, {
         ...item,
         estadoCalculado: estadoCalculado
       });
     }
   }  
 });  

 document.getElementById('kpi-inicial').innerText = countInicial;  
 document.getElementById('kpi-residual').innerText = countResidual;  
 document.getElementById('kpi-liberado').innerText = countLiberado;  
 document.getElementById('kpi-culminada').innerText = countCulminada;  

 // 2. ORDEN DE CARGA DE POLÍGONOS (Residual al final)
 let featuresOrdenadas = [...geojsonData.features].sort((a, b) => {
   let tA = (a.properties.tipo || "").toLowerCase();
   let tB = (b.properties.tipo || "").toLowerCase();
   if (tA === "residual") return 1;  
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
     if (filtroEstado === '30dias') return false; 
     return true;
   })
 };

 L.geoJSON(geojsonFiltrado, {  
   style: estiloPoligono,  
   onEachFeature: function(feature, layer) {  
     let idGeo = normalizarID(feature.properties.id || feature.properties.ID);  
     let datos = mapaDatosSheets[idGeo] || { ID: feature.properties.id || 'N/A', Nombre: 'Estructura Línea 2 y 4' };  
     layer.bindPopup(generarHTMLPopup(datos.ID || feature.properties.id, datos));   
   }  
 }).addTo(grupoPoligonos);  

 // 3. CARGA DE MARCADORES E IDS (Garantizando presencia y zoom out en todos los estados)
 let boundsArray = [];
 estructurasUnicasMap.forEach((item, idNorm) => {  
   let cumpleFiltro = true;
   if (filtroEstado === 'inicial') cumpleFiltro = (item.estadoCalculado === 'inicial');
   if (filtroEstado === 'residual') cumpleFiltro = (item.estadoCalculado === 'residual');
   if (filtroEstado === 'liberado') cumpleFiltro = (item.estadoCalculado === 'liberado');
   if (filtroEstado === 'culminada') cumpleFiltro = (item.estadoCalculado === 'culminada');
   if (filtroEstado === '30dias') cumpleFiltro = false;

   if (cumpleFiltro) {
     let lat = parseFloat(item.Latitud ? item.Latitud.toString().replace(',', '.') : "");  
     let lon = parseFloat(item.Longitud ? item.Longitud.toString().replace(',', '.') : "");  

     if (!isNaN(lat) && !isNaN(lon)) {  
       boundsArray.push([lat, lon]);

       let marker = L.circleMarker([lat, lon], { radius: 7, fillColor: "#FACC15", color: "#1E293B", weight: 2, opacity: 1, fillOpacity: 1 });  
       marker.bindTooltip(item.ID, { permanent: true, direction: 'right', className: 'id-tooltip', offset: [5, 0] });  
       marker.bindPopup(generarHTMLPopup(item.ID, item));
       marker.addTo(grupoMarcadoresIDs);  
     }  
   }  
 });  

 // Zoom Out dinámico (fitBounds) garantizado para cualquier filtro
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

function toggleLeyenda() {
 const contenido = document.getElementById('leyendaContenido');
 const icon = document.getElementById('leyenda-icon');
 contenido.classList.toggle('show');
 icon.innerText = contenido.classList.contains('show') ? '▲' : '▼';
}

function toggleConsultorIA() {
 document.getElementById('desplegableIA').classList.toggle('show');
}

function ejecutarConsultaIA() {
 let consulta = document.getElementById('inputConsultaIA').value.trim().toUpperCase();
 let cajaResp = document.getElementById('respuestaIA');
 
 if(!consulta) { 
   cajaResp.innerText = "Ingrese un ID de estructura válido."; 
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
   cajaResp.innerText = `No se encontraron registros para el ID "${consulta}".`;
 }
}

// Botón de Reporte con feedback visual discreto estilo "Copiado"
function copiarReporteTexto() {
 let textoReporte = "=== REPORTE OPERATIVO LÍNEA 2 Y 4 ===\n";
 textoReporte += "- Cerco Inicial: " + document.getElementById('kpi-inicial').innerText + "\n";
 textoReporte += "- Área Residual: " + document.getElementById('kpi-residual').innerText + "\n";
 textoReporte += "- Área Liberada: " + document.getElementById('kpi-liberado').innerText + "\n";
 textoReporte += "- Culminadas: " + document.getElementById('kpi-culminada').innerText + "\n";
 textoReporte += "Diseñado por Vladimir Casas.";

 navigator.clipboard.writeText(textoReporte).then(() => {
   let btn = document.getElementById('btnReporte');
   let textoOriginal = btn.innerHTML;
   btn.innerHTML = '✅ Copiado';
   btn.classList.add('copiado');
   setTimeout(() => {
     btn.innerHTML = textoOriginal;
     btn.classList.remove('copiado');
   }, 2000);
 }).catch(err => {
   alert("Error al copiar: " + err);
 });
}
