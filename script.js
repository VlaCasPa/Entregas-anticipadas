import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, signInWithPopup, signInWithEmailAndPassword, GoogleAuthProvider, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

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

// 2. CONFIGURACIÓN DEL CANDADO DE SEGURIDAD (LISTA BLANCA)
const CORREOS_MAESTROS = [
    "zebaxx@gmail.com", 
    "zehaxx@gmail.com",
    "vcasasp@ccmetrolima.com"
]; 
const DOMINIO_PERMITIDO = "@ccmetrolima.com";

const googleBtnHTML = `
    <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg> Ingresar con Google
`;

// 3. INTERFAZ DE INICIO DE SESIÓN
const btnLoginGoogle = document.getElementById('btn-login-google');
const btnLoginCorp = document.getElementById('btn-login-corp');
const inputEmailCorp = document.getElementById('email-corp');
const inputPassCorp = document.getElementById('pass-corp');
const mensajeError = document.getElementById('mensaje-error');
const pantallaBloqueo = document.getElementById('pantalla-bloqueo');
const appPrincipal = document.getElementById('app-principal');

// 4. LÓGICA DE PERSISTENCIA Y EVENTOS DE LOGIN
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    btnLoginGoogle.addEventListener('click', () => {
        mensajeError.style.display = 'none';
        btnLoginGoogle.innerHTML = "Conectando..."; 
        signInWithPopup(auth, provider).catch(() => {
            mensajeError.innerText = "Error de autenticación.";
            mensajeError.style.display = 'block';
            btnLoginGoogle.innerHTML = googleBtnHTML;
        });
    });

    btnLoginCorp.addEventListener('click', () => {
        const email = inputEmailCorp.value.trim();
        const password = inputPassCorp.value;
        if (!email || !password) return;

        mensajeError.style.display = 'none';
        btnLoginCorp.innerHTML = "Validando..."; 

        signInWithEmailAndPassword(auth, email, password).catch(() => {
            mensajeError.innerText = "Credenciales incorrectas o acceso denegado.";
            mensajeError.style.display = 'block';
            btnLoginCorp.innerHTML = "Ingresar al Sistema";
        });
    });
  });

// 5. VIGILANTE DE AUTENTICACIÓN
onAuthStateChanged(auth, (user) => {
    if (user) {
        const email = user.email.toLowerCase();
        if (email.endsWith(DOMINIO_PERMITIDO) || CORREOS_MAESTROS.includes(email)) {
            pantallaBloqueo.style.display = 'none';
            appPrincipal.style.display = 'block';
            iniciarMotorDelMapa(); 
        } else {
            signOut(auth).then(() => {
                mensajeError.innerText = `Acceso denegado. Comunícate con Vladimir Casas.`;
                mensajeError.style.display = 'block';
                btnLoginGoogle.innerHTML = googleBtnHTML;
            });
        }
    } else {
        pantallaBloqueo.style.display = 'flex';
        appPrincipal.style.display = 'none';
    }
});

