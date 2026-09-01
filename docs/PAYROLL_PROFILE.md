# Identidad del empleado para Salary Advice (Jersey)

El empleado mantiene una identidad mínima que el administrador puede verificar antes de generar un
Salary Advice. Guardarla no crea una nómina y no existe revisión, aprobación ni estado de pago.

## Datos vigentes

- nombre legal;
- dirección del domicilio;
- número de empleado normalizado a mayúsculas, único por organización y limitado a 1–40 caracteres
  ASCII: letras, números, punto, guion bajo, barra y guion; el primer carácter debe ser alfanumérico;
- Tax Reference (ITIS);
- Social Security Number, usado como `Social Ref` en el documento.

El administrador asigna al perfil del empleado la tarifa horaria y el porcentaje ITIS confirmado en su
aviso vigente. El contrato activo no solicita cuenta bancaria, sort code ni una segunda referencia de
Social Security.

## Protección

- Tax Reference y Social Security Number se cifran con AES-256-GCM antes de entrar en D1.
- `PAYROLL_ENCRYPTION_KEY` debe ser un secreto de 32 bytes expresado como 64 caracteres
  hexadecimales o base64url; nunca se expone al frontend ni se guarda en Git.
- Las listas administrativas solo devuelven identificador, nombre visible, número de empleado,
  completitud y fecha de guardado.
- Los valores sensibles completos solo salen por dos operaciones administrativas: el endpoint
  `reveal`, que registra `payroll.profile.viewed`, y el cálculo seleccionado de Salary Advice, que
  los incorpora a la respuesta efímera usada para el PDF y registra `salary_advice.calculated`.
  Ambas exigen sesión, rol, organización, origen y CSRF; además tienen rate limit y nunca copian las
  referencias a la metadata de auditoría.
- El guardado usa clave compuesta `(organization_id, user_id)` y una restricción de base de datos
  `UNIQUE (organization_id, employee_number)`, además del chequeo previo para ofrecer un error
  legible. API y migración aplican la misma normalización ASCII en mayúsculas; la restricción cierra
  la carrera entre solicitudes concurrentes.

## Persistencia vigente y legado

La migración aditiva `cloudflare/migrations/0010_salary_advice_contract.sql` crea
`workforce_salary_advice_profiles` y copia únicamente identidades completas que pertenecen a una
membership activa con rol `worker` y a un usuario no deshabilitado. Una clave foránea compuesta exige
que `(organization_id, user_id)` siga perteneciendo a la misma organización. La aplicación activa
solo lee y escribe la tabla nueva.

`workforce_payroll_profiles`, creada por la migración histórica `0006`, puede conservar columnas y
datos del flujo retirado. No participa en el contrato activo y no se modifica ni elimina para evitar
una pérdida destructiva.

Antes de aplicar `0010` en producción:

1. ejecutar los dos preflight incluidos al principio de la migración para el mismo universo de workers
   activos: identificadores duplicados tras normalizar e identificadores que no cumplen el alfabeto;
   ambos deben devolver cero filas. La migración también falla completa por `CHECK`/`UNIQUE` si se
   omite el preflight y encuentra uno de esos casos; no descarta perfiles silenciosamente;
2. verificar un backup recuperable de D1;
3. confirmar `PAYROLL_ENCRYPTION_KEY`;
4. obtener autorización explícita del operador.

Orden productivo autorizado: backup y preflight, aplicar `0010`, desplegar Worker, ejecutar smoke del
backend, desplegar frontend y ejecutar smoke de interfaz. Ante un incidente, el rollback preferido es
deshabilitar Salary Advice o volver a un artefacto seguro **sin borrar las tablas nuevas**, para poder
conciliar toda escritura posterior al corte. No se debe restaurar el workflow retirado de aprobación.

La tabla histórica no puede recibir ciegamente perfiles nuevos porque su contrato exige campos ya
retirados. Antes de cualquier `DROP` se debe exportar de forma segura y reconciliar settings/perfiles
creados o cambiados desde el corte, definir un mapeo aprobado, verificar otro backup recuperable y
obtener una autorización destructiva separada. Solo entonces pueden eliminarse las dos tablas nuevas
en el orden comentado al final de `0010`; las históricas permanecen intactas.
