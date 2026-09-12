const map = L.map('map').setView([-12.055, -77.050], 13);

// Capa Base Google Maps
L.tileLayer('http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['mt0','mt1','mt2','mt3'],
    attribution: '&copy; Google',
    opacity: 0.65,
    className: 'mapa-google-gris'
}).addTo(map);

// CSV publicado desde BD_Cerramientos
const urlCSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSz_DsP2CT07FaYNRe4MIX7cO25I01gUb9e_aboGNrIHyBzHiVCX-Ea800l6R76rQ/pub?gid=814807134&single=true&output=csv";

// Grupos de capas
let grupoMarcadores = L.featureGroup().addTo(map);
let grupoPoligonos = L.featureGroup().addTo(map);

let mapaDatosSheets = {};

function normalizarID(texto) {
    if (!texto) return "";
    return texto.toString().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

function estiloPoligono(feature) {
    let tipo = feature.properties.tipo ? feature.properties.tipo.toLowerCase() : "";
    
    if (tipo === "residual") {
        return {
            color: "#ec4899",
            fillColor: "#f472b6",
            weight: 2,
            opacity: 0.9,
            fillOpacity: 0.40
        };
    } else if (tipo === "liberado") {
        return {
            color: "#06b6d4",
            fillColor: "#67e8f9",
            weight: 2,
            opacity: 0.9,
            fillOpacity: 0.45
        };
    } else {
        // Inicial
        return {
            color: "#475569",
            fillColor: "#64748b",
            weight: 2,
            opacity: 0.8,
            fillOpacity: 0.35
        };
    }
}

// Carga simultánea: GeoJSON y Google Sheets
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
    let countInicial = 0;
    let countResidual = 0;
    let countLiberado = 0;

    // Indexar datos de la hoja por ID normalizado
    csvData.forEach(item => {
        if (item.ID) {
            let idNorm = normalizarID(item.ID);
            mapaDatosSheets[idNorm] = item;

            let tipoC = item.Tipo_Cerramiento ? item.Tipo_Cerramiento.trim().toLowerCase() : "";
            let tieneLib = item.Tiene_Liberacion ? item.Tiene_Liberacion.trim().toUpperCase() : "";

            if (tieneLib === "SI") countLiberado++;
            if (tipoC === "residual") countResidual++;
            else if (tipoC === "inicial") countInicial++;

            // Crear marcador puntual para el zoom out
            let lat = parseFloat(item.Latitud ? item.Latitud.toString().replace(',', '.') : "");
            let lon = parseFloat(item.Longitud ? item.Longitud.toString().replace(',', '.') : "");

            if (!isNaN(lat) && !isNaN(lon)) {
                let marker = L.circleMarker([lat, lon], {
                    radius: 7,
                    fillColor: tieneLib === "SI" ? "#ec4899" : "#64748b",
                    color: "#ffffff",
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.85
                });

                marker.bindTooltip(item.ID, { permanent: true, direction: 'right', className: 'id-tooltip', offset: [5, 0] });
                marker.addTo(grupoMarcadores);
            }
        }
    });

    // Inyectar KPIs
    if (document.getElementById('kpi-inicial')) document.getElementById('kpi-inicial').innerText = countInicial;
    if (document.getElementById('kpi-residual')) document.getElementById('kpi-residual').innerText = countResidual;
    if (document.getElementById('kpi-liberado')) document.getElementById('kpi-liberado').innerText = countLiberado;

    // Cargar capa GeoJSON
    L.geoJSON(geojsonData, {
        style: estiloPoligono,
        onEachFeature: function(feature, layer) {
            let idGeo = normalizarID(feature.properties.id);
            let datos = mapaDatosSheets[idGeo] || {};

            let tieneLiberacion = datos.Tiene_Liberacion && datos.Tiene_Liberacion.trim().toUpperCase() === "SI";

            // Ventana emergente condicionada a cerramientos con liberación (residual)
            if (tieneLiberacion) {
                let popupHtml = `
                    <div class="popup-container">
                        <h3 class="popup-title">${datos.ID || feature.properties.id}: ${datos.Nombre || 'Estructura L2'}</h3>
                        <div class="popup-subtitle">Tipo: Cerramiento Residual (Activo)</div>
                        <div class="popup-dato">🗓️ <b>Fecha Constatación:</b> ${datos.Fecha_Constatacion || '-'}</div>
                        <div class="popup-dato">🚧 <b>Fecha Liberación:</b> ${datos.Fecha_Liberacion || '-'}</div>
                        <div class="popup-dato">📖 <b>Asiento de Obra:</b> ${datos.Asiento_Obra || '-'}</div>
                        <div class="popup-dato">📐 <b>Código de Plano:</b> ${datos.Codigo_Plano || '-'}</div>
                    </div>
                `;
                layer.bindPopup(popupHtml);
            }
        }
    }).addTo(grupoPoligonos);

    // Zoom semántico: z < 16 puntos, z >= 16 polígonos
    function ajustarCapasPorZoom() {
        let zoom = map.getZoom();
        if (zoom >= 16) {
            if (map.hasLayer(grupoMarcadores)) map.removeLayer(grupoMarcadores);
            if (!map.hasLayer(grupoPoligonos)) map.addLayer(grupoPoligonos);
        } else {
            if (!map.hasLayer(grupoMarcadores)) map.addLayer(grupoMarcadores);
            if (map.hasLayer(grupoPoligonos)) map.removeLayer(grupoPoligonos);
        }
    }

    map.on('zoomend', ajustarCapasPorZoom);
    ajustarCapasPorZoom();

    // Centrar automáticamente
    if (grupoPoligonos.getBounds().isValid()) {
        map.fitBounds(grupoPoligonos.getBounds(), { padding: [40, 40] });
    }
});