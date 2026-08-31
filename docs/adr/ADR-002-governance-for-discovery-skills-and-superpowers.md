# ADR-002: Gobernanza de skills de descubrimiento y Superpowers

Fecha: 2026-08-31
Estado: aceptada

## Contexto

Field Hours es un proyecto Nivel 3 y necesita reducir inferencias no confirmadas durante el descubrimiento de requisitos. Se evaluaron tres candidatos: `find-skills`, `grill-me` y Superpowers. La documentación local de Cronos afirmaba además que Superpowers solo era compatible con OpenCode, pero Codex ofrece instalación oficial mediante plugins. El repositorio público actual de `openai/plugins` declara `superpowers` 6.3.0; la CLI instalada entregó realmente el snapshot 5.1.3 documentado abajo.

La compatibilidad técnica no resuelve por sí sola la compatibilidad operativa. Cronos conserva checkpoints humanos, limita la delegación a tres subagentes sin anidación, prohíbe Git a los subagentes y corta un loop tras dos vueltas con el mismo hallazgo. Superpowers incluye flujos que permiten commits desde subagentes, crean worktrees, ejecutan una secuencia propia de planificación y contemplan hasta cinco rondas de corrección.

Fuentes fijadas para esta decisión:

- `gusinov/grill-me`, `grill-me/SKILL.md`, commit `600ffe979f14d59492fbce6f6b25248ef8cb9849`, licencia MIT.
- `vercel-labs/skills`, `skills/find-skills/SKILL.md`, commit `435076e78988e1e6ec40d00b0b1d76bdbbc5419a`.
- `obra/superpowers`, commit `b36e0829c6d0140e93cfef2ca599b1b07d4a7797`, manifiesto 6.3.0.
- Marketplace `openai/plugins`, commit `1e285826e604f66f7208f7ac4dba0fe8341d1f57`, paquete `superpowers` 6.3.0.

## Decisión

1. Integrar una adaptación local llamada `cronos-grill-me`, no la skill original sin cambios. La adaptación exige consentimiento antes de escribir, separa hechos confirmados de hipótesis, minimiza datos sensibles, conserva el log de preguntas como append-only y no indexa ni modifica documentos canónicos automáticamente.
2. No instalar `find-skills`. Su capacidad es redundante con los mecanismos ya disponibles y encontrar un paquete nunca equivale a aprobar su procedencia.
3. Reconocer oficialmente que Superpowers sí es compatible con Codex, corrigiendo la documentación local obsoleta.
4. Instalar el plugin desde el marketplace oficial, pero no adoptar su workflow completo. En Field Hours se permiten `systematic-debugging`, `verification-before-completion`, `receiving-code-review` y TDD para cambios de comportamiento. Los flujos de subagentes, worktrees, cierre de rama, planes paralelos y scripts auxiliares necesitan autorización específica y siguen subordinados a Cronos.
5. Conservar esta precedencia: instrucciones de sistema/desarrollador/usuario, `AGENTS.md`, reglas y checkpoints de Cronos, y solo después skills de terceros. Superpowers nunca autoriza Git a subagentes, supera el límite de delegación, omite checkpoints humanos ni extiende el criterio de corte de Cronos.
6. Verificar la versión instalada, no inferirla desde el catálogo. El 31 de agosto de 2026 `codex plugin add superpowers@openai-curated` instaló el snapshot `11c74d6b`, cuyo manifiesto local declara 5.1.3, aunque los manifiestos actuales de upstream y `openai/plugins` declaran 6.3.0. Hasta que el marketplace entregue esa versión, se mantiene la 5.1.3 bajo las restricciones anteriores y se vuelve a auditar al actualizar.

## Alternativas consideradas

- **Adoptar Superpowers completo sin restricciones:** descartada. Sus workflows con capacidad de lectura/escritura competirían con los límites y fuentes canónicas de Cronos.
- **Copiar skills individuales de Superpowers al proyecto:** aplazada. Duplicaría disciplina ya presente y crearía una segunda superficie de actualización; solo se justifica ante un gap demostrado.
- **Instalar `grill-me` sin cambios:** descartada. Su escritura previa al consentimiento, activación amplia, captura casi literal e indexación genérica no son adecuadas para información laboral o de nómina.
- **Instalar `find-skills`:** descartada. Aporta descubrimiento, no una mejora directa de calidad, y aumenta el riesgo de adoptar paquetes por popularidad en vez de auditarlos.

## Consecuencias

- El descubrimiento puede ser persistente y reanudable sin convertir inferencias del asistente en requisitos confirmados.
- Ninguna captura nueva se crea hasta que el operador aprueba ruta y persistencia; una sesión puede continuar solo en chat.
- Superpowers queda habilitado globalmente y requiere una sesión nueva para exponer sus skills; dentro de Field Hours `AGENTS.md` limita qué partes pueden ejecutarse.
- La versión realmente instalada queda explícita y no se confunde el snapshot 5.1.3 con el 6.3.0 visible en upstream.
- La documentación deja de confundir falta de instalación con falta de compatibilidad.
- Se mantiene una pequeña adaptación local que deberá conservar su hash, aviso MIT y escenarios de validación en `.agents/skills-lock.json`.
