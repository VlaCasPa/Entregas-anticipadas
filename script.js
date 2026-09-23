import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

// 1. CREDENCIALES DE TU BÓVEDA FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyAalo8_88axc-5QAGT8Winp72A1utZwzZg",
    authDomain: "cerramientos-l2l4-b157e.firebaseapp.com",
    projectId: "cerramientos-l2l4-b157e",
    storageBucket: "cerramientos-l2l4-b157e.firebasestorage.app",
    messagingSenderId: "21699345602",
    appId: "1:21699345602:web:f715c1203b7516f0cccf5b",
    measurementId: "G-GRNDM7PZ55"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// 2. CONFIGURACIÓN DEL CANDADO DE SEGURIDAD
const CORREO_MAESTRO = "zehaxx@gmail.com"; 
const DOMINIO_PERMITIDO = "@ccmetrolima.com";

// 3. INTERFAZ DE INICIO DE SESIÓN
const btnLogin = document.getElementById('btn-login');
const mensajeError = document.getElementById('mensaje-error');
const pantallaBloqueo = document.getElementById('pantalla-bloqueo');
const appPrincipal = document.getElementById('app-principal');

// 4. CONFIGURAR PERSISTENCIA Y EVENTO DE LOGIN
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    btnLogin.addEventListener('click', () => {
        mensajeError.style.display = 'none';
        btnLogin.innerHTML = "Conectando..."; 
        signInWithPopup(auth, provider)
            .then(() => {
                // El auth state listener se encarga del resto
            })
            .catch((error) => {
                mensajeError.innerText = "Error de autenticación. Verifica tus permisos o prueba desde otra ventana.";
                mensajeError.style.display = 'block';
                btnLogin.innerHTML = `<img src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg" alt="Google Logo"> Ingresar con cuenta corporativa`;
            });
    });
  })
  .catch((error) => {
    console.error("Error al configurar la persistencia:", error);
  });

// 5. VIGILANTE DE AUTENTICACIÓN
onAuthStateChanged(auth, (user) => {
    if (user) {
        const email = user.email.toLowerCase();
        
        // Verificamos si es del dominio corporativo o si eres tú
        if (email.endsWith(DOMINIO_PERMITIDO) || email === CORREO_MAESTRO.toLowerCase()) {
            pantallaBloqueo.style.display = 'none';
            appPrincipal.style.display = 'block';
            iniciarMotorDelMapa(); 
        } else {
            signOut(auth).then(() => {
                mensajeError.innerText = `El correo ${email} no está autorizado en nuestra base de datos.`;
                mensajeError.style.display = 'block';
                btnLogin.innerHTML = `<img src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg" alt="Google Logo"> Ingresar con cuenta corporativa`;
            });
        }
    } else {
        pantallaBloqueo.style.display = 'flex';
        appPrincipal.style.display = 'none';
        btnLogin.innerHTML = `<img src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg" alt="Google Logo"> Ingresar con cuenta corporativa`;
    }
});

// 6. MOTOR ESPACIAL (MAPA Y DATOS)
let mapaInicializado = false;
let map, markerLayer, polygonLayer;
let circleMarkersArray = [];
let listasReporte = { inicial: [], liberada: [], culminada: [], recientes: [] };
let datosObras = {};
let filtroActivo = 'todos';

const urlCSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSz_DsP2CT07FaYNRe4MIX7cO25I01gUb9e_aboGNrIHyBzHiVCX-Ea800l6R76rQ/pub?gid=814807134&single=true&output=csv";

