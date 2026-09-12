// 1. Inicializar el mapa centrado en el trayecto de la Línea 2
const map = L.map('map').setView([-12.046374, -77.082793], 12);

// 2. Capa de Google Maps con clase CSS para volverlo gris tenue
L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    attribution: '© Google',
    className: 'mapa-base-gris'
}).addTo(map);

// 3. URL de Google Sheets en CSV
const urlCSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSz_DsP2CT07FaYNRe4MIX7cO25I01gUb9e_aboGNrIHyBzHiVCX-Ea800l6R76rQ/pub?gid=814807134&single=true&output=csv";

// 4. Procesar datos
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
                
                // Contadores para los KPIs
                if (fila.Tipo === 'Estación') conteoEstaciones++;
                else if (fila.Tipo === 'Pozo') conteoPozos++;
                else conteoOtros++;

                // Color morado pastel para todos los puntos
                const colorPastel = '#B19CD9'; 

                // Crear el popup con diseño (al hacer clic)
                const popupContent = `
                    <div class="custom-popup">
                        <h3>${fila.ID} - ${fila.Nombre || 'Estructura'}</h3>
                        <p><b>Tipo:</b> ${fila.Tipo}</p>
                        <p><b>Línea:</b> ${fila.Linea}</p>
                        <p><b>Municipalidad:</b> ${fila.Municipalidad || 'N/A'}</p>
                        <p><b>Estado de Obra:</b> ${fila.Aut_Obra_Resolucion || 'Pendiente'}</p>
                    </div>
                `;

                // Agregar marcadores y la etiqueta de texto permanente
                L.circleMarker([fila.Latitud, fila.Longitud], {
                    radius: 7,
                    fillColor: colorPastel,
                    color: "#ffffff", // Borde blanco sutil
                    weight: 1.5,
                    opacity: 1,
                    fillOpacity: 0.95
                })
                .addTo(map)
                .bindPopup(popupContent)
                .bindTooltip(fila.ID, {
                    permanent: true,       // Mantiene el texto siempre visible
                    direction: 'right',    // Lo coloca a la derecha del punto
                    className: 'etiqueta-texto', // Clase CSS personalizada
                    offset: [5, 0]         // Desplaza ligeramente el texto
                });
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
