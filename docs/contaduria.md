# Contaduría Municipal — Reglas de negocio

## Descripción

Sistema de gestión contable para el Departamento de Contaduría de la Municipalidad de Trancas.

## Flujo principal

```
Expediente → Afectación presupuestaria → Libramiento → Pago → Archivo
```

## Módulos por etapa

| Etapa | Módulo | Estado |
|-------|--------|--------|
| 1 | Autenticación, usuarios, dashboard | ✅ Implementado |
| 2 | Plan de cuentas | ✅ Implementado |
| 3 | Expedientes | ✅ Implementado |
| 4 | Afectaciones | ✅ Implementado |
| 5 | Libramientos | ✅ Implementado |
| 6 | Pagos | ✅ Implementado |
| 7 | Consultas | ✅ Implementado |
| 8 | Reportes | ✅ Implementado |
| 9 | Auditoría | ✅ Implementado |

## Definiciones

### Afectación presupuestaria
Reserva fondos de cuentas presupuestarias para un expediente. Al afectar:
- Disminuye el saldo disponible
- Incrementa el saldo afectado

### Libramiento
Orden de pago vinculada a una afectación activa. Define beneficiario, importe, retenciones y neto a pagar. Al crear, el expediente pasa a estado LIBRADO.

## Reglas de negocio

1. Una cuenta no puede quedar con saldo negativo
2. Una afectación puede tener múltiples cuentas
3. Un expediente puede tener múltiples movimientos
4. Toda operación debe quedar auditada
5. Los números deben ser automáticos
6. Las anulaciones deben conservar historial
7. No eliminar información importante (soft delete)
8. Todas las fechas deben registrarse

## Roles

| Rol | Descripción |
|-----|-------------|
| admin | Administrador del sistema |
| empleado | Empleado de contaduría |

## Plan de Cuentas (Etapa 2)

### Campos

| Campo | Descripción |
|-------|-------------|
| código | Jerárquico, ej: `1.1.01.12.10.11` |
| descripción | Nombre de la cuenta |
| tipo | RECURSO, GASTO, PATRIMONIAL |
| saldo_inicial | Presupuesto asignado |
| saldo_afectado | Reservado por afectaciones (Etapa 4) |
| saldo_disponible | Calculado: inicial − afectado |
| estado | ACTIVA / INACTIVA |

### Reglas implementadas

- No permitir saldo disponible negativo (CHECK en BD + validación en servicio)
- Jerarquía: el código hijo debe extender al código padre
- Soft delete: no eliminar físicamente
- No eliminar cuentas con subcuentas o saldo afectado
- No inactivar cuentas con saldo afectado
- Toda operación auditada en tabla `auditoria`

### Permisos

| Rol | Permisos |
|-----|----------|
| admin | cuentas:read, cuentas:write |
| empleado | cuentas:read |

### API

- `GET /api/cuentas` — Listado paginado con filtros
- `GET /api/cuentas/arbol` — Vista jerárquica
- `GET /api/cuentas/export` — Exportación CSV
- `GET /api/cuentas/resumen` — Totales presupuestarios
- `POST /api/cuentas` — Crear (solo admin)
- `PUT /api/cuentas/:id` — Editar (solo admin)
- `DELETE /api/cuentas/:id` — Soft delete (solo admin)

## Expedientes (Etapa 3)

### Campos

| Campo | Descripción |
|-------|-------------|
| número | Automático por año (ej: 1/2026) |
| año | Año del expediente |
| fecha | Fecha del trámite |
| destinatario | Beneficiario o proveedor |
| descripción | Detalle del expediente |
| estado | INICIADO, AFECTADO, LIBRADO, PAGADO, ARCHIVADO |

### Reglas implementadas

- Numeración automática por año (tabla `expediente_numeracion`)
- Creación siempre en estado INICIADO
- Edición/eliminación solo en estado INICIADO y no anulado
- Anulación conserva historial (no elimina físicamente)
- Archivo desde estado Iniciado (sin trámite) o Pagado (ciclo completado)
- Historial de movimientos en `expediente_historial`
- Soft delete + auditoría completa

### Permisos

| Rol | Permisos |
|-----|----------|
| admin | expedientes:read, expedientes:write |
| empleado | expedientes:read, expedientes:write |

### API

- `GET /api/expedientes` — Listado paginado con filtros
- `GET /api/expedientes/:id` — Detalle
- `GET /api/expedientes/:id/historial` — Historial de movimientos
- `GET /api/expedientes/siguiente-numero` — Preview del próximo número
- `GET /api/expedientes/export` — Exportación CSV
- `POST /api/expedientes` — Crear
- `PUT /api/expedientes/:id` — Editar
- `DELETE /api/expedientes/:id` — Soft delete
- `POST /api/expedientes/:id/anular` — Anular con motivo
- `POST /api/expedientes/:id/archivar` — Archivar

