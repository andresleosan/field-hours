# Límites de operaciones sensibles

Las operaciones administrativas que descifran o preparan información de nómina tienen un límite
por organización y administrador. El contador usa la tabla D1 existente
`workforce_auth_attempts`, pero la clave persistida es un SHA-256 namespaced; nunca se almacenan
referencias fiscales, nombres ni importes.

| Operación | Límite predeterminado | Ventana | Código HTTP |
| --- | ---: | ---: | --- |
| Revelar perfil (`/payroll-profiles/:id/reveal`) | 10 | 15 min | `429 PAYROLL_RATE_LIMITED` |
| Preparar Salary Advice (`/payslips/:userId`) | 30 | 15 min | `429 PAYROLL_RATE_LIMITED` |

La respuesta limitada incluye `Retry-After` y no incluye datos del perfil ni del recibo. Las
reimpresiones legítimas quedan cubiertas por el cupo independiente de Salary Advice. Los valores
se pueden diferenciar por entorno con `PAYROLL_PROFILE_REVEAL_LIMIT`,
`PAYROLL_PROFILE_REVEAL_WINDOW_SECONDS`, `PAYROLL_PAYSLIP_LIMIT` y
`PAYROLL_PAYSLIP_WINDOW_SECONDS`; los valores inválidos vuelven a los defaults seguros.

La comprobación ocurre después de autenticación y CSRF, antes de descifrar o generar el documento.
El cambio está preparado para local/staging/producción; aún requiere un despliegue aprobado para
activar las variables nuevas en el Worker remoto.
