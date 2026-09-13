// 1. Inicializar el mapa centrado en Lima
const map = L.map('map', { zoomControl: false }).setView([-12.059, -77.038], 14); 

// Mover el control de zoom abajo a la derecha para que no estorbe en celulares
L.control.zoom({ position: 'bottomright' }).addTo(map);

// 2. Capa de Google Maps con clase CSS para volverlo gris tenue
L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    attribution: '© Google',
    className: 'mapa-base-gris'
}).addTo(map);

// Grupos de capas
const markerLayer = L.layerGroup().addTo(map); 
const polygonLayer = L.layerGroup(); 

// 3. Enlace de tu Google Sheets (CSV)
const urlCSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSz_DsP2CT07FaYNRe4MIX7cO25I01gUb9e_aboGNrIHyBzHiVCX-Ea800l6R76rQ/pub?gid=814807134&single=true&output=csv";

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
                const idLimpio = fila.ID.toString().trim();
                datosObras[idLimpio] = fila;

                // Convertir comas a puntos (Excel en español)
                const latStr = fila.Latitud.toString().replace(',', '.');
                const lngStr = fila.Longitud.toString().replace(',', '.');
                const lat = parseFloat(latStr);
                const lng = parseFloat(lngStr);

                // Definimos el estado
                const estado = fila.Tiene_Liberacion ? fila.Tiene_Liberacion.toString().trim() : 'No';
                
                let colorPin = '#B19CD9'; // Marcador en forma de circulo de color morado pastel por defecto
                if (estado.toLowerCase() === 'culminada') {
                    colorPin = '#FFF275'; 
                    kpiCulminado++;
                } else if (estado.toLowerCase() === 'no') {
                    kpiInicial++;
                } else {
                    kpiLiberado++;
                }

                if (!isNaN(lat) && !isNaN(lng)) {
                    // Marcador Circular Morado Pastel con etiqueta a la derecha
                    const pin = L.circleMarker([lat, lng], {
                        radius: 7,
                        fillColor: colorPin,
                        color: "#ffffff",
                        weight: 1.5,
                        opacity: 1,
                        fillOpacity: 0.95
                    }).bindTooltip(idLimpio, {
                        permanent: true,
                        direction: 'right', // Etiqueta a la derecha del círculo
                        className: 'etiqueta-texto',
                        offset: [8, 0] // Espacio entre el círculo y el texto
                    });
                    
                    markerLayer.addLayer(pin);
                }
            }
        });

        // Actualizar KPIs
        if(document.getElementById('kpi-inicial')) document.getElementById('kpi-inicial').innerText = kpiInicial;
        if(document.getElementById('kpi-liberado')) document.getElementById('kpi-liberado').innerText = kpiLiberado;
        if(document.getElementById('kpi-culminado')) document.getElementById('kpi-culminado').innerText = kpiCulminado;

        // 5. Cargar polígonos después del CSV
        cargarPoligonos();
    }
});

function cargarPoligonos() {
    fetch('cerramientos.geojson')
        .then(response => {
            if (!response.ok) return;
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
                    if (!datosCSV) return { opacity: 0, fillOpacity: 0 };
                    
                    const estadoLib = datosCSV.Tiene_Liberacion ? datosCSV.Tiene_Liberacion.toString().trim().toLowerCase() : 'no';
                    if (estadoLib === 'culminada') return { opacity: 0, fillOpacity: 0 };

                    // NUEVOS COLORES SOLICITADOS
                    if (estadoLib === 'no') {
                        if (tipoPoligono === 'inicial') return { color: '#808080', fillColor: '#808080', weight: 1, fillOpacity: 0.4 };
                        return { opacity: 0, fillOpacity: 0 }; 
                    } else {
                        // Residuales sea FF009D y para liberado 00DBFF en color transparente
                        if (tipoPoligono === 'residual') return { color: '#FF009D', fillColor: '#FF009D', weight: 2, fillOpacity: 0.4 };
                        if (tipoPoligono === 'liberado') return { color: '#00DBFF', fillColor: '#00DBFF', weight: 2, fillOpacity: 0.4 };
                        return { opacity: 0, fillOpacity: 0 }; 
                    }
                }
            }).addTo(polygonLayer);
        })
        .catch(err => console.error(err));
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
