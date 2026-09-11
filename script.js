// 1. Inicializar el Mapa
const map = L.map('map').setView([-12.055, -77.050], 12);

// 2. Capa Google Maps Monocromático Tenue
L.tileLayer('http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['mt0','mt1','mt2','mt3'],
    attribution: '&copy; Google',
    opacity: 0.65,
    className: 'mapa-google-gris' 
}).addTo(map);

// 3. Enlace CSV publicado de la hoja
const urlCSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSz_DsP2CT07FaYNRe4MIX7cO25I01gUb9e_aboGNrIHyBzHiVCX-Ea800l6R76rQ/pub?output=csv";

// Variables globales para filtros y reporte
window.datosGlobales = [];
let marcadoresGuardados = []; 
let grupoMarcadores = L.featureGroup().addTo(map);
let filtroActualID = "Todos";
let filtroActualEstado = "Todos";

function obtenerClaseEstado(dias) {
    if (!dias && dias !== 0) return 'estado-critico'; 
    let d = dias.toString().trim().toLowerCase();
    
    if (d === "exonerado") return 'estado-exonerado';
    if (d === "indefinido") return 'estado-indefinido';
    if (d === "en trámite") return 'estado-tramite';
    if (d === "culminado") return 'estado-culminado'; 
    
    let numDias = parseInt(dias);
    if (numDias >= 29) return 'estado-optimo';
    if (numDias >= 0 && numDias < 29) return 'estado-critico'; 
    if (numDias < 0) return 'estado-vencido'; 
    return 'estado-critico';
}

function formatearDias(dias) {
    let d = dias.toString().trim().toLowerCase();
    if (d === "exonerado") return "Amparo Ley N° 31955";
    if (d === "indefinido") return "Plazo Indefinido";
    if (d === "en trámite") return "Renovación en Trámite";
    if (d === "culminado") return "Obra Finalizada"; 
    
    let num = parseInt(dias);
    if (num < 0) return `¡VENCIDO HACE ${Math.abs(num)} DÍAS!`;
    return `Quedan ${num} días`;
}

// Filtro interactivo y asignación dinámica de colores
function aplicarFiltros() {
    grupoMarcadores.clearLayers(); 
    let boundsCount = 0;

    marcadoresGuardados.forEach(obj => {
        let mostrarPorID = (filtroActualID === "Todos" || obj.datos.ID === filtroActualID);
        let mostrarPorEstado = true;

        if (filtroActualEstado === "Criticos") {
            mostrarPorEstado = (obj.estadoSeveridad === 'vencido' || obj.estadoSeveridad === 'critico');
        } else if (filtroActualEstado === "Menor4Meses") {
            mostrarPorEstado = obj.esMenor4Meses;
        } else if (filtroActualEstado === "Tramite") {
            mostrarPorEstado = (obj.estadoSeveridad === 'tramite');
        } else if (filtroActualEstado === "Culminado") {
            mostrarPorEstado = (obj.estadoSeveridad === 'culminado');
        } else if (filtroActualEstado === "Ley31955") {
            mostrarPorEstado = obj.esLey31955; 
        }

        if (mostrarPorID && mostrarPorEstado) {
            // Asignación de estilos según filtro activo
            if (filtroActualEstado === "Ley31955") {
                obj.marcador.setStyle({ fillColor: "#F97316" });
            } else if (filtroActualEstado === "Menor4Meses") {
                obj.marcador.setStyle({ fillColor: "#EAB308" });
            } else if (filtroActualEstado === "Tramite") {
                obj.marcador.setStyle({ fillColor: "#A855F7" });
            } else {
                obj.marcador.setStyle({ fillColor: obj.colorOriginal });
            }

            obj.marcador.addTo(grupoMarcadores);
            boundsCount++;
        }
    });

    if (boundsCount > 0) {
        map.fitBounds(grupoMarcadores.getBounds(), { padding: [30, 30], maxZoom: 15 });
    }
}

