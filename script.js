const map = L.map('map', { zoomControl: false }).setView([-12.059, -77.038], 14); 
L.control.zoom({ position: 'bottomright' }).addTo(map);

map.createPane('panelPines');
map.getPane('panelPines').style.zIndex = 650;

L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    attribution: '© Google',
    className: 'mapa-base-gris'
}).addTo(map);

const markerLayer = L.layerGroup().addTo(map); 
const polygonLayer = L.layerGroup(); 
let circleMarkersArray = [];
let listasReporte = { inicial: [], liberada: [], culminada: [], recientes: [] };
let datosObras = {};
let filtroActivo = 'todos';

const urlCSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSz_DsP2CT07FaYNRe4MIX7cO25I01gUb9e_aboGNrIHyBzHiVCX-Ea800l6R76rQ/pub?gid=814807134&single=true&output=csv";

// Helper: Convertir fechas DD/MM/YYYY a objetos Date reales
function parseDatePeru(fechaStr) {
    if (!fechaStr || typeof fechaStr !== 'string' || fechaStr === 'Sin registro') return null;
    const partes = fechaStr.split('/');
    if (partes.length === 3) {
        return new Date(partes[2], partes[1] - 1, partes[0]);
    }
    return null;
}

function generarPopupHTML(datos, idLimpio) {
    const fechaConst = datos['Fecha de constatacion notarial'] || datos.Fecha_Constatacion || 'Sin registro';
    const fechaLib = datos['Fecha de liberacion parcial'] || datos.Fecha_Liberacion || 'Sin registro';
    const asiento = datos['Asiento de obra'] || datos.Asiento_Obra || 'Sin registro';
    const plano = datos['Codigo de plano'] || datos.Codigo_Plano || 'Sin registro';

    return `
        <div class="popup-container">
            <div class="popup-header">
                <h3>${idLimpio}</h3>
                <span class="popup-subtitle">📍 Línea 2 y Ramal 4</span>
            </div>
            
            <div class="popup-card residual-card">
                <h4><span class="icon">🚧</span> Cerramiento</h4>
                <div class="popup-detail">
                    <span>Constatación:</span>
                    <b>${fechaConst}</b>
                </div>
                <div class="popup-detail">
                    <span>Liberación:</span>
                    <b>${fechaLib}</b>
                </div>
            </div>
            
            <div class="popup-card doc-card">
                <h4><span class="icon">📄</span> Técnico</h4>
                <div class="popup-detail">
                    <span>Asiento N°:</span>
                    <b>${asiento}</b>
                </div>
                <div class="popup-detail">
                    <span>Plano:</span>
                    <b>${plano}</b>
                </div>
            </div>
        </div>
    `;
}

