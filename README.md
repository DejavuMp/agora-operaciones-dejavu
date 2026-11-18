# ÁGORA · Centro de Operaciones y Staff

Repositorio independiente de **Operaciones, Cronograma, Visor y Staff** de Dejavú Marketing.

> **Migración en validación.** El sistema anterior sigue disponible y no se ha redireccionado ni desactivado.

## Aplicación

- Editor de operaciones: `operaciones/index.html`
- Visor de agenda: `operaciones/visor.html`
- Control de coordinación: `operaciones/control-jornadas.html`
- Registro de jornadas: `operaciones/jornadas.html`

La implementación reutiliza el proyecto Firebase existente `agora-dejavu-38b8c`. Al compartir proyecto con las otras herramientas de ÁGORA, las reglas Firestore de toda la base deben compatibilizarse y desplegarse con respaldo, nunca reemplazarse por reglas exclusivas de Operaciones.

## Seguridad y publicación

- Sin secretos ni credenciales privadas en GitHub.
- Sin servicios de pago; rutas orientativas sin tráfico en tiempo real.
- Las pruebas de GitHub Actions no sustituyen pruebas con usuarios reales.
- **No activar cambios de reglas Firebase ni redireccionar el sitio anterior sin validar primero** accesos y sincronización.
- Para publicar el sitio en GitHub Pages, usar el branch `main` y carpeta raíz: `https://dejavump.github.io/agora-operaciones-dejavu/operaciones/`. El despliegue requiere configurar Pages en el repositorio.

## Estado

La rama de migración se prepara de manera aislada antes de integrarse a `main`.
