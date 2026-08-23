# Field Hours — Plan de Trabajo y Roadmap de Mejoras

Documento de seguimiento de tareas y validaciones paso a paso. Cada tarea pasa por desarrollo, pruebas locales y verificación antes de marcarse como completada.

---

## 📊 Estado General del Proyecto
- **Fase Actual**: Fase 5 — Verificación Fotográfica Selfie y Multi-idioma (COMPLETADA)
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

## 📌 Fase 2: Ajuste y Corrección Manual de Turnos por el Administrador *(Completada)*
Objetivo: Resolver situaciones reales en obra (olvidos de fichar salida, batería agotada) manteniendo auditoría estricta.

- [x] **Tarea 2.1 (Backend)**: Crear endpoint `POST /api/admin/shifts/adjust` en Cloudflare Workers para modificar o cerrar un turno pendiente, registrando el cambio en `workforce_audit_events`.
- [x] **Tarea 2.2 (Frontend)**: Botón de "Adjust" en la tabla de historial y en el modal de trabajador con formulario para fechas de entrada/salida y motivo obligatorio de ajuste.
- [x] **Tarea 2.3 (Auditoría)**: Registro inmutable con usuario auditor, motivo del cambio, horas previas y horas corregidas.
- [x] **Tarea 2.4 (QA & Verificación)**: Verificación de compilación (0 errores de tipos) y despliegue.

---

## 📌 Fase 3: PWA Instalable y Fichaje Offline *(Completada)*
Objetivo: Permitir instalar la aplicación en móviles (Android/iOS) y permitir fichar en sótanos o zonas sin cobertura.

- [x] **Tarea 3.1 (PWA)**: Configuración de `manifest.webmanifest`, service worker `sw.js`, icono PWA e integración con etiquetas meta para iOS / Android.
- [x] **Tarea 3.2 (Offline Queue)**: Módulo `offlineQueue.ts` que almacena fichajes con GPS y timestamp en `localStorage` ante desconexión de red.
- [x] **Tarea 3.3 (Auto-Sync)**: Reintento y sincronización automática de fichajes encolados tan pronto como el navegador recupera la conexión a internet.
- [x] **Tarea 3.4 (Indicadores Visuales)**: Badges y avisos de estado `Online` / `Offline` y contador de acciones pendientes de sincronización.

---

## 📌 Fase 4: Geocercas y Proyectos / Obras *(Completada)*
Objetivo: Vincular fichajes a ubicaciones de obra específicas y alertar fichajes fuera de perímetro.

- [x] **Tarea 4.1 (Backend D1 & Migración)**: Tabla `workforce_projects` (nombre, código, dirección, latitud, longitud, radio de tolerancia en metros y estado) y vinculación `project_id` en `workforce_shifts`.
- [x] **Tarea 4.2 (Backend Endpoints)**: `GET /api/projects` para listar obras y `POST /api/admin/projects` para crear y editar proyectos con coordenadas GPS.
- [x] **Tarea 4.3 (Geocerca & Haversine)**: Cálculo matemático de distancia en metros entre el punto de fichaje del trabajador y el centro de la obra. Registro en auditoría si el fichaje excede el radio.
- [x] **Tarea 4.4 (Frontend Panel de Proyectos)**: Pestaña **Projects & Sites** para que el administrador cree obras, capture su GPS con un clic y fije el radio de tolerancia (ej. 200m).
- [x] **Tarea 4.5 (Frontend Vista del Trabajador)**: Selector de obra asignada al momento de pulsar "Clock in" y visualización de la geocerca.
- [x] **Tarea 4.6 (Reportes y Excel)**: Columna de Proyecto/Obra en la tabla de historial y en los reportes de exportación a Excel.

---

## 📌 Fase 5: Verificación Fotográfica Opcional y Multi-idioma *(Completada)*
Objetivo: Evitar suplantación ("buddy punching") y facilitar el uso a cuadrillas internacionales.

- [x] **Tarea 5.1 (Foto Evidencia)**: Captura de selfie frontal en tiempo real con la cámara del dispositivo al pulsar "Clock in", con compresión ultraligera en canvas (JPEG base64 ~15-20KB), opción de omitir o repetir foto y almacenamiento inmutable en eventos de auditoría.
- [x] **Tarea 5.2 (Visor de Evidencia en Panel Admin)**: Miniaturas interactivas y visor modal a pantalla completa para que el administrador inspeccione las fotos de fichaje en el panel de hoy y en el historial.
- [x] **Tarea 5.3 (Multi-idioma i18n)**: Sistema completo de internacionalización (`i18n.tsx`) con selector visual en cabecera (🇪🇸 Español, 🇺🇸 Inglés, 🇧🇷 Portugués) disponible tanto en pantalla de acceso como en la app principal.
- [x] **Tarea 5.4 (QA & Verificación)**: Build de Vite completado con 0 errores, typecheck de frontend y worker con 0 errores y despliegue del worker a Cloudflare.