function iniciarMotorDelMapa() {
    if (mapaInicializado) return; 
    mapaInicializado = true;

    map = L.map('map', { zoomControl: false }).setView([-12.059, -77.038], 13); 
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    map.createPane('panelPines');
    map.getPane('panelPines').style.zIndex = 650;

    L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        attribution: '© Google',
        className: 'mapa-base-gris'
    }).addTo(map);

    markerLayer = L.layerGroup().addTo(map); 
    polygonLayer = L.layerGroup().addTo(map); 

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
                        let isReciente = false;
                        
                        if (estado === 'culminada') {
                            categoria = 'culminada';
                            colorPin = '#365735'; 
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

                        if (categoria === 'liberada' || categoria === 'culminada') {
                            const fechaC = parseDatePeru(fila['Fecha de constatacion notarial'] || fila.Fecha_Constatacion);
                            const fechaL = parseDatePeru(fila['Fecha de liberacion parcial'] || fila.Fecha_Liberacion);
                            
                            let maxDate = null;
                            if (fechaC && fechaL) maxDate = new Date(Math.max(fechaC, fechaL));
                            else if (fechaC) maxDate = fechaC;
                            else if (fechaL) maxDate = fechaL;

                            if (maxDate) {
                                const diffDias = (new Date() - maxDate) / (1000 * 60 * 60 * 24);
                                if (diffDias >= 0 && diffDias <= 30) {
                                    listasReporte.recientes.push(idLimpio);
                                    isReciente = true;
                                }
                            }
                        }

                        datosObras[idLimpio].isReciente = isReciente;

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
                                    permanent: true, direction: 'right', className: 'etiqueta-texto', offset: [8, 0]
                                });

                                pin.categoriaObj = categoria;
                                pin.isRecienteObj = isReciente;

                                if (categoria !== 'inicial') {
                                    pin.bindPopup(generarPopupHTML(fila, idLimpio), { className: 'custom-popup-wrapper' });
                                }
                                
                                markerLayer.addLayer(pin);
                                circleMarkersArray.push(pin);
                            }
                        }
                    }
                });

                document.getElementById('kpi-inicial').innerText = kpiInicial;
                document.getElementById('kpi-liberado').innerText = kpiLiberado;
                document.getElementById('kpi-culminado').innerText = kpiCulminado;

                cargarPoligonos();
                
                document.querySelectorAll('.btn-filtro').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        document.querySelectorAll('.btn-filtro').forEach(b => b.classList.remove('activo'));
                        e.target.classList.add('activo');
                        filtroActivo = e.target.getAttribute('data-filtro');
                        aplicarFiltro(filtroActivo);
                    });
                });

            } catch (error) { console.error("Error interno:", error); }
        }
    });
}

function parseDatePeru(fechaStr) {
    if (!fechaStr || typeof fechaStr !== 'string' || fechaStr === 'Sin registro') return null;
    const partes = fechaStr.split('/');
    if (partes.length === 3) return new Date(partes[2], partes[1] - 1, partes[0]);
    return null;
}

function generarPopupHTML(datos, idLimpio) {
    const fechaConst = datos['Fecha de constatacion notarial'] || datos.Fecha_Constatacion || 'Sin registro';
    const fechaLib = datos['Fecha de liberacion parcial'] || datos.Fecha_Liberacion || 'Sin registro';
    const asiento = datos['Asiento de obra'] || datos.Asiento_Obra || 'Sin registro';
    const plano = datos['Codigo de plano'] || datos.Codigo_Plano || 'Sin registro';

    return `
        <div class="popup-container">
            <div class="popup-header"><h3>${idLimpio}</h3><span class="popup-subtitle">📍 Línea 2 y Ramal 4</span></div>
            <div class="popup-card residual-card">
                <h4><span class="icon">🚧</span> Cerramiento</h4>
                <div class="popup-detail"><span>Constatación:</span><b>${fechaConst}</b></div>
                <div class="popup-detail"><span>Liberación:</span><b>${fechaLib}</b></div>
            </div>
            <div class="popup-card doc-card">
                <h4><span class="icon">📄</span> Técnico</h4>
                <div class="popup-detail"><span>Asiento N°:</span><b>${asiento}</b></div>
                <div class="popup-detail"><span>Plano:</span><b>${plano}</b></div>
            </div>
        </div>
    `;
}

function obtenerEstiloPoligono(categoria, tipoPoligono) {
    if (categoria === 'culminada') return { color: '#365735', fillColor: '#365735', weight: 2, fillOpacity: 0.4, opacity: 0.8 };
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
        .then(response => response.json())
        .then(geojsonData => {
            geojsonData.features.sort((a, b) => {
                const peso = { "inicial": 1, "liberado": 2, "residual": 3 };
                return (peso[(a.properties.tipo || "").toString().trim().toLowerCase()] || 0) - 
                       (peso[(b.properties.tipo || "").toString().trim().toLowerCase()] || 0);
            });
            
            L.geoJSON(geojsonData, {
                style: function(feature) {
                    const idLimpio = (feature.properties.ID || feature.properties.id || "").toString().trim();
                    const datosCSV = datosObras[idLimpio];
                    if (!datosCSV) return { opacity: 0, fillOpacity: 0 };
                    
                    const estado = datosCSV.Tiene_Liberacion ? datosCSV.Tiene_Liberacion.toString().trim().toLowerCase() : 'no';
                    let categoria = estado === 'no' ? 'inicial' : (estado === 'culminada' ? 'culminada' : 'liberada');
                    const tipoPoligono = (feature.properties.tipo || "").toString().trim().toLowerCase();
                    
                    let mostrar = (filtroActivo === 'todos') || 
                                  (filtroActivo === 'recientes' && datosCSV.isReciente) || 
                                  (filtroActivo === categoria);

                    return mostrar ? obtenerEstiloPoligono(categoria, tipoPoligono) : { opacity: 0, fillOpacity: 0 };
                },
                onEachFeature: function(feature, layer) {
                    const idLimpio = (feature.properties.ID || feature.properties.id || "").toString().trim();
                    const datosCSV = datosObras[idLimpio];
                    if (datosCSV && (datosCSV.Tiene_Liberacion || "").toString().trim().toLowerCase() !== 'no') {
                        layer.bindPopup(generarPopupHTML(datosCSV, idLimpio), { className: 'custom-popup-wrapper' });
                    }
                }
            }).addTo(polygonLayer);
            circleMarkersArray.forEach(pin => { if(pin.bringToFront) pin.bringToFront(); });
        });
}

