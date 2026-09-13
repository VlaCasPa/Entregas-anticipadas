// Inicializar el mapa centrado en Lima (zoom control oculto por defecto para acomodarlo luego)
const map = L.map('map', { zoomControl: false }).setView([-12.059, -77.038], 14); 

// Mover el control de zoom abajo a la derecha para evitar choques con tu interfaz
L.control.zoom({ position: 'bottomright' }).addTo(map);

// Capa de Google Maps gris tenue
L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    attribution: '© Google',
    className: 'mapa-base-gris'
}).addTo(map);

const markerLayer = L.layerGroup().addTo(map); 
const polygonLayer = L.layerGroup(); 

const urlCSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSz_DsP2CT07FaYNRe4MIX7cO25I01gUb9e_aboGNrIHyBzHiVCX-Ea800l6R76rQ/pub?gid=814807134&single=true&output=csv";
let datosObras = {};

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

                const latStr = fila.Latitud.toString().replace(',', '.');
                const lngStr = fila.Longitud.toString().replace(',', '.');
                const lat = parseFloat(latStr);
                const lng = parseFloat(lngStr);

                const estado = fila.Tiene_Liberacion ? fila.Tiene_Liberacion.toString().trim() : 'No';
                
                let colorPin = '#B19CD9'; // Morado pastel siempre
                if (estado.toLowerCase() === 'culminada') {
                    colorPin = '#FFF275'; 
                    kpiCulminado++;
                } else if (estado.toLowerCase() === 'no') {
                    kpiInicial++;
                } else {
                    kpiLiberado++;
                }

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
                        offset: [8, 0]
                    });
                    markerLayer.addLayer(pin);
                }
            }
        });

        if(document.getElementById('kpi-estaciones')) document.getElementById('kpi-estaciones').innerText = kpiInicial;
        if(document.getElementById('kpi-pozos')) document.getElementById('kpi-pozos').innerText = kpiLiberado;
        if(document.getElementById('kpi-otros')) document.getElementById('kpi-otros').innerText = kpiCulminado;

        cargarPoligonos();
    }
});

function cargarPoligonos() {
    fetch('cerramientos_2.geojson')
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

                    // Reglas de colores actualizadas
                    if (estadoLib === 'no') {
                        if (tipoPoligono === 'inicial') return { color: '#808080', fillColor: '#808080', weight: 1, fillOpacity: 0.4 };
                        return { opacity: 0, fillOpacity: 0 }; 
                    } else {
                        // Residual: FF009D | Liberado: 00DBFF
                        if (tipoPoligono === 'residual') return { color: '#FF009D', fillColor: '#FF009D', weight: 2, fillOpacity: 0.4 };
                        if (tipoPoligono === 'liberado') return { color: '#00DBFF', fillColor: '#00DBFF', weight: 2, fillOpacity: 0.4 };
                        return { opacity: 0, fillOpacity: 0 }; 
                    }
                }
            }).addTo(polygonLayer);
        })
        .catch(err => console.error(err));
}

// Zoom dinámico ajustado a 14 para mejor visualización en móvil
map.on('zoomend', function() {
    const currentZoom = map.getZoom();
    if (currentZoom >= 14) {
        if (!map.hasLayer(polygonLayer)) map.addLayer(polygonLayer);
    } else {
        if (map.hasLayer(polygonLayer)) map.removeLayer(polygonLayer);
    }
});