// Lectura de CSV y construcción de capas
Papa.parse(urlCSV, {
    download: true,
    header: true,
    complete: function(results) {
        window.datosGlobales = results.data; 
        let contenedorIDs = document.getElementById('contenedor-filtros-id');
        
        let countCriticos = 0;
        let countMenor4Meses = 0;
        let countLey = 0;
        let countTramite = 0;
        let countCulminados = 0;

        window.datosGlobales.forEach(item => {
            if (item.Latitud && item.Longitud && item.ID) {
                // Crear botón de filtro por estructura si no existe
                if (contenedorIDs && !document.querySelector(`button[data-id="${item.ID}"]`)) {
                    let btn = document.createElement('button');
                    btn.className = 'btn-pill';
                    btn.setAttribute('data-id', item.ID);
                    btn.innerText = item.ID;
                    contenedorIDs.appendChild(btn);
                }

                let claseObra = obtenerClaseEstado(item.Aut_Obra_Dias_Restantes);
                let claseDesvio = obtenerClaseEstado(item.Aut_Desvio_Dias_Restantes);

                let diasObra = parseInt(item.Aut_Obra_Dias_Restantes);
                let diasDesvio = parseInt(item.Aut_Desvio_Dias_Restantes);

                let esVencido = (claseObra === 'estado-vencido' || claseDesvio === 'estado-vencido');
                let esCritico = (claseObra === 'estado-critico' || claseDesvio === 'estado-critico');
                let esTramite = (claseObra === 'estado-tramite' || claseDesvio === 'estado-tramite');
                let esCulminado = (claseObra === 'estado-culminado' || claseDesvio === 'estado-culminado');
                let esLey = (claseObra === 'estado-exonerado' || claseDesvio === 'estado-exonerado');
                
                // Rango preventivo: entre 29 y 120 días
                let esMenor4 = (!esVencido && !esCritico && !esCulminado && (
                    (!isNaN(diasObra) && diasObra >= 29 && diasObra <= 120) ||
                    (!isNaN(diasDesvio) && diasDesvio >= 29 && diasDesvio <= 120)
                ));

                // Conteo de KPIs
                if (esVencido || esCritico) countCriticos++;
                else if (esMenor4) countMenor4Meses++;
                else if (esLey) countLey++;
                else if (esTramite) countTramite++;
                else if (esCulminado) countCulminados++;

                // Pop-up con comentarios
                let comObra = item.Aut_Obra_Comentarios ? `
                    <details class="popup-details">
                        <summary class="popup-summary">💬 Ver comentarios de obra...</summary>
                        <div class="popup-comment-text">${item.Aut_Obra_Comentarios}</div>
                    </details>` : '';
                    
                let comDesvio = item.Aut_Desvio_Comentarios ? `
                    <details class="popup-details">
                        <summary class="popup-summary">💬 Ver comentarios de desvío...</summary>
                        <div class="popup-comment-text">${item.Aut_Desvio_Comentarios}</div>
                    </details>` : '';

                let popupContent = `
                    <div class="popup-container">
                        <h3 class="popup-title">${item.ID}: ${item.Nombre}</h3>
                        <div class="popup-subtitle">📍 ${item.Municipalidad} | ${item.Linea} - ${item.Tipo}</div>
                        <div class="auth-box ${claseObra}">
                            <span class="auth-title">🚧 Autorización de Obra</span>
                            Resolución: ${item.Aut_Obra_Resolucion || 'N/A'}<br>
                            Estado: <b>${formatearDias(item.Aut_Obra_Dias_Restantes)}</b>
                            ${comObra}
                        </div>
                        <div class="auth-box ${claseDesvio}">
                            <span class="auth-title">🚦 Desvío de Tránsito</span>
                            Resolución: ${item.Aut_Desvio_Resolucion || 'N/A'}<br>
                            Estado: <b>${formatearDias(item.Aut_Desvio_Dias_Restantes)}</b>
                            ${comDesvio}
                        </div>
                    </div>
                `;

                // Sanitización de coordenadas
                let lat = parseFloat(item.Latitud.toString().trim().replace(/,/g, '.'));
                let lon = parseFloat(item.Longitud.toString().trim().replace(/,/g, '.'));

                if (!isNaN(lat) && !isNaN(lon)) {
                    let markerColor = item.Tipo && item.Tipo.toLowerCase() === "pozo" ? "#475569" : "#2563EB"; 
                    let severidad = 'normal';

                    if (esCulminado) {
                        markerColor = "#10B981"; 
                        severidad = 'culminado';
                    }
                    if (esTramite) {
                        severidad = 'tramite';
                    }
                    if (esVencido || esCritico) {
                        markerColor = "#DC2626"; 
                        severidad = esVencido ? 'vencido' : 'critico';
                    }
                    
                    let marker = L.circleMarker([lat, lon], {
                        radius: 8,
                        fillColor: markerColor,
                        color: "#ffffff",
                        weight: 2,
                        opacity: 1,
                        fillOpacity: 0.8,
                        className: esMenor4 ? 'brillo-preventivo' : ''
                    });

                    marker.bindPopup(popupContent);
                    marker.bindTooltip(item.ID, { permanent: true, direction: 'right', className: 'id-tooltip', offset: [5, 0] });
                    
                    marcadoresGuardados.push({ 
                        marcador: marker, 
                        datos: item, 
                        estadoSeveridad: severidad,
                        colorOriginal: markerColor, 
                        esLey31955: esLey,
                        esMenor4Meses: esMenor4
                    });
                }
            }
        });

        // Asignación de contadores a tarjetas KPI
        if (document.getElementById('kpi-rojo')) document.getElementById('kpi-rojo').innerText = countCriticos;
        if (document.getElementById('kpi-amarillo')) document.getElementById('kpi-amarillo').innerText = countMenor4Meses;
        if (document.getElementById('kpi-naranja')) document.getElementById('kpi-naranja').innerText = countLey;
        if (document.getElementById('kpi-morado')) document.getElementById('kpi-morado').innerText = countTramite;
        if (document.getElementById('kpi-verde')) document.getElementById('kpi-verde').innerText = countCulminados;

        // Eventos de botones de estructura
        document.querySelectorAll('#contenedor-filtros-id .btn-pill').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('#contenedor-filtros-id .btn-pill').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                filtroActualID = e.target.getAttribute('data-id');
                aplicarFiltros();
            });
        });

        // Eventos de botones de estado
        document.querySelectorAll('.filtro-seccion:nth-child(2) .btn-pill').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filtro-seccion:nth-child(2) .btn-pill').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                filtroActualEstado = e.target.getAttribute('data-estado');
                aplicarFiltros();
            });
        });

        aplicarFiltros(); 
    }
});

