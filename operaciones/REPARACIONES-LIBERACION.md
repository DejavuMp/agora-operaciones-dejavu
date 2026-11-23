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
- Storage: `agora-repair-assets/{assetId}/{uid}/{imageId}.jpg`, `agora-repairs/{requestId}/{uid}/{imageId}.jpg`.
- Campos de historial inmutables; la solicitud mantiene revisión incremental. No hay eliminación de reportes.
- Las cotizaciones internas son distintas de las respuestas a invitaciones externas; la incorporación al comparador se hace en transacción.

## Validación antes de liberar
- [ ] Fusionar y probar las reglas del PR de Compras/Storage en proyecto Firebase **solo después de respaldo y conciliación con producción**; revisar especialmente que no se revoque acceso a módulos existentes.
- [ ] Ejecutar pruebas de Firestore y Storage con emuladores y todas las suites de Operaciones.
- [ ] Habilitar Storage con políticas seguras; el workflow actual de reglas **solo** despliega Firestore.
- [ ] Confirmar CORS para descargas autenticadas de `getBlob` desde GitHub Pages y verificar las imágenes desde dos navegadores.
- [ ] Alta de una pieza y reporte real con dos cuentas autorizadas, con la cuenta asignada viendo el trabajo y enviando avance.
- [ ] Confirmar que otro staff y usuarios anónimos NO ven fotografías del expediente interno.
- [ ] Invitación externa: abrir sin cuenta, enviar una cotización, intentar segundo envío (denegado), revocar otra invitación (denegada) y verificar vencimiento.
- [ ] Verificar un PDF descargado, su botón de enlace y QR, una imagen PNG y el mensaje de WhatsApp/correo.
- [ ] Cargar/etiquetar las 42 fotografías originales del ZIP Hot Cruji Bravo tras recuperar sus bytes. **No se han cargado a Firebase**.
- [ ] Verificar respaldo, reglas activas, publicación GitHub Pages y ausencia de errores de consola, antes de comunicar el enlace al equipo.

**Estado**: desarrollo en las ramas de revisión de los PR #11 (Operaciones) y #51 (Compras). Prohibido afirmar que la base de producción ya se migró sin comprobarla.
