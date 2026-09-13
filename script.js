// Inicializar el mapa centrado en Lima
const map = L.map('map', { zoomControl: false }).setView([-12.059, -77.038], 14); 
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
            if (fila.ID) { // Contamos desde que exista un ID, tenga coordenadas asignadas o no
                const idLimpio = fila.ID.toString().trim();
                datosObras[idLimpio] = fila;

                const estado = fila.Tiene_Liberacion ? fila.Tiene_Liberacion.toString().trim().toLowerCase() : 'no';
                
                let colorPin = '#B19CD9'; 
                if (estado === 'culminada') {
                    colorPin = '#FFF275'; 
                    kpiCulminado++;
                } else if (estado === 'no') {
                    kpiInicial++;
                } else {
                    kpiLiberado++;
                }

                // Dibujar pines geométricos solo si la estructura tiene coordenadas válidas
                if (fila.Latitud && fila.Longitud) {
                    const latStr = fila.Latitud.toString().replace(',', '.');
                    const lngStr = fila.Longitud.toString().replace(',', '.');
                    const lat = parseFloat(latStr);
                    const lng = parseFloat(lngStr);

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
            }
        });

        // Búsqueda dual de identificadores (Nuevos o Antiguos) para asegurar la conexión
        const uiInicial = document.getElementById('kpi-inicial') || document.getElementById('kpi-estaciones');
        const uiLiberado = document.getElementById('kpi-liberado') || document.getElementById('kpi-pozos');
        const uiCulminado = document.getElementById('kpi-culminado') || document.getElementById('kpi-otros');

        if(uiInicial) uiInicial.innerText = kpiInicial;
        if(uiLiberado) uiLiberado.innerText = kpiLiberado;
        if(uiCulminado) uiCulminado.innerText = kpiCulminado;

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

                    if (estadoLib === 'no') {
                        if (tipoPoligono === 'inicial') return { color: '#808080', fillColor: '#808080', weight: 1, fillOpacity: 0.4 };
                        return { opacity: 0, fillOpacity: 0 }; 
                    } else {
                        if (tipoPoligono === 'residual') return { color: '#FF009D', fillColor: '#FF009D', weight: 2, fillOpacity: 0.4 };
                        if (tipoPoligono === 'liberado') return { color: '#00DBFF', fillColor: '#00DBFF', weight: 2, fillOpacity: 0.4 };
                        return { opacity: 0, fillOpacity: 0 }; 
                    }
                }
            }).addTo(polygonLayer);
        })
        .catch(err => console.error(err));
}

map.on('zoomend', function() {
    const currentZoom = map.getZoom();
    if (currentZoom >= 14) {
        if (!map.hasLayer(polygonLayer)) map.addLayer(polygonLayer);
    } else {
        if (map.hasLayer(polygonLayer)) map.removeLayer(polygonLayer);
    }
});