// 4. Generador y Copiado de Reporte para WhatsApp
document.addEventListener('DOMContentLoaded', () => {
    let btnWhatsapp = document.getElementById('btn-whatsapp');
    
    if (btnWhatsapp) {
        btnWhatsapp.addEventListener('click', () => {
            if (!window.datosGlobales || window.datosGlobales.length === 0) {
                alert("Los datos aún se están cargando...");
                return;
            }

            let vencidos = [];
            let criticos = [];
            let menor4Meses = [];
            let tramite = [];
            let culminados = []; 
            let ley31955 = []; 

            window.datosGlobales.forEach(item => {
                if (item.ID && item.Latitud) {
                    let claseObra = obtenerClaseEstado(item.Aut_Obra_Dias_Restantes);
                    let claseDesvio = obtenerClaseEstado(item.Aut_Desvio_Dias_Restantes);

                    let diasObra = parseInt(item.Aut_Obra_Dias_Restantes);
                    let diasDesvio = parseInt(item.Aut_Desvio_Dias_Restantes);

                    let esVencido = (claseObra === 'estado-vencido' || claseDesvio === 'estado-vencido');
                    let esCritico = (claseObra === 'estado-critico' || claseDesvio === 'estado-critico');
                    let esTramite = (claseObra === 'estado-tramite' || claseDesvio === 'estado-tramite');
                    let esCulminado = (claseObra === 'estado-culminado' || claseDesvio === 'estado-culminado');
                    let esLey = (claseObra === 'estado-exonerado' || claseDesvio === 'estado-exonerado');

                    let esMenor4 = (!esVencido && !esCritico && !esCulminado && (
                        (!isNaN(diasObra) && diasObra >= 29 && diasObra <= 120) ||
                        (!isNaN(diasDesvio) && diasDesvio >= 29 && diasDesvio <= 120)
                    ));

                    if (esVencido) vencidos.push(item.ID);
                    else if (esCritico) criticos.push(item.ID);
                    else if (esMenor4) menor4Meses.push(item.ID);
                    else if (esTramite) tramite.push(item.ID);
                    else if (esCulminado) culminados.push(item.ID);
                    
                    if (esLey) ley31955.push(item.ID); 
                }
            });

            let fechaHoy = new Date().toLocaleDateString('es-PE');
            let texto = `📊 *REPORTE AUTORIZACIONES - LÍNEA 2 Y RAMAL L4* 🚇\n📅 Fecha: ${fechaHoy}\n\n`;

            if (vencidos.length > 0) texto += `🔴 *VENCIDOS (${vencidos.length}):*\n${vencidos.join(', ')}\n\n`;
            else texto += `🔴 *VENCIDOS:* 0\n\n`;

            if (criticos.length > 0) texto += `🟠 *CRÍTICOS <29 DÍAS (${criticos.length}):*\n${criticos.join(', ')}\n\n`;
            if (menor4Meses.length > 0) texto += `🟡 *POR VENCER <4 MESES (${menor4Meses.length}):*\n${menor4Meses.join(', ')}\n\n`;
            if (tramite.length > 0) texto += `🟣 *EN TRÁMITE (${tramite.length}):*\n${tramite.join(', ')}\n\n`;
            if (culminados.length > 0) texto += `✅ *OBRAS CULMINADAS (${culminados.length}):*\n${culminados.join(', ')}\n\n`;
            if (ley31955.length > 0) texto += `🟠 *AMPARO LEY N° 31955 (${ley31955.length}):*\n${ley31955.join(', ')}\n\n`; 

            texto += `🔗 *Ver mapa interactivo:* https://vlacaspa.github.io/Mapa-Linea-2-4/`;

            let urlWhatsapp = 'https://api.whatsapp.com/send?text=' + encodeURIComponent(texto);

            try {
                let textArea = document.createElement("textarea");
                textArea.value = texto;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            } catch (err) {
                console.error("No se pudo copiar automáticamente");
            }
            
            window.open(urlWhatsapp, '_blank');
        });
    }
});
