// 1. Inicializar el mapa centrado en el trayecto de la Línea 2
const map = L.map('map').setView([-12.046374, -77.082793], 12);

// 2. Capa de Google Maps con clase CSS para volverlo gris tenue
L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    attribution: '© Google',
    className: 'mapa-base-gris' // <-- Esta clase conectará con nuestro CSS
}).addTo(map);

// ... (El resto de tu código Papa.parse y urlCSV se queda exactamente igual) ...

// 2. URL de Google Sheets en CSV
const urlCSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSz_DsP2CT07FaYNRe4MIX7cO25I01gUb9e_aboGNrIHyBzHiVCX-Ea800l6R76rQ/pub?gid=814807134&single=true&output=csv";

// 3. Procesar datos
Papa.parse(urlCSV, {
    download: true,
    header: true,
    dynamicTyping: true,
    complete: function(results) {
        const data = results.data;
        
        let conteoEstaciones = 0;
        let conteoPozos = 0;
        let conteoOtros = 0;

        data.forEach(fila => {
            if (fila.Latitud && fila.Longitud) {
                
                // Determinar el color según la Línea o el Tipo
                let colorMarcador = '#3388ff'; // Azul por defecto
                if (fila.Linea === 'Ramal L4') colorMarcador = '#ff9900'; // Naranja para Ramal L4
                if (fila.Linea === 'Línea 2') colorMarcador = '#d32f2f'; // Rojo para Línea 2

                // Contadores para los KPIs
                if (fila.Tipo === 'Estación') conteoEstaciones++;
                else if (fila.Tipo === 'Pozo') conteoPozos++;
                else conteoOtros++;

                // Crear el popup con diseño
                const popupContent = `
                    <div class="custom-popup">
                        <h3>${fila.ID} - ${fila.Nombre || 'Estructura'}</h3>
                        <p><b>Tipo:</b> ${fila.Tipo}</p>
                        <p><b>Línea:</b> ${fila.Linea}</p>
                        <p><b>Municipalidad:</b> ${fila.Municipalidad || 'N/A'}</p>
                        <p><b>Estado de Obra:</b> ${fila.Aut_Obra_Resolucion || 'Pendiente'}</p>
                    </div>
                `;

                // Agregar marcadores circulares tipo "estación de metro"
                L.circleMarker([fila.Latitud, fila.Longitud], {
                    radius: 8,
                    fillColor: colorMarcador,
                    color: "#ffffff", // Borde blanco
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.9
                }).addTo(map).bindPopup(popupContent);
            }
        });

        // Actualizar los textos de los KPIs en el HTML
        document.getElementById('kpi-estaciones').innerText = conteoEstaciones;
        document.getElementById('kpi-pozos').innerText = conteoPozos;
        document.getElementById('kpi-otros').innerText = conteoOtros;

    },
    error: function(error) {
        console.error("Error al procesar el CSV:", error);
    }
});
