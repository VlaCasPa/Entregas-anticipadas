// 1. Inicializar el mapa centrado en Lima
const map = L.map('map').setView([-12.059, -77.038], 14); // Centrado cerca a E13 para la prueba

// 2. Capa de Google Maps con clase CSS para volverlo gris tenue
L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    attribution: '© Google',
    className: 'mapa-base-gris'
}).addTo(map);

// Grupos de capas para controlar qué se oculta con el zoom
const markerLayer = L.layerGroup().addTo(map); // Los pines siempre se ven
const polygonLayer = L.layerGroup(); // Los polígonos inician ocultos y se ven con el zoom

// 3. Enlace de tu Google Sheets (CSV)
const urlCSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSz_DsP2CT07FaYNRe4MIX7cO25I01gUb9e_aboGNrIHyBzHiVCX-Ea800l6R76rQ/pub?gid=814807134&single=true&output=csv";

// Diccionario para guardar los datos del CSV y cruzarlos con el GeoJSON
let datosObras = {};

// 4. Procesar el CSV
Papa.parse(urlCSV, {
    download: true,
    header: true,
    dynamicTyping: true,
    complete: function(results) {
        const data = results.data;

        // Variables para los KPIs
        let kpiInicial = 0;
        let kpiLiberado = 0;
        let kpiCulminado = 0;

        data.forEach(fila => {
            if (fila.Latitud && fila.Longitud && fila.ID) {
                // Guardamos la fila en el diccionario usando el ID como llave
                datosObras[fila.ID] = fila;

                // Definimos el estado
                const estado = fila.Tiene_Liberacion ? fila.Tiene_Liberacion.toString().trim() : 'No';
                
                // Color del marcador (Pin) según el estado
                let colorPin = '#B19CD9'; // Morado pastel por defecto
                if (estado.toLowerCase() === 'culminada') {
                    colorPin = '#FFF275'; // Amarillo pastel tenue
                    kpiCulminado++;
                } else if (estado.toLowerCase() === 'no') {
                    kpiInicial++;
                } else {
                    kpiLiberado++;
                }

                // Dibujar el Marcador (Pin circular)
                const pin = L.circleMarker([fila.Latitud, fila.Longitud], {
                    radius: 7,
                    fillColor: colorPin,
                    color: "#ffffff",
                    weight: 1.5,
                    opacity: 1,
                    fillOpacity: 0.95
                }).bindTooltip(fila.ID, {
                    permanent: true,
                    direction: 'right',
                    className: 'etiqueta-texto',
                    offset: [5, 0]
                });
                
                markerLayer.addLayer(pin);
            }
        });

        // Actualizar KPIs en el HTML (asegúrate de tener estos IDs en tu index.html luego)
        if(document.getElementById('kpi-inicial')) document.getElementById('kpi-inicial').innerText = kpiInicial;
        if(document.getElementById('kpi-liberado')) document.getElementById('kpi-liberado').innerText = kpiLiberado;
        if(document.getElementById('kpi-culminado')) document.getElementById('kpi-culminado').innerText = kpiCulminado;

        // 5. UNA VEZ CARGADO EL CSV, CARGAMOS EL GEOJSON DE POLÍGONOS
        cargarPoligonos();
    }
});

function cargarPoligonos() {
    fetch('cerramientos.geojson')
        .then(response => response.json())
        .then(geojsonData => {
            L.geoJSON(geojsonData, {
                style: function(feature) {
                    const id = feature.properties.id;
                    const tipoPoligono = feature.properties.tipo.toLowerCase(); // "inicial", "residual", "liberado"
                    const datosCSV = datosObras[id];

                    // Si la estructura no está en el Excel o está Culminada, ocultamos el polígono
                    if (!datosCSV) return { opacity: 0, fillOpacity: 0 };
                    
                    const estadoLib = datosCSV.Tiene_Liberacion ? datosCSV.Tiene_Liberacion.toString().trim().toLowerCase() : 'no';

                    if (estadoLib === 'culminada') {
                        return { opacity: 0, fillOpacity: 0 };
                    }

                    // Reglas de colores pastel transparentes
                    if (estadoLib === 'no') {
                        // Sin liberación: Solo se ve el poligono "inicial" en gris transparente
                        if (tipoPoligono === 'inicial') return { color: '#808080', fillColor: '#808080', weight: 1, fillOpacity: 0.4 };
                        return { opacity: 0, fillOpacity: 0 }; 
                    } else {
                        // Con liberación: Morado pastel (residual) y Celeste pastel (liberado)
                        if (tipoPoligono === 'residual') return { color: '#B19CD9', fillColor: '#B19CD9', weight: 1, fillOpacity: 0.5 };
                        if (tipoPoligono === 'liberado') return { color: '#AEC6CF', fillColor: '#AEC6CF', weight: 1, fillOpacity: 0.5 };
                        return { opacity: 0, fillOpacity: 0 }; 
                    }
                }
            }).addTo(polygonLayer);
        });
}

// 6. Lógica de Zoom Dinámico (Solo muestra polígonos al acercarse)
map.on('zoomend', function() {
    const currentZoom = map.getZoom();
    if (currentZoom >= 15) {
        if (!map.hasLayer(polygonLayer)) map.addLayer(polygonLayer);
    } else {
        if (map.hasLayer(polygonLayer)) map.removeLayer(polygonLayer);
    }
});
