// Inicialización con Zoom Dinámico (FitBounds) optimizado para celulares y web
const map = L.map('map').setView([-12.055, -77.050], 12);  

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
let estructurasUnicasMap = new Map(); 

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
 
 grupoPoligonos.clearLayers();
 grupoMarcadoresIDs.clearLayers();
 mapaDatosSheets = {};
 estructurasUnicasMap.clear();

 csvData.forEach(item => {  
   if (item.ID) {  
     let idNorm = normalizarID(item.ID);  
     mapaDatosSheets[idNorm] = item;  

     if (!estructurasUnicasMap.has(idNorm)) {
       let keys = Object.keys(item);
       let valColD = item[keys[3]] ? item[keys[3]].trim().toLowerCase() : ""; 

       let esCulminada = (valColD.includes("culminada") || valColD.includes("culminado"));
       let esSi = (valColD === "si");
       let esNo = (valColD === "no");

       let estadoCalculado = 'inicial';
       if (esCulminada) {
         estadoCalculado = 'culminada';
       } else if (esSi) {
         estadoCalculado = 'liberado_residual'; 
       } else if (esNo) {
         estadoCalculado = 'inicial';
       } else {
         estadoCalculado = 'inicial';
       }

       estructurasUnicasMap.set(idNorm, {
         ...item,
         estadoCalculado: estadoCalculado,
         esSi: esSi,
         esCulminada: esCulminada,
         esNo: esNo
       });
     }
   }  
 });  

 let countInicial = 0, countResidual = 0, countLiberado = 0, countCulminada = 0;
 
 estructurasUnicasMap.forEach((data) => {
   if (data.esCulminada) {
     countCulminada++;
   } else if (data.esSi) {
     countLiberado++;
     countResidual++; 
   } else {
     countInicial++; 
   }
 });

 document.getElementById('kpi-inicial').innerText = countInicial;  
 document.getElementById('kpi-residual').innerText = countResidual;  
 document.getElementById('kpi-liberado').innerText = countLiberado;  
 document.getElementById('kpi-culminada').innerText = countCulminada;  

 let featuresOrdenadas = [...geojsonData.features].sort((a, b) => {
   let tA = (a.properties.tipo || "").toLowerCase();
   let tB = (b.properties.tipo || "").toLowerCase();
   if (tA === "residual") return 1;  
   if (tB === "residual") return -1;
   return 0;
 });

 let idsPoligonosFiltrados = new Set();
 let contadorIDsFiltrados = 0;

 let geojsonFiltrado = {
   type: "FeatureCollection",
   features: featuresOrdenadas.filter(feature => {
     let tipoGeo = feature.properties.tipo ? feature.properties.tipo.toLowerCase() : "";
     let idGeo = normalizarID(feature.properties.id || feature.properties.ID);
     
     if (filtroEstado === 'todos') {
       idsPoligonosFiltrados.add(idGeo);
       return true;
     }

     let coincide = false;
     if (filtroEstado === 'inicial') coincide = (tipoGeo === 'inicial' || !tipoGeo);
     if (filtroEstado === 'residual') coincide = (tipoGeo === 'residual');
     if (filtroEstado === 'liberado') coincide = (tipoGeo === 'liberado');
     if (filtroEstado === 'culminada') coincide = (tipoGeo === 'culminada');
     if (filtroEstado === '30dias') coincide = false; 

     if (coincide) {
       idsPoligonosFiltrados.add(idGeo);
     }
     return coincide;
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

 let boundsArray = [];
 
 estructurasUnicasMap.forEach((item, idNorm) => {  
   let cumpleFiltro = true;
   if (filtroEstado === 'inicial') cumpleFiltro = (item.estadoCalculado === 'inicial');
   if (filtroEstado === 'residual') cumpleFiltro = (item.estadoCalculado === 'liberado_residual' || idsPoligonosFiltrados.has(idNorm));
   if (filtroEstado === 'liberado') cumpleFiltro = (item.estadoCalculado === 'liberado_residual' || idsPoligonosFiltrados.has(idNorm));
   if (filtroEstado === 'culminada') cumpleFiltro = (item.estadoCalculado === 'culminada');
   if (filtroEstado === '30dias') cumpleFiltro = false;

   if (cumpleFiltro) {
     contadorIDsFiltrados++;

     let lat = parseFloat(item.Latitud ? item.Latitud.toString().replace(',', '.') : "");  
     let lon = parseFloat(item.Longitud ? item.Longitud.toString().replace(',', '.') : "");  

     if (isNaN(lat) || isNaN(lon)) {
       let featMatch = geojsonFiltrado.features.find(f => normalizarID(f.properties.id || f.properties.ID) === idNorm);
       if (featMatch && featMatch.geometry) {
         let coords = featMatch.geometry.coordinates[0][0];
         lon = coords[0];
         lat = coords[1];
       }
     }

     if (!isNaN(lat) && !isNaN(lon)) {  
       boundsArray.push([lat, lon]);

       let marker = L.circleMarker([lat, lon], { radius: 7, fillColor: "#FACC15", color: "#1E293B", weight: 2, opacity: 1, fillOpacity: 1 });  
       marker.bindTooltip(item.ID, { permanent: true, direction: 'right', className: 'id-tooltip', offset: [5, 0] });  
       marker.bindPopup(generarHTMLPopup(item.ID, item));
       marker.addTo(grupoMarcadoresIDs);  
     }  
   }  
 });  

 actualizarTextoFiltroUI(filtroEstado, contadorIDsFiltrados);

 if (boundsArray.length > 0) {
   map.fitBounds(boundsArray, { padding: [50, 50], maxZoom: 13 });
 } else {
   map.setView([-12.055, -77.050], 11);
 }

 setTimeout(() => { map.invalidateSize(); }, 200);
}

function actualizarTextoFiltroUI(filtro, cantidad) {
 let textoEstado = "TODOS";
 if (filtro === 'inicial') textoEstado = "CERRAMIENTO INICIAL";
 if (filtro === 'residual') textoEstado = "ÁREA RESIDUAL";
 if (filtro === 'liberado') textoEstado = "ÁREA LIBERADA";
 if (filtro === 'culminada') textoEstado = "OBRA CULMINADA";
 if (filtro === '30dias') textoEstado = "< 30 DÍAS";

 let labelMobile = document.getElementById('label-filtro-mobile');
 let labelWeb = document.getElementById('label-filtro-web');
 
 let contenidoStr = `🔍 FILTRAR POR ESTADO: ${textoEstado} (${cantidad})`;
 
 if(labelMobile) labelMobile.innerText = contenidoStr;
 if(labelWeb) labelWeb.innerText = `FILTRAR POR ESTADO: ${textoEstado} (${cantidad})`;
}

// Función actualizada con fondo #F5F5EB, eliminación de tipo y adición de Fecha_Acta
function generarHTMLPopup(idEstructura, datos) {
  return `  
    <div style="min-width: 210px; font-size: 11px; background-color: #F5F5EB; padding: 8px; border-radius: 6px;">  
      <h3 style="font-size: 12px; font-weight: 700; color: #0f172a; margin: 0 0 6px 0; border-bottom: 1px solid #d1d5db; padding-bottom: 4px;">${idEstructura}: ${datos.Nombre || 'Estructura Línea 2 y 4'}</h3>  
      <div style="margin-bottom: 3px;">📅 <b>Constatación:</b> ${datos.Fecha_Constatacion || '-'}</div>  
      <div style="margin-bottom: 3px;">📝 <b>Acta:</b> ${datos.Fecha_Acta || '-'}</div>  
      <div style="margin-bottom: 3px;">🚧 <b>Liberación:</b> ${datos.Fecha_Liberacion || '-'}</div>  
      <div style="margin-bottom: 3px;">📖 <b>Asiento:</b> ${datos.Asiento_Obra || '-'}</div>  
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
                        `- Constatación: ${datosID.Fecha_Constatacion || 'N/A'}<br>` +
                        `- Acta: ${datosID.Fecha_Acta || 'N/A'}<br>` +
                        `- Liberación: ${datosID.Fecha_Liberacion || 'N/A'}<br>` +
                        `- Asiento: ${datosID.Asiento_Obra || 'N/A'}`;
 } else {
   cajaResp.innerText = `No se encontraron registros para el ID "${consulta}".`;
 }
}

function copiarReporteTexto() {
    let idsCercoInicial = [];
    let idsResidual = [];
    let idsLiberado = [];
    let idsCulminada = [];
    let idsMenores30Días = [];

    let fechaHoy = new Date("2026-09-29"); 

    if (estructurasUnicasMap.size > 0) {
        estructurasUnicasMap.forEach((data, idNorm) => {
            let idOriginal = data.ID || idNorm;
            
            if (data.esCulminada) {
                idsCulminada.push(idOriginal);
            } else if (data.esSi) {
                idsLiberado.push(idOriginal);
                idsResidual.push(idOriginal); 
            } else {
                idsCercoInicial.push(idOriginal);
            }

            let fechaStr = data.Fecha_Liberacion || data.Fecha_Constatacion;
            if (fechaStr && fechaStr.includes('/')) {
                let partes = fechaStr.split('/');
                if (partes.length === 3) {
                    let fechaItem = new Date(`${partes[2]}-${partes[1]}-${partes[0]}`);
                    let diferenciaDias = (fechaHoy - fechaItem) / (1000 * 60 * 60 * 24);
                    if (diferenciaDias >= 0 && diferenciaDias <= 30) {
                        idsMenores30Días.push(`${idOriginal} (${fechaStr})`);
                    }
                }
            }
        });
    }

    let textoReporte = "=== REPORTE OPERATIVO LÍNEA 2 Y 4 ===\n\n";
    
    textoReporte += `🚧 Cerco Inicial (${idsCercoInicial.length}):\n`;
    textoReporte += `${idsCercoInicial.join(', ')}\n\n`;

    textoReporte += `📐 Área Residual (${idsResidual.length}):\n`;
    textoReporte += `${idsResidual.join(', ')}\n\n`;

    textoReporte += `🔓 Área Liberada (${idsLiberado.length}):\n`;
    textoReporte += `${idsLiberado.join(', ')}\n\n`;

    textoReporte += `✅ Culminadas (${idsCulminada.length}):\n`;
    textoReporte += `${idsCulminada.join(', ')}\n\n`;
    
    textoReporte += `📅 Registros con área residual o liberada en los últimos 30 días:\n`;
    textoReporte += idsMenores30Días.length > 0 ? `${idsMenores30Días.join(', ')}\n\n` : `Ninguno registrado en el periodo.\n\n`;
    
    textoReporte += `Fecha del reporte: 29/09/2026\n`;
    textoReporte += `Diseñado por Vladimir Casas.`;

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
        alert("Error al copiar el reporte: " + err);
    });
}
