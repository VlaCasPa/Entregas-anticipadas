// Funcionalidad para colapsar filtros en móvil
function toggleFiltros() {
  const contenido = document.getElementById('filtrosContenido');
  const icon = document.getElementById('filtro-icon');
  contenido.classList.toggle('show');
  icon.innerText = contenido.classList.contains('show') ? '▲' : '▼';
}

// Funciones de Acciones (Consultor IA y Reporte)
function abrirConsultorIA() {
  alert("Iniciando Consultor IA para análisis contractual y de permisos de obra...");
  // Aquí puede enlazar su lógica o modal del asistente IA
}

function generarReporteTXT() {
  alert("Generando reporte en formato TXT con el estado actual de los cerramientos...");
  // Lógica de exportación de datos a texto plano
}
