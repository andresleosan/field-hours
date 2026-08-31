# Formato de captura de Cronos Grill Me

Lee esta referencia después de obtener consentimiento y antes de crear o reanudar una captura persistente.

## Metadatos

```yaml
---
schema_version: 1
session_id: <identificador estable, sin datos personales>
status: active | paused | complete
revision: 0
created_at: <ISO-8601>
updated_at: <ISO-8601>
last_confirmed_q: 0
next_branch: <slug de la próxima rama>
sensitivity: normal | restricted
---
```

`restricted` no autoriza guardar datos sensibles: indica que la captura fue minimizada y exige una revisión de privacidad antes de versionarla o compartirla.

## Estructura

```markdown
# <Tema>: notas de descubrimiento

## Confirmed summary

Solo hechos y decisiones confirmados inequívocamente por el operador o respaldados por una fuente citada.

## Coverage map

- <rama>: pending | covered | blocked | skipped

## Q&A log

### Q1 — <rama>

- Asked: <pregunta>
- User response: <captura minimizada; no copiar secretos ni PII innecesaria>
- Confirmed facts: <hechos confirmados o “ninguno”>
- Confirmed/provisional decisions: <estado explícito>
- Assistant hypothesis — unconfirmed: <hipótesis o “ninguna”>
- Evidence: <archivo y ubicación, URL primaria o “pendiente”>
- Redactions: <categorías omitidas o “ninguna”>
- Flags: <asunto -> propietario/evidencia necesaria>

## Corrections and supersessions

- <fecha>: supersedes: Qn — <corrección confirmada, sin borrar Qn>

## Open flags

- <asunto> -> <propietario o fuente que puede resolverlo>

## Resume state

- Last durable checkpoint: Qn / revision N
- Next branch: <rama>
- Next question: <una sola pregunta>

## Proposed DDD handoff

- <decisión Qn> -> propuesta para `BRIEF.md`/`STACK.md`/`tasks.md`/ADR, todavía no ejecutada
```

## Invariantes

- El log Q&A es append-only.
- Una hipótesis no entra en `Confirmed summary` hasta una confirmación inequívoca.
- Una fuente inspeccionada se cita con archivo y ubicación; una inferencia se etiqueta como tal.
- Cada parche incrementa `revision` exactamente en uno y actualiza `updated_at` y `last_confirmed_q` cuando corresponda.
- `Resume state` debe bastar para continuar sin memoria conversacional.
- Toda decisión confirmada aparece también en `Proposed DDD handoff` como propuesta no ejecutada, o lleva un motivo explícito de aplazamiento; esa sección nunca contradice el resumen o el log.
- Nunca se guardan secretos, tokens, contraseñas, claves, credenciales o datos identificables de nómina.
- El cierre no indexa, ejecuta ni modifica otros documentos.
