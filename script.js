// 1. Inicializar el mapa centrado en Lima
const map = L.map('map').setView([-12.059, -77.038], 14); 

// 2. Capa de Google Maps con clase CSS para volverlo gris tenue
L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    attribution: '© Google',
    className: 'mapa-base-gris'
}).addTo(map);

// Grupos de capas para controlar qué se oculta con el zoom
const markerLayer = L.layerGroup().addTo(map); 
const polygonLayer = L.layerGroup(); 

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
        let kpiInicial = 0;
        let kpiLiberado = 0;
        let kpiCulminado = 0;

        data.forEach(fila => {
            if (fila.Latitud && fila.Longitud && fila.ID) {
                // SOLUCIÓN 1: Limpiar espacios invisibles en el ID del Excel
                const idLimpio = fila.ID.toString().trim();
                datosObras[idLimpio] = fila;

                // SOLUCIÓN 2: Arreglar el Excel en español (Convertir comas a puntos)
                const latStr = fila.Latitud.toString().replace(',', '.');
                const lngStr = fila.Longitud.toString().replace(',', '.');
                const lat = parseFloat(latStr);
                const lng = parseFloat(lngStr);

                // Definimos el estado
                const estado = fila.Tiene_Liberacion ? fila.Tiene_Liberacion.toString().trim() : 'No';
                
                let colorPin = '#B19CD9'; // Morado pastel por defecto
                if (estado.toLowerCase() === 'culminada') {
                    colorPin = '#FFF275'; 
                    kpiCulminado++;
                } else if (estado.toLowerCase() === 'no') {
                    kpiInicial++;
                } else {
                    kpiLiberado++;
                }

                // Solo si las coordenadas se convirtieron exitosamente, dibujamos el Pin
                if (!isNaN(lat) && !isNaN(lng)) {
                    const pin = L.circleMarker([lat, lng], {
                        radius: 7,
                        fillColor: colorPin,
                        color: "#ffffff",
                        weight: 1.5,
                        opacity: 1,
                        fillOpacity: 0.95
                    }).bindTooltip(idLimpio, {
                        permanent: true,
                        direction: 'right',
                        className: 'etiqueta-texto',
                        offset: [5, 0]
                    });
                    
                    markerLayer.addLayer(pin);
                }
            }
        });

        // Actualizar KPIs
        if(document.getElementById('kpi-inicial')) document.getElementById('kpi-inicial').innerText = kpiInicial;
        if(document.getElementById('kpi-liberado')) document.getElementById('kpi-liberado').innerText = kpiLiberado;
        if(document.getElementById('kpi-culminado')) document.getElementById('kpi-culminado').innerText = kpiCulminado;

        // 5. CARGAMOS EL GEOJSON DE POLÍGONOS
        cargarPoligonos();
    }
});

function cargarPoligonos() {
    // SOLUCIÓN 3: Buscar el archivo exactamente con el nombre que lo subiste
    // IMPORTANTE: Si en tu GitHub se llama solo "cerramientos.geojson", borra el "_2" aquí abajo
    fetch('cerramientos.geojson')
        .then(response => {
            if (!response.ok) {
                console.error("No se encontró el GeoJSON. Verifica que el nombre del archivo en GitHub sea idéntico.");
                return;
            }
            return response.json();
        })
        .then(geojsonData => {
            if (!geojsonData) return;
            
            L.geoJSON(geojsonData, {
                style: function(feature) {
                    const id = feature.properties.ID || feature.properties.id;
                    const idLimpio = id ? id.toString().trim() : "";
                    const tipoAtributo = feature.properties.tipo || feature.properties.TIPO || feature.properties.Tipo || "";
                    const tipoPoligono = tipoAtributo.toString().trim().toLowerCase();
                    
                    const datosCSV = datosObras[idLimpio];

                    // Ocultar si no está en el Excel
                    if (!datosCSV) return { opacity: 0, fillOpacity: 0 };
                    
                    const estadoLib = datosCSV.Tiene_Liberacion ? datosCSV.Tiene_Liberacion.toString().trim().toLowerCase() : 'no';

                    // Ocultar si está culminada
                    if (estadoLib === 'culminada') return { opacity: 0, fillOpacity: 0 };

                    // Reglas de colores pastel transparentes
                    if (estadoLib === 'no') {
                        if (tipoPoligono === 'inicial') return { color: '#808080', fillColor: '#808080', weight: 1, fillOpacity: 0.4 };
                        return { opacity: 0, fillOpacity: 0 }; 
                    } else {
                        if (tipoPoligono === 'residual') return { color: '#B19CD9', fillColor: '#B19CD9', weight: 1, fillOpacity: 0.5 };
                        if (tipoPoligono === 'liberado') return { color: '#AEC6CF', fillColor: '#AEC6CF', weight: 1, fillOpacity: 0.5 };
                        return { opacity: 0, fillOpacity: 0 }; 
                    }
                }
            }).addTo(polygonLayer);
        })
        .catch(err => console.error("Error al cargar el mapa de polígonos:", err));
}

// 6. Lógica de Zoom Dinámico
map.on('zoomend', function() {
    const currentZoom = map.getZoom();
    if (currentZoom >= 15) {
        if (!map.hasLayer(polygonLayer)) map.addLayer(polygonLayer);
    } else {
        if (map.hasLayer(polygonLayer)) map.removeLayer(polygonLayer);
    }
});