Papa.parse(urlCSV, {
    download: true,
    header: true,
    dynamicTyping: true,
    complete: function(results) {
        try {
            const data = results.data;
            let kpiInicial = 0; let kpiLiberado = 0; let kpiCulminado = 0;

            data.forEach(fila => {
                if (fila && fila.ID) { 
                    const idLimpio = fila.ID.toString().trim();
                    datosObras[idLimpio] = fila;
                    
                    const estado = fila.Tiene_Liberacion ? fila.Tiene_Liberacion.toString().trim().toLowerCase() : 'no';
                    let categoria = 'liberada';
                    let colorPin = '#B19CD9'; 
                    
                    if (estado === 'culminada') {
                        categoria = 'culminada';
                        colorPin = '#FFF275'; 
                        kpiCulminado++;
                        listasReporte.culminada.push(idLimpio);
                    } else if (estado === 'no') {
                        categoria = 'inicial';
                        kpiInicial++;
                        listasReporte.inicial.push(idLimpio);
                    } else {
                        categoria = 'liberada';
                        kpiLiberado++;
                        listasReporte.liberada.push(idLimpio);
                    }

                    // --- AUDITORÍA DE FECHAS: < 30 DÍAS ---
                    if (categoria === 'liberada' || categoria === 'culminada') {
                        const fechaC = parseDatePeru(fila['Fecha de constatacion notarial'] || fila.Fecha_Constatacion);
                        const fechaL = parseDatePeru(fila['Fecha de liberacion parcial'] || fila.Fecha_Liberacion);
                        
                        // Encontrar la fecha más reciente
                        let maxDate = null;
                        if (fechaC && fechaL) maxDate = new Date(Math.max(fechaC, fechaL));
                        else if (fechaC) maxDate = fechaC;
                        else if (fechaL) maxDate = fechaL;

                        if (maxDate) {
                            const diffDias = (new Date() - maxDate) / (1000 * 60 * 60 * 24);
                            if (diffDias >= 0 && diffDias <= 30) {
                                listasReporte.recientes.push(idLimpio);
                            }
                        }
                    }

                    if (fila.Latitud !== undefined && fila.Latitud !== null && fila.Longitud !== undefined && fila.Longitud !== null) {
                        const latStr = fila.Latitud.toString().replace(/,/g, '.').trim();
                        const lngStr = fila.Longitud.toString().replace(/,/g, '.').trim();
                        const lat = parseFloat(latStr);
                        const lng = parseFloat(lngStr);

                        if (!isNaN(lat) && !isNaN(lng)) {
                            const pin = L.circleMarker([lat, lng], {
                                pane: 'panelPines',
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

                            pin.categoriaObj = categoria; // Guardar categoría en el pin para el filtro

                            // Ahora SÍ permitimos ventana de datos a las Culminadas
                            if (categoria !== 'inicial') {
                                pin.bindPopup(generarPopupHTML(fila, idLimpio), { className: 'custom-popup-wrapper' });
                            }
                            
                            markerLayer.addLayer(pin);
                            circleMarkersArray.push(pin);
                        }
                    }
                }
            });

            const uiInicial = document.getElementById('kpi-inicial');
            const uiLiberado = document.getElementById('kpi-liberado');
            const uiCulminado = document.getElementById('kpi-culminado');

            if(uiInicial) uiInicial.innerText = kpiInicial;
            if(uiLiberado) uiLiberado.innerText = kpiLiberado;
            if(uiCulminado) uiCulminado.innerText = kpiCulminado;

            cargarPoligonos();

        } catch (error) { console.error("Error interno procesando CSV:", error); }
    },
    error: function(error) { console.error("Fallo al descargar CSV:", error); }
});

// Función Centralizada de Diseño de Polígonos
function obtenerEstiloPoligono(categoria, tipoPoligono) {
    // Para Culminadas: mantiene el tono pero con opacidad drásticamente reducida y bordes ligeros
    if (categoria === 'culminada') {
        if (tipoPoligono === 'inicial') return { color: '#DBA4A0', fillColor: '#DBA4A0', weight: 1, fillOpacity: 0.15, opacity: 0.4 };
        if (tipoPoligono === 'residual') return { color: '#FF009D', fillColor: '#FF009D', weight: 1, fillOpacity: 0.15, opacity: 0.4 };
        if (tipoPoligono === 'liberado') return { color: '#00DBFF', fillColor: '#00DBFF', weight: 1, fillOpacity: 0.15, opacity: 0.4 };
        return { opacity: 0, fillOpacity: 0 };
    }
    
    // Para Iniciales y Liberadas actuales
    if (categoria === 'inicial') {
        if (tipoPoligono === 'inicial') return { color: '#DBA4A0', fillColor: '#DBA4A0', weight: 2, fillOpacity: 0.5, opacity: 1 };
        return { opacity: 0, fillOpacity: 0 }; 
    } 
    
    if (categoria === 'liberada') {
        if (tipoPoligono === 'residual') return { color: '#FF009D', fillColor: '#FF009D', weight: 2, fillOpacity: 0.4, opacity: 1 };
        if (tipoPoligono === 'liberado') return { color: '#00DBFF', fillColor: '#00DBFF', weight: 2, fillOpacity: 0.4, opacity: 1 };
        return { opacity: 0, fillOpacity: 0 }; 
    }
}

function cargarPoligonos() {
    fetch('cerramientos.geojson')
        .then(response => {
            if (!response.ok) throw new Error("No se encontró el GeoJSON.");
            return response.json();
        })
        .then(geojsonData => {
            if (!geojsonData || !geojsonData.features) return;
            
            geojsonData.features.sort((a, b) => {
                const tipoA = (a.properties.tipo || "").toString().trim().toLowerCase();
                const tipoB = (b.properties.tipo || "").toString().trim().toLowerCase();
                const peso = { "inicial": 1, "liberado": 2, "residual": 3 };
                return (peso[tipoA] || 0) - (peso[tipoB] || 0);
            });
            
            L.geoJSON(geojsonData, {
                style: function(feature) {
                    const id = feature.properties.ID || feature.properties.id;
                    const idLimpio = id ? id.toString().trim() : "";
                    const datosCSV = datosObras[idLimpio];
                    
                    if (!datosCSV) return { opacity: 0, fillOpacity: 0 };
                    
                    const estado = datosCSV.Tiene_Liberacion ? datosCSV.Tiene_Liberacion.toString().trim().toLowerCase() : 'no';
                    let categoria = 'liberada';
                    if (estado === 'no') categoria = 'inicial';
                    else if (estado === 'culminada') categoria = 'culminada';

                    const tipoPoligono = (feature.properties.tipo || "").toString().trim().toLowerCase();
                    
                    // Si el filtro no coincide desde la carga, lo oculta
                    if (filtroActivo !== 'todos' && filtroActivo !== categoria) return { opacity: 0, fillOpacity: 0 };

                    return obtenerEstiloPoligono(categoria, tipoPoligono);
                },
                onEachFeature: function(feature, layer) {
                    const id = feature.properties.ID || feature.properties.id;
                    const idLimpio = id ? id.toString().trim() : "";
                    const datosCSV = datosObras[idLimpio];
                    if (datosCSV) {
                        const estado = datosCSV.Tiene_Liberacion ? datosCSV.Tiene_Liberacion.toString().trim().toLowerCase() : 'no';
                        // Ahora permitimos acceso a datos a las culminadas también
                        if (estado !== 'no') {
                            layer.bindPopup(generarPopupHTML(datosCSV, idLimpio), { className: 'custom-popup-wrapper' });
                        }
                    }
                }
            }).addTo(polygonLayer);

            circleMarkersArray.forEach(pin => { if(pin.bringToFront) pin.bringToFront(); });
        })
        .catch(err => console.error("Error en polígonos:", err));
}

// Lógica del Filtro Interactivo
document.querySelectorAll('.btn-filtro').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.btn-filtro').forEach(b => b.classList.remove('activo'));
        e.target.classList.add('activo');
        
        filtroActivo = e.target.getAttribute('data-filtro');
        aplicarFiltro(filtroActivo);
    });
});

