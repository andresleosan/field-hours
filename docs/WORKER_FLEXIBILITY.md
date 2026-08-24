# Flexibilidad de jornada y proyectos creados por trabajadores

## Alcance

- Un trabajador puede completar varios shifts en el mismo día.
- Solo puede existir un shift abierto (`working` o `on_break`) por trabajador al mismo tiempo.
- Un shift puede tener cero, uno o varios ciclos de break.
- El tiempo trabajado es el tiempo transcurrido del shift menos la suma de todos sus breaks.
- El fichaje conserva la ubicación GPS y el proyecto seleccionado; la foto ya no es necesaria.
- Un trabajador puede crear un proyecto con nombre y descripción breve. La ubicación del proyecto es opcional y no sustituye la evidencia GPS del fichaje.

## Contratos

- `POST /api/shift/action`: mantiene `clock_in`, `start_break`, `end_break` y `clock_out`; `clock_in` requiere ubicación y permite `projectId`.
- `POST /api/worker/projects`: crea un proyecto con `name` y `description`.
- `GET /api/projects`: lista los proyectos activos disponibles para seleccionar al fichar.

## Migración

`cloudflare/migrations/0009_worker_flexibility.sql` elimina la unicidad de un shift por día, conserva la unicidad de un shift abierto y agrega la descripción del proyecto.

## Rollback

Antes de aplicar el rollback debe existir un backup verificado. La unicidad anterior solo puede restaurarse después de comprobar que no existen varios shifts del mismo trabajador en la misma fecha. La columna `description` se conserva para evitar una reconstrucción destructiva de la tabla.
