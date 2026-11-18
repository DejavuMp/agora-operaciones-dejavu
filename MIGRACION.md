# Migración segura — 18 de noviembre de 2026

## Origen
`DejavuMp/agora-compras-dejavu`, commit `efb7784a230d438cc66d54523adcd689303bf02c`.

## Destino
`DejavuMp/agora-operaciones-dejavu`. Se copia código y pruebas de `operaciones/`, íconos, imágenes y el inicializador web de Firebase.

## Limitaciones
- Esta copia **no despliega** ni cambia Firebase. El proyecto compartido es `agora-dejavu-38b8c`.
- La seguridad depende de un ÚNICO conjunto de reglas para toda la base. **No publicar reglas específicas de Operaciones como sustituto de las vigentes**, pues afectaría otros módulos.
- Los usuarios autorizados deben disponer de `agora_users/{uid}` y roles activos. La URL de GitHub Pages utilizará el mismo dominio `dejavump.github.io`, pero un nuevo path; verificar Authentication > Authorized domains.
- No modificar, redireccionar o borrar la página antigua hasta validar el sitio nuevo con administrador/coordinador y personal real, sincronización cruzada, permisos y recibos.
- Las pruebas automatizadas de UI usan un servidor local con simulaciones, no son pruebas de producción Firebase.
- La generación de rutas usa aproximaciones gratuitas y editables; no consulta tráfico en vivo.

## Validación antes de producción
1. Revisar GitHub Actions y abrir las capturas del visor.
2. Activar Pages del nuevo repositorio con branch `main` y carpeta `/(root)`.
3. Comparar reglas reales de Firebase con las controladas actualmente, hacer respaldo y ejecutar simulaciones de seguridad en emulador. El despliegue de reglas solo con autenticación administrativa y verificación previa.
4. Probar acceso de administrador, coordinador y staff desde dos sesiones distintas, con datos de prueba.
5. Comparar la versión nueva con la anterior y comunicar la nueva URL antes de retirarla.

No se añaden secretos ni credenciales privadas al repositorio.
