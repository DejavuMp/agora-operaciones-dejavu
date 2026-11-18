# ÁGORA · Centro de Operaciones y Staff

Repositorio independiente de **Operaciones, Cronograma, Visor y Staff** de Dejavú Marketing.

**Origen respaldado:** `DejavuMp/agora-compras-dejavu`, commit `efb7784a230d`. El repositorio anterior permanece intacto.

## Accesos

- Editor: `operaciones/index.html`
- Visor: `operaciones/visor.html`
- Coordinación: `operaciones/control-jornadas.html`
- Jornadas y staff: `operaciones/jornadas.html`

**URL prevista después de una publicación exitosa:** https://dejavump.github.io/agora-operaciones-dejavu/operaciones/

## Seguridad

El proyecto Firebase sigue siendo `agora-dejavu-38b8c`, **compartido con el resto del ecosistema**. El archivo `firestore.rules` es una copia controlada de las reglas completas, para no eliminar permisos de otros módulos. La activación de las reglas requiere ejecución **manual**, pruebas en emulador, verificación de reglas reales y respaldo previo. Publicar GitHub Pages **no** activa reglas ni valida dos usuarios reales.

- Pruebas de interfaz: `.github/workflows/agora-ops-ui-tests.yml`.
- Pruebas de permisos y flujo manual protegido: `.github/workflows/dejavu-staff-firebase-rules.yml`.
- Publicación independiente con pruebas previas: `.github/workflows/publicar-operaciones-pages.yml`.
- Plan y límites: `MIGRACION.md`.

No se habilitan servicios de pago, seguimiento de tráfico, ni transferencias bancarias. No incluir claves de servicio, tokens o credenciales privadas en GitHub.

**No redireccionar ni eliminar el sitio anterior** antes de comprobar con cuentas reales accesos, sincronización y registros.
