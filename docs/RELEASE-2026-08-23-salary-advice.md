# Release: Salary Advice export

Fecha: 23 de agosto de 2026

## Incluido

- El administrador puede abrir `Salary Advice` desde un perfil de nómina aprobado.
- Se cargan las horas netas del historial y los datos completos del trabajador mediante la ruta administrativa protegida y auditada.
- Se genera una vista imprimible con formato de salario: Allowances, Deductions, horas, importe bruto, ITIS, Social Security, Net Pay, Tax Reference (ITIS) y Social Security Number.
- La ventana de impresión permite guardar el recibo como PDF.
- Los datos introducidos por el usuario se escapan antes de insertarse en el documento HTML.

## Alcance actual

Esta primera versión es un borrador operativo. La tarifa por hora, el importe de ITIS y la seguridad social del trabajador se introducen manualmente. Los cálculos estatutarios automáticos de Jersey, la revisión previa de nómina y la exportación masiva permanecen como tareas siguientes.

## Evidencia

- Commit: `fc9e300` (`feat: export draft salary advice payslips`).
- `npm.cmd run typecheck`: correcto.
- `npm.cmd run build`: correcto.
- `npm.cmd run lint`: correcto; solo mantiene dos advertencias preexistentes de Fast Refresh en `src/lib/i18n.tsx`.
- `git diff --check`: correcto.
- Playwright/Chrome con viewport móvil 390×844: modal, ventana de impresión y contenido Salary Advice verificados; `scrollWidth = 390`.
- Producción: `https://field-hours.vercel.app/` responde HTTP 200 y el bundle publicado contiene `Salary Advice` y `Print / save Salary Advice`.