## Afectaciones (Etapa 4)

### Campos cabecera

| Campo | Descripción |
|-------|-------------|
| número | Automático por año |
| fecha | Fecha de la afectación |
| expediente | Expediente en estado Iniciado |
| destinatario | Beneficiario de la afectación |
| importe_total | Suma de los detalles |

### Campos detalle

| Campo | Descripción |
|-------|-------------|
| cuenta | Cuenta presupuestaria |
| descripción | Concepto del gasto |
| importe | Monto a reservar |

### Reglas implementadas

- No permitir saldo negativo (validación transaccional con `FOR UPDATE`)
- Actualización automática de `saldo_afectado` en cuentas
- Numeración automática por año
- Expediente pasa a estado AFECTADO
- Anulación revierte saldos y restaura expediente a INICIADO si corresponde
- Una afectación activa por expediente
- Auditoría completa

### API

- `GET /api/afectaciones` — Listado con filtros
- `GET /api/afectaciones/:id` — Detalle con líneas
- `GET /api/afectaciones/expedientes-disponibles` — Expedientes para afectar
- `GET /api/afectaciones/cuentas-disponibles` — Cuentas con saldo disponible
- `POST /api/afectaciones` — Crear afectación
- `POST /api/afectaciones/:id/anular` — Anular y revertir saldos
- `GET /api/afectaciones/export` — Exportación CSV

## Libramientos (Etapa 5)

### Campos cabecera

| Campo | Descripción |
|-------|-------------|
| número | Automático por año |
| fecha | Fecha del libramiento |
| afectación | Afectación activa sin libramiento previo |
| beneficiario | Persona o entidad a pagar |
| importe | Monto total del libramiento |
| retenciones | Descuentos aplicados |
| neto | importe − retenciones |

### Campos detalle

| Campo | Descripción |
|-------|-------------|
| cuenta | Cuenta de la afectación |
| descripción | Concepto |
| importe | Monto por cuenta (≤ monto afectado) |

### Reglas implementadas

- Solo afectaciones activas con expediente en estado AFECTADO
- Un libramiento activo por afectación
- `neto = importe − retenciones` (no negativo)
- Importe total ≤ importe de la afectación
- Numeración automática por año
- Expediente pasa a estado LIBRADO
- Anulación revierte expediente a AFECTADO si no hay más libramientos activos
- No se puede anular un libramiento pagado (Etapa 6)
- Auditoría completa

### Permisos

| Rol | Permisos |
|-----|----------|
| admin | libramientos:read, libramientos:write |
| empleado | libramientos:read, libramientos:write |

### API

- `GET /api/libramientos` — Listado con filtros
- `GET /api/libramientos/:id` — Detalle con líneas
- `GET /api/libramientos/afectaciones-disponibles` — Afectaciones para librar
- `GET /api/libramientos/afectacion/:id` — Afectación con detalle para formulario
- `GET /api/libramientos/siguiente-numero` — Preview del próximo número
- `GET /api/libramientos/resumen` — Totales
- `POST /api/libramientos` — Crear libramiento
- `POST /api/libramientos/:id/anular` — Anular
- `GET /api/libramientos/export` — Exportación CSV

## Pagos (Etapa 6)

### Campos

| Campo | Descripción |
|-------|-------------|
| número | Automático por año |
| fecha_pago | Fecha efectiva del desembolso |
| libramiento | Libramiento activo no pagado |
| monto | Neto del libramiento (importe − retenciones) |
| medio_pago | EFECTIVO, TRANSFERENCIA, CHEQUE, OTRO |
| número_comprobante | Obligatorio para transferencias y cheques |
| banco | Opcional, para transferencias/cheques |

### Reglas implementadas

- Solo libramientos activos con expediente en estado LIBRADO
- Un pago vigente por libramiento
- Monto debe coincidir con el neto del libramiento
- Numeración automática por año
- Libramiento marcado como pagado; expediente pasa a PAGADO
- Anulación revierte libramiento y expediente a LIBRADO si corresponde
- No se puede anular pago de expediente archivado
- Auditoría completa

### Permisos

| Rol | Permisos |
|-----|----------|
| admin | pagos:read, pagos:write |
| empleado | pagos:read, pagos:write |

### API

- `GET /api/pagos` — Listado con filtros
- `GET /api/pagos/:id` — Detalle
- `GET /api/pagos/libramientos-pendientes` — Libramientos a pagar
- `GET /api/pagos/libramiento/:id` — Libramiento para formulario
- `GET /api/pagos/siguiente-numero` — Preview del próximo número
- `GET /api/pagos/resumen` — Totales y pendientes
- `POST /api/pagos` — Registrar pago
- `POST /api/pagos/:id/anular` — Anular pago
- `GET /api/pagos/export` — Exportación CSV

