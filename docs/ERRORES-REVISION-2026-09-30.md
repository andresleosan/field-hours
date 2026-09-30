# Errores encontrados — revisión 2026-09-30

Revisión del código tras el fallo de «Ajustar Horas del Turno» (arreglado en `066a306`, LIVE).
Estado: ⬜ pendiente · 🔧 en curso · ✅ arreglado (commit) · ⏸️ necesita decisión de Luis.

## 🔴 Críticos — errores visibles o datos incorrectos

| # | Estado | Problema | Dónde | Síntoma |
|---|---|---|---|---|
| E0 | ✅ `066a306` | Ajuste con pausa registrada fuera del nuevo horario viola un CHECK de la tabla | `cloudflare/src/shifts.ts` `adminAdjustShift` | «The service could not complete this request.» |
| E1 | ✅ | Consultas con un parámetro por turno (`IN (?1..?N)`); D1 admite máx. 100 | `shifts.ts` `adjustmentsForShifts` + eventos del historial; `shiftMetrics.ts` `aggregateCompletedShifts` | Error 500 o historial vacío con ≥100 turnos (historial admin/trabajador, resumen de horas, salary advice) |
| E2 | ✅ | Filtros de periodo convierten la fecha local a UTC | `src/pages/ShiftClock.tsx` `calculateDateRange` | «Este mes» empieza el día 31 del mes anterior en horario de verano; «hoy»/semanas fallan de 00:00 a 01:00 |
| E3 | ✅ | Ajustar un turno en curso lo cierra en «ahora» (salida obligatoria en el modal) | `ShiftClock.tsx` modal de ajuste + `shifts.ts` | El trabajador queda bloqueado: «The shift state changed» |
| E4 | ✅ | Pausas fuera del horario ajustado se siguen descontando (se calculan con los eventos sin recortar) | `cloudflare/src/shiftMetrics.ts` `breakMinutesFromEvents` | Horas netas de menos |
| E5 | ✅ | Rechazar/aprobar por 2ª vez una solicitud Google del mismo email choca con `UNIQUE (email, request_type, status)` | `cloudflare/src/googleAuth.ts` + migración 0004 | Error 500; la solicitud queda pendiente para siempre |
| E6 | ✅ | Aprobar solicitud Google de alguien que ya tiene cuenta choca con el email único | `googleAuth.ts` aprobación | Error 500 |
| E7 | ✅ | Los errores 500 se registran sin mensaje | `cloudflare/src/index.ts` manejador global | Imposible diagnosticar desde los logs |

## 🟠 Importantes

| # | Estado | Problema | Dónde | Síntoma |
|---|---|---|---|---|
| E8 | ✅ | El admin puede dejar un turno abierto con entrada en el futuro o con la entrada después del inicio de una pausa en curso | `shifts.ts` `adminAdjustShift` | Trabajador bloqueado (409) |
| E9 | ✅ | Carrera: el ajuste puede reabrir un turno que el trabajador acaba de cerrar | `shifts.ts` `adminAdjustShift` | Turno reabierto e inconsistente |
| E10 | ✅ | Fichar entrada no comprueba solape con turnos creados por el admin | `shifts.ts` `performShiftAction` | Horas pagadas dos veces |
| E11 | ✅ | «Crear turno» usa la zona horaria del navegador, no la de la organización | `ShiftClock.tsx` modal de crear | Turnos desplazados si el portátil no está en hora de Jersey |
| E12 | ✅ | Una acción offline que falla con 4xx atasca la cola para siempre; una acción online puede adelantar a la cola | `src/lib/offlineQueue.ts`, `ShiftClock.tsx` `act()` | Acciones «pendientes» que nunca llegan |
| E13 | ⏸️ | Acciones offline se registran con la hora de sincronización, no la real | `offlineQueue.ts` → `shifts.ts` | Salida a las 17:00 sin señal queda a las 19:30. **Decisión:** ¿aceptar la hora del móvil (con límite)? |
| E14 | ✅ | Límite de login solo por email: cualquiera puede bloquear la cuenta del admin | `cloudflare/src/auth.ts` | Admin bloqueado 15 min |
| E15 | ⏸️ | `must_change_password` solo se exige en la pantalla, no en el servidor | `auth.ts` `getAuth` | Cuenta con contraseña temporal usa toda la API. **Decisión:** la pantalla deja «saltar» el cambio a propósito (solo afecta a cuentas creadas con `bootstrap-admin`/`seed`); ¿obligarlo? |
| E16 | ⏸️ | Cambiar contraseña no pide la actual | `auth.ts` | Sesión robada = cuenta robada. **Decisión:** ¿pedir la actual? (cambia la pantalla) |
| E17 | ⏸️ | Social Security 6 % sin tope de ingresos | `cloudflare/src/salaryAdvice.ts` | Posible sobre-deducción. **Decisión:** confirmar regla y tope de Jersey |
| E18 | ⏸️ | Reglas de nómina fijas a 2026 | `salaryAdvice.ts` | Periodos que tocan 2027 se rechazan. **Decisión:** tasas 2027 |

## 🟢 Pequeños

