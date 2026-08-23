# Field Hours — Plan de Trabajo y Roadmap de Mejoras

Documento de seguimiento de tareas y validaciones paso a paso. Cada tarea pasa por desarrollo, pruebas locales y verificación antes de marcarse como completada.

---

## 📊 Estado General del Proyecto
- **Fase Actual**: Fase 1 — Historial, Reportes y Exportación de Horas (COMPLETADA)
- **Última Actualización**: 22 de Agosto de 2026

---

## 📌 Fase 1: Historial, Reportes y Exportación de Horas *(Completada)*
Objetivo: Permitir al administrador y a los trabajadores consultar todas sus jornadas pasadas, totales acumulados y descargar reportes para nómina/control.

- [x] **Tarea 1.1 (Backend)**: Crear endpoint `/api/admin/shifts/history` en Cloudflare Workers para consultar el historial de turnos con filtros de fecha (`startDate`, `endDate`) y `userId`.
- [x] **Tarea 1.2 (Backend)**: Crear endpoint `/api/worker/shifts/history` para que el propio trabajador consulte su historial de horas trabajadas en la semana/mes.
- [x] **Tarea 1.3 (Frontend)**: Añadir selector de **Live Today** vs **History & Reports** en el panel de administrador con filtros rápidos (*Today, This Week, Last Week, This Month, All Records*).
- [x] **Tarea 1.4 (Frontend)**: Mostrar tarjetas de totales acumulados (Total Worked Hours, Break Time, Total Shifts, Active Staff) y selector de filtrado por trabajador individual o cuadrilla completa.
- [x] **Tarea 1.5 (Frontend)**: Modal detallado por trabajador con listado cronológico de turnos y sus evidencias GPS individuales con enlaces a OpenStreetMap.
- [x] **Tarea 1.6 (Exportación)**: Implementar exportación a Excel (.xlsx) de los partes de horas filtrados.
- [x] **Tarea 1.7 (QA & Verificación)**: Pruebas de compilación exitosas (0 errores de tipos en App y Worker, build optimizado) y despliegue a GitHub/Vercel.

---

## 📌 Fase 2: Ajuste y Corrección Manual de Turnos por el Administrador
Objetivo: Resolver situaciones reales en obra (olvidos de fichar salida, batería agotada) manteniendo auditoría estricta.

- [ ] **Tarea 2.1 (Backend)**: Crear endpoint `/api/admin/shifts/adjust` en Cloudflare Workers para modificar o cerrar un turno pendiente, registrando el cambio en `workforce_audit_events`.
- [ ] **Tarea 2.2 (Frontend)**: Botón de "Ajustar turno" en el panel de administrador con formulario para hora corregida y motivo obligatorio.
- [ ] **Tarea 2.3 (Auditoría)**: Indicador visual en turnos ajustados manualmente para total transparencia.

---

## 📌 Fase 3: PWA Instalable y Fichaje Offline
Objetivo: Permitir instalar la aplicación en móviles (Android/iOS) y permitir fichar en sótanos o zonas sin cobertura.

- [ ] **Tarea 3.1 (PWA)**: Configurar `manifest.webmanifest`, service worker e iconos para soporte de instalación como App nativa en pantalla de inicio.
- [ ] **Tarea 3.2 (Offline Queue)**: Guardar acciones de fichaje en `IndexedDB` / `localStorage` cuando no haya conexión y sincronizar automáticamente con el servidor al recuperar red.

---

## 📌 Fase 4: Geocercas y Proyectos / Obras
Objetivo: Vincular fichajes a ubicaciones de obra específicas y alertar fichajes fuera de perímetro.

- [ ] **Tarea 4.1 (Backend D1)**: Tabla `workforce_projects` (nombre, cliente, latitud, longitud, radio de tolerancia en metros).
- [ ] **Tarea 4.2 (Frontend)**: Selector de obra al iniciar turno.
- [ ] **Tarea 4.3 (Geocerca)**: Cálculo de distancia GPS y advertencia visual si el fichaje se realiza fuera del radio permitido.

---

## 📌 Fase 5: Verificación Fotográfica Opcional y Multi-idioma
Objetivo: Evitar suplantación ("buddy punching") y facilitar el uso a cuadrillas internacionales.

- [ ] **Tarea 5.1 (Foto Evidencia)**: Captura opcional de selfie con la cámara al marcar entrada.
- [ ] **Tarea 5.2 (i18n)**: Soporte de idiomas conmutables (Español, Inglés, Portugués).
