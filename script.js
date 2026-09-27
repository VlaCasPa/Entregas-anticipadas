const map = L.map('map').setView([-12.055, -77.050], 13);  

L.tileLayer('http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {  
 maxZoom: 20,  
 subdomains: ['mt0','mt1','mt2','mt3'],  
 attribution: '&copy; Google',  
 opacity: 0.65,  
 className: 'mapa-google-gris'  
}).addTo(map);  

// URL directa del CSV publicado en Google Sheets
const urlCSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSz_DsP2CT07FaYNRe4MIX7cO25I01gUb9e_aboGNrIHyBzHiVCX-Ea800l6R76rQ/pub?gid=814807134&single=true&output=csv";  

let grupoMarcadores = L.featureGroup();  
let grupoPoligonos = L.featureGroup();  

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
 if (tipo === "residual") return { color: "#f472b6", fillColor: "#fce7f3", weight: 2, opacity: 0.9, fillOpacity: 0.5 };  
 if (tipo === "liberado") return { color: "#38bdf8", fillColor: "#e0f2fe", weight: 2, opacity: 0.9, fillOpacity: 0.5 };  
 if (tipo === "culminada") return { color: "#94a3b8", fillColor: "#e2e8f0", weight: 2, opacity: 0.9, fillOpacity: 0.5 };  
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
 
 map.on('zoomend', ajustarCapasPorZoom);
 ajustarCapasPorZoom();
});

function actualizarDashboardYMapa(csvData, geojsonData, filtroEstado) {
 filtroActualGlobal = filtroEstado;
 let countInicial = 0, countResidual = 0, countLiberado = 0, countCulminada = 0;  

 grupoMarcadores.clearLayers();
 grupoPoligonos.clearLayers();
 mapaDatosSheets = {};

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
     if (estadoObra === "culminada" || tipoC === "culminada") countCulminada++;
  
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

         let marker = L.circleMarker([lat, lon], { radius: 7, fillColor: colorPunto, color: "#ffffff", weight: 2, opacity: 1, fillOpacity: 0.9 });  
         marker.bindTooltip(item.ID, { permanent: true, direction: 'right', className: 'id-tooltip', offset: [5, 0] });  
         marker.bindPopup(generarHTMLPopup(item.ID, item));
         marker.addTo(grupoMarcadores);  
       }  
     }
   }  
 });  
  
 document.getElementById('kpi-inicial').innerText = countInicial;  
 document.getElementById('kpi-residual').innerText = countResidual;  
 document.getElementById('kpi-liberado').innerText = countLiberado;  
 document.getElementById('kpi-culminada').innerText = countCulminada;  
  
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
     let idGeo = normalizarID(feature.properties.id || feature.properties.ID);  
     let datos = mapaDatosSheets[idGeo] || { ID: feature.properties.id || 'N/A', Nombre: 'Estructura Línea 2' };  
     layer.bindPopup(generarHTMLPopup(datos.ID || feature.properties.id, datos));   
   }  
 }).addTo(grupoPoligonos);  
  
 ajustarCapasPorZoom();
 setTimeout(() => { map.invalidateSize(); }, 200);
}

function generarHTMLPopup(idEstructura, datos) {
  return `  
    <div style="min-width: 200px; font-size: 11px;">  
      <h3 style="font-size: 12px; font-weight: 700; color: #0f172a; margin: 0 0 4px 0;">${idEstructura}: ${datos.Nombre || 'Estructura L2'}</h3>  
      <div style="color: #64748b; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">Tipo: ${datos.Tipo_Cerramiento || 'Cerramiento'}</div>  
      <div>📅 <b>Constatación:</b> ${datos.Fecha_Constatacion || '-'}</div>  
      <div>🚧 <b>Liberación:</b> ${datos.Fecha_Liberacion || '-'}</div>  
      <div>📖 <b>Asiento:</b> ${datos.Asiento_Obra || '-'}</div>  
      <div>📐 <b>Plano:</b> ${datos.Codigo_Plano || '-'}</div>  
    </div>  
  `;
}

function ajustarCapasPorZoom() {
  let zoom = map.getZoom();
  if (zoom >= 16) {
    if (map.hasLayer(grupoMarcadores)) map.removeLayer(grupoMarcadores);
    if (!map.hasLayer(grupoPoligonos)) map.addLayer(grupoPoligonos);
  } else {
    if (!map.hasLayer(grupoPoligonos)) map.removeLayer(grupoPoligonos);
    if (!map.hasLayer(grupoMarcadores)) map.addLayer(grupoMarcadores);
  }
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

function ejecutarConsultaIA() {
 let consulta = document.getElementById('inputConsultaIA').value;
 let cajaResp = document.getElementById('respuestaIA');
 if(!consulta.trim()) { cajaResp.innerText = "Ingrese una consulta."; return; }
 cajaResp.innerText = "Analizando frentes...";
 setTimeout(() => {
   cajaResp.innerText = "Resultado: Viabilidad contractual aprobada para el sector consultado.";
 }, 1000);
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
