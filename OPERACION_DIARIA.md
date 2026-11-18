# ÁGORA · Operación diaria y comprobantes para Solicitudes de Recursos y Pagos

Actualizado: 18 de noviembre de 2026. Es el repositorio **independiente** `DejavuMp/agora-operaciones-dejavu`; no cambia Compras/Pagos.

## Enlaces
- Coordinación: https://dejavump.github.io/agora-operaciones-dejavu/operaciones/
- Mis jornadas (Staff): https://dejavump.github.io/agora-operaciones-dejavu/operaciones/visor.html
- La nueva herramienta de Solicitudes de Recursos y Pagos es **independiente**. Su vínculo y sus permisos deben proporcionarse desde el portal de herramientas; ÁGORA Operaciones no envía automáticamente solicitudes.

## Estados visibles a coordinación
En **Equipo en vivo** y el dashboard se listan integrantes asignados hoy agrupados por región:
- **Programado:** aún no comienza el horario asignado.
- **Sin cuenta vinculada:** existe la persona en la agenda, pero falta vincular su cuenta Google.
- **Sin entrada:** comenzó el horario asignado, pero no existe un marcaje de entrada confirmado.
- **En traslado:** la persona inició un traslado, aún sin entrada oficial de jornada.
- **Trabajando:** entrada oficial confirmada, jornada abierta y sin descanso activo.
- **En descanso:** jornada abierta con descanso sin reanudar.
- **Jornada terminada:** entrada y salida registradas con tiempo del servidor.

El GPS **no** equivale a una prueba infalible de ubicación: solo se muestra el último punto consentido con antigüedad de hasta cinco minutos, mientras Staff usa ÁGORA con la página abierta. Los puntos de entrada y salida siguen en los registros protegidos de Firestore, aunque ya no aparezcan en el mapa en vivo.

## Crear comprobante de una jornada (Staff)
1. Iniciar sesión con la cuenta vinculada, terminar la actividad y confirmar salida oficial.
2. Entrar a **Mis jornadas → Comprobantes** y pulsar **Crear comprobante de horas**.
3. Revisar las horas oficiales, descansos declarados o registrados y actividades realizadas.
4. Pulsar **Descargar PDF para pagos** para guardar `AGORA_Jornada_<folio>.pdf`. Como alternativa, abrir **Vista imprimible → Guardar como PDF**.
5. Adjuntar el PDF manualmente al nuevo expediente de **Solicitudes de Recursos y Pagos**, anotando el folio del comprobante y el evento. No crear duplicados del mismo gasto.

Para un resumen, seleccionar el mes y pulsar **Descargar resumen PDF** (`AGORA_Resumen_<AAAA-MM>.pdf`).

## Generar PDF desde coordinación
1. Entrar al editor → **Pagos / Comprobantes**.
2. Seleccionar un reporte vinculado a un integrante con cuenta autorizada, evento y salida oficial.
3. Pulsar **PDF para Solicitudes de Pagos**.
4. El sistema consulta el marcaje de salida directamente al servidor de Firebase antes de emitir el documento. No produce el PDF como «oficial» si falta la salida.
5. Adjuntar el archivo al expediente correspondiente en el sistema independiente. Los importes y las aprobaciones deben revisarse allá.

El PDF se genera **en el navegador** con una biblioteca gratuita de código abierto cargada bajo demanda desde CDN. **No existe transferencia automática de información bancaria ni pagos a terceros.** Si la descarga falla, la vista imprimible permite guardarlo sin esa biblioteca. El documento no es CFDI, factura ni prueba bancaria, ni aprueba sueldos u horas extra.

## Seguridad y cierre operativo
- La cuenta de Staff **solo** ve sus propias jornadas y registros; coordinación debe aprobar el acceso.
- Los horarios oficiales de entrada, descanso, reanudación y salida proceden de Firebase; no se permite que Staff edite esas marcas del servidor.
- El personal debe dar su consentimiento visible para compartir la ubicación; cerrar la app detiene su seguimiento y no se simula un recorrido histórico.
- **Aviso de privacidad:** antes de invitar a todo el personal, documentar finalidad del GPS, responsables que pueden consultarlo, retención de datos de entrada/salida y mecanismo para ejercer derechos.
- **Respaldo:** el botón **Respaldo** del editor exporta la agenda y registros administrativos visibles, **pero no todos los documentos de Firestore** de marcaje, descanso, traslado y control. Debe hacerse por separado una copia protegida de esas colecciones desde una cuenta administradora. Evitar subir respaldos o datos personales al repositorio público.
- **Permisos:** mantener una sola base de reglas compartidas entre Compras, Finanzas y Operaciones. Antes de modificarlas, comparar el contenido activo, respaldar y ejecutar tests en emulador.
- **Desconexión:** los marcajes requieren conexión, GPS y permisos. Con la app cerrada **no** hay seguimiento en tiempo real ni notificaciones push garantizadas.
- **Costo:** la aplicación usa GitHub Pages, Firebase y recursos web gratuitos, sujetos a cuotas y políticas de proveedores. No activar facturación sin autorización expresa.

## Criterio de liberación
La prueba real informada por coordinación confirmó entrada, GPS en vivo, descanso, reanudación, salida y persistencia tras volver a entrar. Los controles técnicos y la generación PDF se verifican con GitHub Actions. Antes de liberar a todo el equipo todavía se debe respaldar **todo Firestore** (incluidos marcajes), publicar el aviso de privacidad GPS y comprobar descarga y lectura de un PDF con un caso real. No marcar automáticamente como «pagado» desde Operaciones.