| # | Estado | Problema | Dónde |
|---|---|---|---|
| E19 | ✅ | Longitud de texto medida en UTF-16 (JS) vs caracteres (SQLite): nombre de un emoji → 500 | `cloudflare/src/http.ts` `requireString` |
| E20 | ✅ | URL con `%` mal codificado → 500 | `cloudflare/src/index.ts` `decodeURIComponent` |
| E21 | ✅ | Motivo del ajuste: la pantalla no exige 3–300 caracteres como el servidor | `ShiftClock.tsx` modal de ajuste |
| E22 | ✅ | Fechas con año fuera de 0000–9999 pasan la validación → 500 | `shifts.ts` `optionalTimestamp` |
| E23 | ✅ | Historial de reseteo de contraseña puede mostrar el motivo de rechazo de otra solicitud | `cloudflare/src/requestHistory.ts` |
| E24 | ✅ | Admin no puede fijar el salario hasta que el trabajador guarde su perfil (409 confuso) | `cloudflare/src/payrollProfiles.ts` |
| E25 | ⬜ | Claves de Google en caché 1 h sin refrescar si llega una clave nueva | `googleAuth.ts` |

## Registro de reparaciones

(se rellena a medida que se arregla cada uno)
- **E1** — `allForIds()` en `shiftMetrics.ts` consulta las listas de ids en bloques de 90. Test nuevo `cloudflare/test/d1Constraints.test.mjs` (D1 local real con todas las migraciones): con 150 turnos fallaba antes, pasa ahora.
- **E2** — `periodDateRange()` en `src/lib/shiftDateTime.ts` calcula los rangos con el calendario de la organización (Europe/Jersey); `ShiftClock.tsx` lo usa. Test `src/lib/shiftDateTime.test.mjs` (00:30 BST, domingo).
- **E3** — Modal de ajuste: en un turno en curso la salida y la pausa quedan ocultas tras la casilla «Marcar también la salida» (desmarcada por defecto); sin marcarla solo se corrige la entrada y el turno sigue abierto.
- **E8** — `adminAdjustShift` rechaza (400) una entrada futura en un turno abierto o posterior al inicio de la pausa en curso. Test en `d1Constraints.test.mjs`.
- **E4** — `breakMinutesFromEvents` recorta cada pausa a [entrada, salida] (historial y totales). Test en `d1Constraints.test.mjs`.
- **E5** — Migración `0013_auth_requests_history.sql`: reconstruye `workforce_auth_requests` sin `UNIQUE (email, request_type, status)` y con índice único parcial «una pendiente por email y tipo». ⚠️ Hay que aplicarla en la D1 de producción **antes** de desplegar el Worker. Test en `d1Constraints.test.mjs`.
- **E6** — Aprobar solicitud Google: 409 claro si el email ya tiene cuenta (`ACCOUNT_EXISTS`) o la cuenta Google ya está vinculada (`GOOGLE_ALREADY_LINKED`). Test en `d1Constraints.test.mjs`.
- **E7** — `index.ts`: los 500 no controlados registran `errorMessage` (máx. 500 caracteres; nunca en `SyntaxError`) y los `ApiError` ≥500 también dejan una línea de log.
- **E9** — `adminAdjustShift`: candado optimista (`state`, `clock_in_at`, `clock_out_at` leídos) → 409 `SHIFT_ADJUST_FAILED` si el turno cambió; la auditoría solo se escribe si el UPDATE cambió la fila (`WHERE changes() = 1`). Test en `d1Constraints.test.mjs`.
- **E10** — `performShiftAction` (clock_in) llama a `assertNoShiftOverlap` → 409 `SHIFT_OVERLAP` si un turno registrado por el admin ya cubre ese momento. Test en `d1Constraints.test.mjs`.
- **E11** — «Crear turno» interpreta y precarga las horas en la zona de la organización (`shiftDateTimeToIso`), no en la del navegador; una hora inexistente (cambio de hora) se rechaza. Verificado con TZ=America/New_York.
- **E12** — `syncOfflineQueue` descarta y reporta las acciones que el servidor rechaza definitivamente (4xx salvo 408/429) en vez de bloquear la cola; `act()` sincroniza la cola antes de una acción nueva y, si sigue con pendientes, encola detrás para mantener el orden. Test e2e en `worker-flexibility.spec.ts`.
- **E14** — Login: el límite de 5 fallos/15 min es por email **y** IP (`CF-Connecting-IP`), así un tercero no bloquea al dueño; nuevo tope de 30 fallos/15 min por IP contra el «password spraying». Test en `d1Constraints.test.mjs`. Límite conocido: un ataque distribuido desde muchas IP contra un email solo lo frena el coste de PBKDF2 y la contraseña.
- **E19** — `requireString` mide en caracteres (code points) como `length()` de SQLite. Test en `d1Constraints.test.mjs`.
- **E20** — `index.ts`: `pathParam()` convierte un `%` mal codificado en 400 `INVALID_INPUT` (5 rutas).
- **E21** — Modal de ajuste: el motivo exige 3–300 caracteres (`minLength`/`maxLength` + comprobación tras recortar), igual que el servidor y que el modal de crear.
- **E22** — `optionalTimestamp` solo acepta años 2000–2099 (400 si no). Test en `d1Constraints.test.mjs`.
- **E23** — `requestHistory.ts`: el motivo solo se busca en solicitudes rechazadas y se toma el evento de rechazo más cercano a su `reviewed_at`. Test en `d1Constraints.test.mjs`.
- **E24** — Guardar salario sin ficha del trabajador: 409 `PROFILE_NOT_SUBMITTED` con mensaje claro. Test en `d1Constraints.test.mjs`.