function aplicarFiltro(filtro) {
    let bounds = L.latLngBounds();

    // Filtro Pines
    circleMarkersArray.forEach(pin => {
        if (filtro === 'todos' || pin.categoriaObj === filtro) {
            if (!map.hasLayer(pin)) markerLayer.addLayer(pin);
            bounds.extend(pin.getLatLng());
        } else {
            if (map.hasLayer(pin)) markerLayer.removeLayer(pin);
        }
    });

    // Filtro Polígonos
    polygonLayer.eachLayer(layer => {
        const id = layer.feature.properties.ID || layer.feature.properties.id;
        const idLimpio = id ? id.toString().trim() : "";
        const datosCSV = datosObras[idLimpio];
        
        if (datosCSV) {
            const estado = datosCSV.Tiene_Liberacion ? datosCSV.Tiene_Liberacion.toString().trim().toLowerCase() : 'no';
            let categoria = 'liberada';
            if (estado === 'no') categoria = 'inicial';
            else if (estado === 'culminada') categoria = 'culminada';

            if (filtro === 'todos' || categoria === filtro) {
                const tipoPoligono = (layer.feature.properties.tipo || "").toString().trim().toLowerCase();
                layer.setStyle(obtenerEstiloPoligono(categoria, tipoPoligono));
            } else {
                layer.setStyle({ opacity: 0, fillOpacity: 0 });
            }
        }
    });

    // Zoom out dinámico para enfocar todo el resultado filtrado
    if (bounds.isValid()) {
        map.flyToBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
}

map.on('zoomend', function() {
    const currentZoom = map.getZoom();
    if (currentZoom >= 14) {
        if (!map.hasLayer(polygonLayer)) {
            map.addLayer(polygonLayer);
            circleMarkersArray.forEach(pin => { if(pin.bringToFront) pin.bringToFront(); });
        }
    } else {
        if (map.hasLayer(polygonLayer)) map.removeLayer(polygonLayer);
    }
});

function generarReporteWhatsApp(e) {
    e.preventDefault();
    const fecha = new Date().toLocaleDateString('es-PE');
    
    let mensaje = `*Gestión de Cerramientos - Línea 2 Metro* 🚧\n`;
    mensaje += `📊 *REPORTE DE ESTADO*\nFecha: ${fecha}\n\n`;
    
    mensaje += `🔘 *CERRAMIENTOS DE OBRA (${listasReporte.inicial.length}):*\n`;
    mensaje += listasReporte.inicial.length > 0 ? `${listasReporte.inicial.join(', ')}\n\n` : `Ninguno\n\n`;
    
    mensaje += `🟣 *ÁREAS LIBERADAS (${listasReporte.liberada.length}):*\n`;
    mensaje += listasReporte.liberada.length > 0 ? `${listasReporte.liberada.join(', ')}\n\n` : `Ninguno\n\n`;
    
    mensaje += `🟡 *OBRAS CULMINADAS (${listasReporte.culminada.length}):*\n`;
    mensaje += listasReporte.culminada.length > 0 ? `${listasReporte.culminada.join(', ')}\n\n` : `Ninguno\n\n`;

    mensaje += `🆕 *LIBERACIONES RECIENTES (< 30 DÍAS) (${listasReporte.recientes.length}):*\n`;
    mensaje += listasReporte.recientes.length > 0 ? `${listasReporte.recientes.join(', ')}\n\n` : `Ninguna\n\n`;
    
    mensaje += `🔗 *Ver mapa:* https://vlacaspa.github.io/Entregas-anticipadas/`;
    
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`, '_blank');
}