## Consultas (Etapa 7)

Módulo de solo lectura para trazabilidad, análisis y ejecución presupuestaria.

### Funcionalidades

| Consulta | Descripción |
|----------|-------------|
| Trazabilidad expediente | Cadena completa: expediente → afectaciones → libramientos → pagos → historial |
| Por cuenta | Movimientos de afectación y libramiento en una cuenta presupuestaria |
| Por beneficiario | Búsqueda cruzada en expedientes, afectaciones, libramientos y pagos |
| Movimientos consolidados | Vista unificada con filtros por tipo, fecha y año |
| Ejecución presupuestaria | Presupuesto, afectado, disponible, pagado y % ejecutado por cuenta |

### Reglas implementadas

- Solo lectura (sin mutaciones)
- Búsqueda de beneficiario mínimo 2 caracteres
- Exportación CSV de movimientos y ejecución presupuestaria
- Archivo de expedientes habilitado desde estado Pagado (cierre del ciclo)

### Permisos

| Rol | Permisos |
|-----|----------|
| admin | consultas:read |
| empleado | consultas:read |

### API

- `GET /api/consultas/resumen` — Resumen ejecutivo
- `GET /api/consultas/expediente/buscar?numero=&anio=` — Trazabilidad por número
- `GET /api/consultas/expediente/:id` — Trazabilidad por ID
- `GET /api/consultas/cuenta/:cuentaId/movimientos` — Movimientos por cuenta
- `GET /api/consultas/beneficiario?search=` — Búsqueda por beneficiario
- `GET /api/consultas/movimientos` — Movimientos consolidados
- `GET /api/consultas/movimientos/export` — Export CSV movimientos
- `GET /api/consultas/ejecucion-presupuestaria` — Ejecución por cuenta
- `GET /api/consultas/ejecucion-presupuestaria/export` — Export CSV presupuesto

## Reportes (Etapa 8)

Módulo de informes formales para impresión y exportación CSV.

### Tipos de reporte

| Reporte | Descripción |
|---------|-------------|
| Resumen ejecutivo | Totales de expedientes, afectaciones, libramientos y pagos |
| Ejecución presupuestaria | Presupuesto, afectado, disponible y pagado por cuenta |
| Expedientes | Listado detallado con filtros por fecha y estado |
| Afectaciones | Listado con montos y expediente asociado |
| Libramientos | Listado con importe, retenciones y neto |
| Pagos | Listado con medio de pago y estado |

### Funcionalidades

- Vista previa con encabezado institucional (Municipalidad de Trancas)
- Impresión / guardar como PDF desde el navegador
- Exportación CSV por tipo de reporte
- Filtros dinámicos según el tipo seleccionado

### Permisos

| Rol | Permisos |
|-----|----------|
| admin | reportes:read |
| empleado | reportes:read |

### API

- `GET /api/reportes/tipos` — Catálogo de reportes disponibles
- `GET /api/reportes/:tipo` — Generar reporte (JSON)
- `GET /api/reportes/:tipo/export` — Exportación CSV

## Auditoría (Etapa 9)

Registro inmutable de todas las operaciones del sistema. Solo lectura, sin endpoints de modificación.

### Datos registrados

| Campo | Descripción |
|-------|-------------|
| usuario | Quién realizó la acción |
| acción | LOGIN, CREATE, UPDATE, DELETE, ANULAR, ARCHIVAR |
| entidad | Módulo afectado (usuarios, cuentas, expedientes, etc.) |
| entidad_id | ID del registro afectado |
| cambios | Detalle JSON de la operación |
| ip | Dirección IP del cliente |
| fecha | Timestamp automático |

### Operaciones auditadas

- Inicio de sesión (LOGIN)
- Creación, modificación y eliminación en todos los módulos
- Anulaciones de afectaciones, libramientos y pagos
- Archivo de expedientes

### Reglas de seguridad

- Solo lectura — no existe API de modificación ni eliminación
- Permiso exclusivo de administrador (`auditoria:read`)
- Empleados no tienen acceso al log de auditoría
- Exportación CSV para respaldo y control externo

### Permisos

| Rol | Permisos |
|-----|----------|
| admin | auditoria:read |
| empleado | — (sin acceso) |

### API

- `GET /api/auditoria` — Listado paginado con filtros
- `GET /api/auditoria/:id` — Detalle de un registro
- `GET /api/auditoria/entidad/:entidad/:entidadId` — Historial de una entidad
- `GET /api/auditoria/resumen` — Estadísticas de actividad
- `GET /api/auditoria/filtros` — Opciones dinámicas de filtro
- `GET /api/auditoria/export` — Exportación CSV

## Estados de expediente

Iniciado → Afectado → Librado → Pagado → Archivado
