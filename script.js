// 1. Inicializar el mapa centrado en Lima (puedes ajustar las coordenadas iniciales y el zoom)
const map = L.map('map').setView([-12.046374, -77.082793], 12);

// 2. Agregar la capa de mapa (OpenStreetMap)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
}).addTo(map);

// 3. El enlace de tu Google Sheets en formato CSV
const urlCSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSz_DsP2CT07FaYNRe4MIX7cO25I01gUb9e_aboGNrIHyBzHiVCX-Ea800l6R76rQ/pub?gid=814807134&single=true&output=csv";

// 4. Leer los datos y colocarlos en el mapa
Papa.parse(urlCSV, {
    download: true,
    header: true, // Esto le dice que la primera fila tiene los nombres de las columnas
    dynamicTyping: true, // Convierte números automáticamente
    complete: function(results) {
        const data = results.data;
        console.log("Datos cargados correctamente:", data); // Para que veas los datos en la consola

        // Contadores para tus KPIs (si en el futuro agregas una columna de 'Estado' en tu Excel)
        let countInicial = 0;
        let countResidual = 0;
        let countLiberacion = 0;

        // Recorrer cada fila del Excel
        data.forEach(fila => {
            // Validar que la fila tenga latitud y longitud válidas
            if (fila.Latitud && fila.Longitud) {
                
                // Crear el contenido del recuadro (Popup) que se abre al hacer clic
                const popupContent = `
                    <div style="font-size: 14px;">
                        <h3 style="margin-bottom: 5px; color: #0056b3;">${fila.Nombre || 'Sin nombre'}</h3>
                        <b>ID:</b> ${fila.ID || 'N/A'}<br>
                        <b>Tipo:</b> ${fila.Tipo || 'N/A'}<br>
                        <b>Línea:</b> ${fila.Linea || 'N/A'}<br>
                        <b>Municipalidad:</b> ${fila.Municipalidad || 'N/A'}<br>
                        <b>Resolución de Obra:</b> ${fila.Aut_Obra_Resolucion || 'N/A'}
                    </div>
                `;

                // Colocar el marcador en el mapa
                L.marker([fila.Latitud, fila.Longitud])
                    .addTo(map)
                    .bindPopup(popupContent);
                    
                // Aquí podrías agregar la lógica para contar los KPIs si tuvieras una columna que indique el estado de cerramiento.
                countInicial++; // Solo como ejemplo, cuenta todos
            }
        });
        
        // (Opcional) Si quieres que el mapa se ajuste automáticamente para mostrar todos los puntos:
        // const group = new L.featureGroup(markers);
        // map.fitBounds(group.getBounds());
    },
    error: function(error) {
        console.error("Error al descargar o procesar el CSV:", error);
    }
});
