# ÁGORA · Inventario, mantenimiento y reparaciones

Módulo integrado al **Centro de Operaciones** existente; no es un programa aparte.

## Direcciones previstas tras publicación
- Coordinación y personal autorizado: `https://dejavump.github.io/agora-operaciones-dejavu/operaciones/reparaciones.html`
- Invitación individual para proveedor externo: `https://dejavump.github.io/agora-operaciones-dejavu/operaciones/reparacion-cotizar.html?solicitud=<token>`
- Acceso por folio: `operaciones/reparaciones.html?solicitud=<uuid>` (requiere cuenta y permiso)

Las direcciones son **previstas, no declaradas activas** hasta fusionar y desplegar.

## Flujo práctico
1. Coordinación da de alta un activo: proyecto, stand, pieza, descripción y fotografías.
2. Staff o coordinación registra un reporte; se genera un folio UUID y un historial con sello de tiempo de Firebase.
3. Coordinación selecciona ruta: staff, taller/agencia, proveedor existente, nuevo, pedir cotización o comparar.
4. Para staff se selecciona la **cuenta ÁGORA vinculada** además del nombre: el integrante lo ve en sus solicitudes asignadas. Puede adjuntar fotos de antes/durante/después y anotar avances, pero no autorizar o cerrar el trabajo.
5. Para proveedores se crea enlace externo de 3, 7, 14 o 21 días, con token aleatorio de 256 bits. El proveedor ve solo la descripción del arreglo y materiales compartidos, y puede enviar **una** respuesta; no accede a otros expedientes.
6. Coordinación importa la propuesta sin duplicarla, compara los costos, asigna responsable y decide el estado. El correo y WhatsApp abren borradores de envío; ÁGORA no envía mensajes por sí sola.
7. Exportar folio a PDF con enlace y QR, PNG o CSV, o copiar mensaje; el QR del expediente interno requiere login. Los enlaces externos para proveedores tienen su propio token.
8. Registrar cierre y entrega bajo coordinación. No se realizan transferencias, pagos ni actualizaciones automáticas de Recursos.

## Datos
- Firestore: `agora_repair_assets`, `agora_repair_requests`, `agora_repair_events`, `agora_repair_invites`.
- Fotografías: `agora_repair_photos/{id}` en **Cloud Firestore gratuito**, una miniatura JPEG privada por documento, máximo 90 KB; la ruta `firestore:<id>` se registra en el activo o folio. **No se usa Cloud Storage, no se requiere Blaze ni se activa facturación.**
- Campos de historial inmutables; la solicitud mantiene revisión incremental. No hay eliminación de reportes.
- Las cotizaciones internas son distintas de las respuestas a invitaciones externas; la incorporación al comparador se hace en transacción.

## Validación antes de liberar
- [ ] Activar en Firestore las reglas del PR de **Spark sin facturación**, únicamente después del respaldo y conciliación con las reglas reales de producción; no sobrescribir permisos de los otros módulos.
- [x] Ejecutar pruebas de Firestore Spark en emuladores y las suites de Operaciones (aprobadas en ramas de revisión).
- [x] Eliminar la dependencia de Storage y facturación de la herramienta; conservar el proyecto Firebase en Spark.
- [ ] Verificar desde dos cuentas reales que las miniaturas privadas se visualizan en móvil y computadora; la visualización usa Firestore y no requiere CORS de Storage.
- [ ] Alta de una pieza y reporte real con dos cuentas autorizadas, con la cuenta asignada viendo el trabajo y enviando avance.
- [ ] Confirmar que otro staff y usuarios anónimos NO ven fotografías del expediente interno.
- [ ] Invitación externa: abrir sin cuenta, enviar una cotización, intentar segundo envío (denegado), revocar otra invitación (denegada) y verificar vencimiento.
- [ ] Verificar un PDF descargado, su botón de enlace y QR, una imagen PNG y el mensaje de WhatsApp/correo.
- [ ] Cargar y etiquetar las 42 fotografías Hot Cruji Bravo como **vistas previas optimizadas** cuando estén accesibles; los originales de alta resolución deberán conservarse en Drive. **No se han cargado a Firebase**.
- [ ] Verificar respaldo, reglas activas, publicación GitHub Pages y ausencia de errores de consola, antes de comunicar el enlace al equipo.

**Estado**: desarrollo en las ramas de revisión de los PR #11 (Operaciones) y #51 (Compras). Prohibido afirmar que la base de producción ya se migró sin comprobarla.

## Límite del plan sin facturación
Cloud Firestore Spark permite trabajar sin activar Blaze, dentro de sus cuotas. Las fotos se comprimen en el navegador hasta 90 KB y se guardan separadas del resumen, para evitar documentos grandes. Cada pieza admite hasta 20 vistas previas y cada folio hasta 12. La calidad es suficiente para inspección y seguimiento, **no sustituye originales para impresión, edición o respaldo de alta resolución**. Conservarlos en una carpeta de Google Drive y vincular esa carpeta en `materialLink`.