function aplicarFiltro(filtro) {
    let bounds = L.latLngBounds();
    let elementosVisibles = 0;

    circleMarkersArray.forEach(pin => {
        let mostrar = (filtro === 'todos') || (filtro === 'recientes' && pin.isRecienteObj) || (pin.categoriaObj === filtro);
        if (mostrar) {
            if (!markerLayer.hasLayer(pin)) markerLayer.addLayer(pin);
            bounds.extend(pin.getLatLng()); 
            elementosVisibles++;
        } else {
            if (markerLayer.hasLayer(pin)) markerLayer.removeLayer(pin);
        }
    });

    polygonLayer.eachLayer(grupoGeojson => {
        if (grupoGeojson.eachLayer) {
            grupoGeojson.eachLayer(layer => {
                const idLimpio = (layer.feature.properties.ID || layer.feature.properties.id || "").toString().trim();
                const datosCSV = datosObras[idLimpio];
                if (datosCSV) {
                    const estado = datosCSV.Tiene_Liberacion ? datosCSV.Tiene_Liberacion.toString().trim().toLowerCase() : 'no';
                    let categoria = estado === 'no' ? 'inicial' : (estado === 'culminada' ? 'culminada' : 'liberada');
                    let mostrar = (filtro === 'todos') || (filtro === 'recientes' && datosCSV.isReciente) || (categoria === filtro);

                    if (mostrar) {
                        layer.setStyle(obtenerEstiloPoligono(categoria, (layer.feature.properties.tipo || "").toString().trim().toLowerCase()));
                        if (layer.getBounds) bounds.extend(layer.getBounds());
                    } else {
                        layer.setStyle({ opacity: 0, fillOpacity: 0 });
                    }
                }
            });
        }
    });

    if (elementosVisibles > 0 && bounds.isValid()) {
        const isMobile = window.innerWidth <= 600;
        let padTop = isMobile ? 150 : 130, padBottom = isMobile ? 80 : 60;
        if ((padTop + padBottom) >= (map.getSize().y - 50)) { padTop = 15; padBottom = 15; }
        map.flyToBounds(bounds, { paddingTopLeft: [15, padTop], paddingBottomRight: [15, padBottom], maxZoom: 15, duration: 1.5 });
    } else {
        map.flyTo([-12.059, -77.038], 13, { duration: 1.5 });
    }
}

window.copiarReporte = function(e) {
    e.preventDefault();
    const fecha = new Date().toLocaleDateString('es-PE');
    let mensaje = `*Gestión de Cerramientos - Línea 2 Metro* 🚧\n📊 *REPORTE DE ESTADO*\nFecha: ${fecha}\n\n`;
    mensaje += `🔘 *CERRAMIENTOS DE OBRA (${listasReporte.inicial.length}):*\n${listasReporte.inicial.length > 0 ? listasReporte.inicial.join(', ') : 'Ninguno'}\n\n`;
    mensaje += `🟣 *ÁREAS LIBERADAS (${listasReporte.liberada.length}):*\n${listasReporte.liberada.length > 0 ? listasReporte.liberada.join(', ') : 'Ninguno'}\n\n`;
    mensaje += `🟢 *OBRAS CULMINADAS (${listasReporte.culminada.length}):*\n${listasReporte.culminada.length > 0 ? listasReporte.culminada.join(', ') : 'Ninguno'}\n\n`;
    mensaje += `🆕 *LIBERACIONES RECIENTES (< 30 DÍAS) (${listasReporte.recientes.length}):*\n${listasReporte.recientes.length > 0 ? listasReporte.recientes.join(', ') : 'Ninguna'}\n\n`;
    mensaje += `🔗 *Ver mapa:* https://vlacaspa.github.io/Entregas-anticipadas/`;
    
    navigator.clipboard.writeText(mensaje).then(() => {
        const btn = document.getElementById('btn-reporte');
        const originalHTML = btn.innerHTML;
        btn.innerHTML = `✅ ¡Copiado con éxito!<span>pégalo donde necesites</span>`;
        btn.style.backgroundColor = '#27ae60';
        setTimeout(() => { btn.innerHTML = originalHTML; btn.style.backgroundColor = ''; }, 2500);
    });
};