// 6. MOTOR ESPACIAL Y GESTIÓN DE DATOS GLOBALES
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
    L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', { maxZoom: 20, attribution: '© Google', className: 'mapa-base-gris' }).addTo(map);

    markerLayer = L.layerGroup().addTo(map); 
    polygonLayer = L.layerGroup().addTo(map); 

    Papa.parse(urlCSV, {
        download: true,
        header: true,
        dynamicTyping: true,
        complete: function(results) {
            let kpiInicial = 0; let kpiLiberado = 0; let kpiCulminado = 0;

            results.data.forEach(fila => {
                if (fila && fila.ID) { 
                    const idLimpio = fila.ID.toString().trim();
                    datosObras[idLimpio] = fila;
                    
                    const estado = fila.Tiene_Liberacion ? fila.Tiene_Liberacion.toString().trim().toLowerCase() : 'no';
                    let categoria = 'liberada';
                    let colorPin = '#B19CD9'; 
                    let isReciente = false;
                    
                    if (estado === 'culminada') { categoria = 'culminada'; colorPin = '#365735'; kpiCulminado++; listasReporte.culminada.push(idLimpio); } 
                    else if (estado === 'no') { categoria = 'inicial'; kpiInicial++; listasReporte.inicial.push(idLimpio); } 
                    else { categoria = 'liberada'; kpiLiberado++; listasReporte.liberada.push(idLimpio); }

                    if (categoria === 'liberada' || categoria === 'culminada') {
                        const fechaC = parseDatePeru(fila['Fecha de constatacion notarial'] || fila.Fecha_Constatacion);
                        const fechaL = parseDatePeru(fila['Fecha de liberacion parcial'] || fila.Fecha_Liberacion);
                        let maxDate = (fechaC && fechaL) ? new Date(Math.max(fechaC, fechaL)) : (fechaC || fechaL);
                        if (maxDate && ((new Date() - maxDate) / (1000 * 60 * 60 * 24)) <= 30 && ((new Date() - maxDate) >= 0)) {
                            listasReporte.recientes.push(idLimpio);
                            isReciente = true;
                        }
                    }

                    datosObras[idLimpio].isReciente = isReciente;

                    if (fila.Latitud !== undefined && fila.Latitud !== null && fila.Longitud !== undefined && fila.Longitud !== null) {
                        const lat = parseFloat(fila.Latitud.toString().replace(/,/g, '.').trim());
                        const lng = parseFloat(fila.Longitud.toString().replace(/,/g, '.').trim());

                        if (!isNaN(lat) && !isNaN(lng)) {
                            const pin = L.circleMarker([lat, lng], { pane: 'panelPines', radius: 7, fillColor: colorPin, color: "#ffffff", weight: 1.5, opacity: 1, fillOpacity: 0.95 }).bindTooltip(idLimpio, { permanent: true, direction: 'right', className: 'etiqueta-texto', offset: [8, 0] });
                            pin.categoriaObj = categoria;
                            pin.isRecienteObj = isReciente;
                            if (categoria !== 'inicial') pin.bindPopup(generarPopupHTML(fila, idLimpio), { className: 'custom-popup-wrapper' });
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

    return `<div class="popup-container">
        <div class="popup-header"><h3>${idLimpio}</h3><span class="popup-subtitle">📍 Línea 2 y Ramal 4</span></div>
        <div class="popup-card residual-card"><h4><span class="icon">🚧</span> Cerramiento</h4><div class="popup-detail"><span>Constatación:</span><b>${fechaConst}</b></div><div class="popup-detail"><span>Liberación:</span><b>${fechaLib}</b></div></div>
        <div class="popup-card doc-card"><h4><span class="icon">📄</span> Técnico</h4><div class="popup-detail"><span>Asiento N°:</span><b>${asiento}</b></div><div class="popup-detail"><span>Plano:</span><b>${plano}</b></div></div>
    </div>`;
}

function obtenerEstiloPoligono(categoria, tipoPoligono) {
    if (categoria === 'culminada') return { color: '#365735', fillColor: '#365735', weight: 2, fillOpacity: 0.4, opacity: 0.8 };
    if (categoria === 'inicial') return tipoPoligono === 'inicial' ? { color: '#DBA4A0', fillColor: '#DBA4A0', weight: 2, fillOpacity: 0.5, opacity: 1 } : { opacity: 0, fillOpacity: 0 }; 
    if (categoria === 'liberada') {
        if (tipoPoligono === 'residual') return { color: '#FF009D', fillColor: '#FF009D', weight: 2, fillOpacity: 0.4, opacity: 1 };
        if (tipoPoligono === 'liberado') return { color: '#00DBFF', fillColor: '#00DBFF', weight: 2, fillOpacity: 0.4, opacity: 1 };
    }
    return { opacity: 0, fillOpacity: 0 }; 
}

function cargarPoligonos() {
    fetch('cerramientos.geojson').then(r => r.json()).then(geojsonData => {
        geojsonData.features.sort((a, b) => {
            const peso = { "inicial": 1, "liberado": 2, "residual": 3 };
            return (peso[(a.properties.tipo || "").toString().trim().toLowerCase()] || 0) - (peso[(b.properties.tipo || "").toString().trim().toLowerCase()] || 0);
        });
        L.geoJSON(geojsonData, {
            style: function(feature) {
                const idLimpio = (feature.properties.ID || feature.properties.id || "").toString().trim();
                const datosCSV = datosObras[idLimpio];
                if (!datosCSV) return { opacity: 0, fillOpacity: 0 };
                const estado = datosCSV.Tiene_Liberacion ? datosCSV.Tiene_Liberacion.toString().trim().toLowerCase() : 'no';
                let categoria = estado === 'no' ? 'inicial' : (estado === 'culminada' ? 'culminada' : 'liberada');
                let mostrar = (filtroActivo === 'todos') || (filtroActivo === 'recientes' && datosCSV.isReciente) || (filtroActivo === categoria);
                return mostrar ? obtenerEstiloPoligono(categoria, (feature.properties.tipo || "").toString().trim().toLowerCase()) : { opacity: 0, fillOpacity: 0 };
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
    let bounds = L.latLngBounds(); let elementosVisibles = 0;
    circleMarkersArray.forEach(pin => {
        let mostrar = (filtro === 'todos') || (filtro === 'recientes' && pin.isRecienteObj) || (pin.categoriaObj === filtro);
        if (mostrar) { if (!markerLayer.hasLayer(pin)) markerLayer.addLayer(pin); bounds.extend(pin.getLatLng()); elementosVisibles++; } 
        else { if (markerLayer.hasLayer(pin)) markerLayer.removeLayer(pin); }
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
                    if (mostrar) { layer.setStyle(obtenerEstiloPoligono(categoria, (layer.feature.properties.tipo || "").toString().trim().toLowerCase())); if (layer.getBounds) bounds.extend(layer.getBounds()); } 
                    else { layer.setStyle({ opacity: 0, fillOpacity: 0 }); }
                }
            });
        }
    });
    if (elementosVisibles > 0 && bounds.isValid()) {
        const isMobile = window.innerWidth <= 600;
        let padTop = isMobile ? 150 : 130, padBottom = isMobile ? 80 : 60;
        if ((padTop + padBottom) >= (map.getSize().y - 50)) { padTop = 15; padBottom = 15; }
        map.flyToBounds(bounds, { paddingTopLeft: [15, padTop], paddingBottomRight: [15, padBottom], maxZoom: 15, duration: 1.5 });
    } else { map.flyTo([-12.059, -77.038], 13, { duration: 1.5 }); }
}

window.copiarReporte = function(e) {
    e.preventDefault();
    const fecha = new Date().toLocaleDateString('es-PE');
    let mensaje = `*Gestión de Cerramientos - Línea 2 Metro* 🚧\n📊 *REPORTE DE ESTADO*\nFecha: ${fecha}\n\n`;
    mensaje += `🔘 *CERRAMIENTOS DE OBRA (${listasReporte.inicial.length}):*\n${listasReporte.inicial.length > 0 ? listasReporte.inicial.join(', ') : 'Ninguno'}\n\n`;
    mensaje += `🟣 *ÁREAS LIBERADAS (${listasReporte.liberada.length}):*\n${listasReporte.liberada.length > 0 ? listasReporte.liberada.join(', ') : 'Ninguno'}\n\n`;
    mensaje += `🟢 *OBRAS CULMINADAS (${listasReporte.culminada.length}):*\n${listasReporte.culminada.length > 0 ? listasReporte.culminada.join(', ') : 'Ninguno'}\n\n`;
    navigator.clipboard.writeText(mensaje).then(() => {
        const btn = document.getElementById('btn-reporte');
        const originalHTML = btn.innerHTML;
        btn.innerHTML = `✅ ¡Copiado con éxito!<span>pégalo donde necesites</span>`;
        btn.style.backgroundColor = '#27ae60';
        setTimeout(() => { btn.innerHTML = originalHTML; btn.style.backgroundColor = ''; }, 2500);
    });
};

// 7. ASISTENTE VIRTUAL LOCAL (IA SEMÁNTICA) - EVOLUCIONADO
const chatbotToggle = document.getElementById('chatbot-toggle');
const chatbotWindow = document.getElementById('chatbot-window');
const closeChat = document.getElementById('close-chat');
const sendChat = document.getElementById('send-chat');
const chatInput = document.getElementById('chat-input');
const chatMessages = document.getElementById('chat-messages');

let ultimoIdConsultado = null; // Memoria de contexto del asistente

chatbotToggle.addEventListener('click', () => { chatbotWindow.style.display = 'flex'; chatbotToggle.style.display = 'none'; });
closeChat.addEventListener('click', () => { chatbotWindow.style.display = 'none'; chatbotToggle.style.display = 'block'; });

function addMessage(text, isUser) {
    const div = document.createElement('div');
    div.className = `msg ${isUser ? 'user-msg' : 'bot-msg'}`;
    div.innerText = text;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function procesarPregunta(pregunta) {
    const p = pregunta.toLowerCase();
    let idEncontrado = null;

    // A. Búsqueda Inversa por Asiento (Requiere al menos 3 números para no confundir con E01)
    if (p.includes("asiento")) {
        const matchNumeros = p.match(/\d{3,}/); 
        if (matchNumeros) {
            const numeroAsiento = matchNumeros[0];
            for (const id in datosObras) {
                const asientoOficial = (datosObras[id]['Asiento de obra'] || datosObras[id].Asiento_Obra || "").toString();
                if (asientoOficial.includes(numeroAsiento)) {
                    ultimoIdConsultado = id; 
                    return `El asiento de obra N° ${numeroAsiento} está registrado para la estructura: ${id}.`;
                }
            }
        }
    }

    // B. Buscar si menciona una estructura en el mensaje actual
    for (const id in datosObras) {
        const idLower = id.toLowerCase();
        if (p.includes(idLower) || p.replace(/\s/g, '').includes(idLower)) {
            idEncontrado = id;
            ultimoIdConsultado = id; // Guardamos el nombre de la estación para futuras preguntas
            break;
        }
    }

    // C. Si no mencionó ninguna estructura ahora, pero tenemos una en memoria
    if (!idEncontrado && ultimoIdConsultado) {
        idEncontrado = ultimoIdConsultado;
    }

    // D. Procesamiento de la respuesta usando el ID final (encontrado o recordado)
    if (idEncontrado) {
        const datos = datosObras[idEncontrado];
        const asiento = datos['Asiento de obra'] || datos.Asiento_Obra || 'Sin registro';
        const liberacion = datos['Fecha de liberacion parcial'] || datos.Fecha_Liberacion || 'Sin registro';
        const constatacion = datos['Fecha de constatacion notarial'] || datos.Fecha_Constatacion || 'Sin registro';

        if (p.includes("asiento")) {
            return asiento !== 'Sin registro' 
                ? `El asiento de obra asociado a la ${idEncontrado} es el N° ${asiento}.`
                : `Actualmente no hay un número de asiento de obra registrado para la ${idEncontrado}.`;
        } else if (p.includes("constat") || p.includes("notarial")) {
            return constatacion !== 'Sin registro'
                ? `La constatación notarial de la ${idEncontrado} se realizó el ${constatacion}.`
                : `Aún no hay fecha de constatación notarial registrada para la ${idEncontrado}.`;
        } else if (p.includes("liber") || p.includes("cuando")) {
            return liberacion !== 'Sin registro' 
                ? `El área de la ${idEncontrado} se liberó el ${liberacion}.`
                : `Aún no hay fecha de liberación parcial registrada para la ${idEncontrado}.`;
        } else {
            return `Información general de ${idEncontrado}:\n- Constatación: ${constatacion !== 'Sin registro' ? constatacion : 'Pendiente'}\n- Liberación: ${liberacion !== 'Sin registro' ? liberacion : 'Pendiente'}\n- Asiento N°: ${asiento !== 'Sin registro' ? asiento : 'Pendiente'}`;
        }
    }

    // E. Fallback si no hay contexto ni coincidencias
    return "No tengo esa información. Por favor especifica a qué estación te refieres (ejemplo: E01) o indícame el número de asiento.";
}

function handleSend() {
    const text = chatInput.value.trim();
    if (!text) return;
    addMessage(text, true);
    chatInput.value = '';
    
    setTimeout(() => {
        const botReply = procesarPregunta(text);
        addMessage(botReply, false);
    }, 600);
}

sendChat.addEventListener('click', handleSend);
chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSend(); });
