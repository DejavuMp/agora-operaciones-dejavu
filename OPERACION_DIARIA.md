# ÁGORA Operaciones — Validación de horas

**Decisión vigente (18 de noviembre de 2026).** Operaciones se limita a cronograma, asignaciones, traslados, entradas, descansos, salidas, incidencias y validación de horas. No se muestran tabuladores, importes, datos bancarios, pagos, gastos ni PDF para pagos. Compras y demás sistemas siguen independientes.

## Recorrido del integrante
1. En Mis jornadas ve quién le asignó, lugar, fecha, actividad y horario, sin tarifas.
2. Marca entrada y salida con hora del servidor Firebase y descansos. GPS solo consentido y reciente, sin rastreo con la app cerrada.
3. En Validación de horas crea un reporte a partir de marcas oficiales; describe la actividad y verifica descansos.
4. Pulsa «Confirmo mis horas y las envío a coordinación». Hasta ese momento la jornada no puede aprobarse.
5. Ve «Horas validadas» o un motivo de devolución para corrección.

## Recorrido de coordinación
En Validación de jornadas, coordinación revisa trabajo, descanso e incidencias. Puede Validar horas o Solicitar corrección. Antes de validar, una transacción lee el marcaje certificado de Firebase y compara UID, persona, evento, horas y descanso. Si el reporte fue manipulado o el turno no terminó oficialmente, se bloquea la validación. Se guarda solo la cantidad de horas, no un importe ni orden bancaria.

## Integración futura con Recursos y Pagos
**La integración automática todavía no existe.** No se pide al personal descargar ningún archivo. El futuro sistema de Pagos podrá consumir por una conexión autorizada únicamente registros de operación validados. Contrato propuesto:
- Colección: `agora_ops_logs`.
- Identidad estable e idempotente: `id` y `ownerUid + eventId`.
- Filtro: `paymentStatus === 'validado'` (nombre de campo legado, ahora significa solo **horas validadas**).
- Campos mínimos: `ownerUid`, `personId`, `eventId`, `approvedHours`, `start`, `end`, `breakMins`, `activity`, `place`, `updatedAt`.
- Revalidación de fuente: `agora_ops_clock/{ownerUid}_{eventId}` con estado `finalizada`.
- No importar antiguos campos financieros desde Operaciones. Las cuentas bancarias, tarifas, beneficiarios, pagos, aprobaciones económicas y elección del medio de pago estarán en la herramienta independiente **Recursos y Pagos**.
- Los gastos comprobables seguirán en **Comprobación de Gastos** y se vincularán por folio, sin duplicación.

## Compatibilidad y seguridad
- Los campos `paymentStatus`, `requestedHours` y `approvedHours` se conservan para compatibilidad con las reglas Firestore ya desplegadas. No son autorizaciones económicas.
- Las asignaciones y personal antiguos podrían contener importes históricos en Firestore; no se eliminan hasta completar un respaldo y migración privada. La interfaz los oculta y la proyección Staff excluye tarifas y datos ajenos.
- Staff solo puede leer sus registros; coordinación accede según sus permisos. No hay seguimiento GPS en segundo plano.
- Nunca se debe considerar validada una jornada solo por marcar salida: requiere confirmación Staff y validación de coordinación.
- Respaldo integral de marcajes, descansos e incidentes requiere exportación privada de Firestore adicional al botón de agenda.
- Documentar finalidad, acceso y plazo de retención del GPS antes de ampliar operaciones al equipo.
- GitHub Pages, Firebase y mapas se mantienen dentro de recursos gratuitos disponibles; no activar facturación.
