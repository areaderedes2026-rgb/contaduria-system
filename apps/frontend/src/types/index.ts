export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  message: string;
  code?: string;
  errors?: Array<{ field: string; message: string }>;
}

export interface User {
  id: number;
  username: string;
  nombre: string;
  apellido: string;
  email: string | null;
  rol_id: number;
  rol_nombre: string;
  activo: boolean;
  debe_cambiar_password: boolean;
  permisos: string[];
}

export interface Rol {
  id: number;
  nombre: string;
  descripcion: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface DashboardStats {
  usuariosActivos: number;
  roles: number;
  cuentasActivas: number;
  expedientes: number;
  afectaciones: number;
  libramientos: number;
  pagos: number;
  pagosPendientes: number;
}

export type TipoCuenta = 'RECURSO' | 'GASTO' | 'PATRIMONIAL';
export type EstadoCuenta = 'ACTIVA' | 'INACTIVA';

export interface Cuenta {
  id: number;
  codigo: string;
  descripcion: string;
  tipo: TipoCuenta;
  cuenta_padre_id: number | null;
  cuenta_padre_codigo?: string | null;
  nivel: number;
  saldo_inicial: number;
  saldo_afectado: number;
  saldo_disponible: number;
  estado: EstadoCuenta;
  created_at: string;
  updated_at: string;
}

export interface CuentaHistorial {
  id: number;
  cuenta_id: number;
  accion: string;
  campo: string | null;
  valor_anterior: string | null;
  valor_nuevo: string | null;
  observacion: string | null;
  usuario_id: number | null;
  usuario_nombre?: string | null;
  created_at: string;
}

export interface CuentaAfectacionVinculo {
  id: number;
  numero: number;
  fecha: string;
  numero_completo: string;
  expediente_id: number;
  expediente_numero: string;
  destinatario: string;
  importe_linea: number;
  importe_total: number;
  observaciones: string | null;
  anulada: boolean;
}

export interface CuentaMovimiento {
  tipo: string;
  documento_id: number;
  fecha: string;
  expediente_id: number | null;
  expediente_numero: string | null;
  documento_numero: string;
  beneficiario: string;
  descripcion: string;
  importe: number;
  anulado: boolean;
  pago_id?: number | null;
  pago_numero?: string | null;
  pagado?: boolean;
}

export interface CuentaTreeNode extends Cuenta {
  hijos: CuentaTreeNode[];
}

export interface CuentaPadreOption {
  id: number;
  codigo: string;
  descripcion: string;
  nivel: number;
}

export interface CuentasResumen {
  totalActivas: number;
  totalInicial: number;
  totalAfectado: number;
  totalDisponible: number;
}

export interface Proveedor {
  id: number;
  nombre: string;
  documento: string | null;
  domicilio: string | null;
  telefono: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProveedorResumen {
  totalExpedientes: number;
  expedientesActivos: number;
  expedientesAnulados: number;
  importeTotal: number;
  importeAfectado: number;
  importePagado: number;
  porEstado: Array<{ estado: string; total: number; importe: number }>;
}

export type EstadoExpediente = 'INICIADO' | 'AFECTADO' | 'LIBRADO' | 'PAGADO' | 'ARCHIVADO';
export type CircuitoExpediente = 'PENDIENTE' | 'NORMAL' | 'CARGO_A_RENDIR';

export interface ExpedienteProveedorRef {
  id: number;
  nombre: string;
  documento?: string | null;
}

export interface Expediente {
  id: number;
  numero: number;
  anio: number;
  numero_completo: string;
  proveedor_id: number;
  proveedor_nombre?: string;
  proveedores?: ExpedienteProveedorRef[];
  importe: number;
  detalle: string;
  fechaIngreso: string;
  estado: EstadoExpediente;
  circuito?: CircuitoExpediente;
  anulado: boolean;
  motivo_anulacion: string | null;
  fecha_anulacion: string | null;
  usuario_creacion_id: number | null;
  usuario_creacion_nombre?: string | null;
  usuario_modificacion_id: number | null;
  afectaciones_activas?: number;
  anticipos_activos?: number;
  created_at: string;
  updated_at: string;
}

export interface ExpedienteHistorial {
  id: number;
  expediente_id: number;
  accion: string;
  estado_anterior: string | null;
  estado_nuevo: string | null;
  observacion: string | null;
  usuario_id: number | null;
  usuario_nombre?: string | null;
  created_at: string;
}

export interface ExpedientesResumen {
  total: number;
  activos: number;
  porEstado: Record<EstadoExpediente, number>;
}

export interface SiguienteNumeroExpediente {
  anio: number;
  siguiente: number;
  preview: string;
}

export interface AfectacionDetalle {
  id: number;
  afectacion_id: number;
  cuenta_id: number;
  cuenta_codigo?: string;
  cuenta_descripcion?: string;
  descripcion: string;
  importe: number;
  created_at: string;
}

export interface Afectacion {
  id: number;
  numero: number;
  anio: number;
  numero_completo: string;
  fecha: string;
  expediente_id: number;
  expediente_numero?: string;
  destinatario: string;
  importe_total: number;
  observaciones: string | null;
  numero_comprobante: string | null;
  anulada: boolean;
  motivo_anulacion: string | null;
  fecha_anulacion: string | null;
  usuario_creacion_id: number | null;
  usuario_creacion_nombre?: string | null;
  created_at: string;
  updated_at: string;
  detalle?: AfectacionDetalle[];
}

export interface AfectacionResumenExpediente {
  id: number;
  numero_completo: string;
  fecha: string;
  importe_total: number;
  observaciones: string | null;
  numero_comprobante: string | null;
  anulada: boolean;
}

export interface ExpedienteDisponible {
  id: number;
  numero_completo: string;
  proveedor_nombre: string;
  proveedores?: ExpedienteProveedorRef[];
  detalle: string;
  importe: number;
  importe_afectado: number;
  importe_disponible: number;
  afectaciones_activas: number;
  afectaciones?: AfectacionResumenExpediente[];
}

export interface CuentaDisponible {
  id: number;
  codigo: string;
  descripcion: string;
  saldo_disponible: number;
}

export interface AfectacionesResumen {
  total: number;
  importeTotal: number;
}

export interface SiguienteNumeroAfectacion {
  anio: number;
  siguiente: number;
  preview: string;
}

export interface Anticipo {
  id: number;
  numero: number;
  anio: number;
  numero_completo: string;
  fecha: string;
  expediente_id: number;
  expediente_numero?: string;
  cuenta_id: number;
  cuenta_codigo?: string;
  cuenta_descripcion?: string;
  destinatario: string;
  importe: number;
  observaciones: string | null;
  numero_comprobante: string | null;
  anulada: boolean;
  motivo_anulacion: string | null;
  fecha_anulacion: string | null;
  usuario_creacion_id: number | null;
  usuario_creacion_nombre?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpedienteDisponibleAnticipo {
  id: number;
  numero_completo: string;
  proveedor_nombre: string;
  proveedores?: ExpedienteProveedorRef[];
  detalle: string;
  importe: number;
  importe_anticipado: number;
  importe_disponible: number;
  anticipos_activos: number;
}

export interface AnticiposResumen {
  total: number;
  importeTotal: number;
}

export interface SiguienteNumeroAnticipo {
  anio: number;
  siguiente: number;
  preview: string;
}

export interface LibramientoAnticipo {
  id: number;
  numero: number;
  anio: number;
  numero_completo: string;
  fecha: string;
  expediente_id: number;
  expediente_numero?: string;
  anticipo_id: number;
  anticipo_numero?: string;
  beneficiario: string;
  importe: number;
  retenciones: number;
  neto: number;
  monto_pagado?: number;
  numero_decreto: string | null;
  observaciones: string | null;
  anulado: boolean;
  motivo_anulacion: string | null;
  fecha_anulacion: string | null;
  pagado: boolean;
  fecha_pago: string | null;
  usuario_creacion_id: number | null;
  usuario_creacion_nombre?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnticipoDisponibleLibramiento {
  id: number;
  numero_completo: string;
  fecha: string;
  expediente_id: number;
  expediente_numero: string;
  destinatario: string;
  importe: number;
}

export interface ExpedienteDisponibleLibramientoAnticipo {
  id: number;
  numero_completo: string;
  anticipos: AnticipoDisponibleLibramiento[];
}

export interface LibramientosAnticipoResumen {
  total: number;
  importeTotal: number;
  netoTotal: number;
}

export interface FondoARendirConfig {
  cuenta_id: number | null;
  cuenta: {
    id: number;
    codigo: string;
    descripcion: string;
    tipo: string;
    estado: string;
    saldo_disponible: number;
  } | null;
}

export interface LibramientoDetalle {
  id: number;
  libramiento_id: number;
  afectacion_detalle_id: number | null;
  cuenta_id: number;
  cuenta_codigo?: string;
  cuenta_descripcion?: string;
  descripcion: string;
  importe: number;
  created_at: string;
}

export interface Libramiento {
  id: number;
  numero: number;
  anio: number;
  numero_completo: string;
  fecha: string;
  expediente_id: number;
  expediente_numero?: string;
  afectacion_id: number;
  afectacion_numero?: string;
  beneficiario: string;
  importe: number;
  retenciones: number;
  neto: number;
  /** Acumulado de pagos vigentes. */
  monto_pagado?: number;
  numero_decreto: string | null;
  observaciones: string | null;
  anulado: boolean;
  motivo_anulacion: string | null;
  fecha_anulacion: string | null;
  pagado: boolean;
  fecha_pago: string | null;
  usuario_creacion_id: number | null;
  usuario_creacion_nombre?: string | null;
  created_at: string;
  updated_at: string;
  detalle?: LibramientoDetalle[];
}

export interface LibramientoConsolidado {
  id: number;
  origen: 'LIBRAMIENTO' | 'LIBRAMIENTO_ANTICIPO';
  circuito: CircuitoExpediente;
  numero: number;
  numero_completo: string;
  fecha: string;
  expediente_id: number;
  expediente_numero: string;
  beneficiario: string;
  importe: number;
  retenciones: number;
  neto: number;
  anulado: boolean;
  pagado: boolean;
  documento_origen: string | null;
}

export interface AfectacionDisponibleLibramiento {
  id: number;
  numero: number;
  fecha: string;
  numero_completo: string;
  expediente_id: number;
  expediente_numero: string;
  expediente_detalle: string;
  destinatario: string;
  proveedor_nombre: string;
  importe_total: number;
}

export interface ExpedienteDisponibleLibramiento {
  id: number;
  numero_completo: string;
  detalle: string;
  proveedor_nombre: string;
  afectaciones: AfectacionDisponibleLibramiento[];
}

export interface LibramientosResumen {
  total: number;
  importeTotal: number;
  netoTotal: number;
}

export interface SiguienteNumeroLibramiento {
  anio: number;
  siguiente: number;
  preview: string;
}

export type MedioPago = 'EFECTIVO' | 'TRANSFERENCIA' | 'CHEQUE' | 'OTRO';

export interface Pago {
  id: number;
  numero: number;
  anio: number;
  numero_completo: string;
  fecha_pago: string;
  libramiento_id: number;
  libramiento_numero?: string;
  expediente_id: number;
  expediente_numero?: string;
  beneficiario: string;
  monto: number;
  medio_pago: MedioPago;
  numero_comprobante: string | null;
  banco: string | null;
  observaciones: string | null;
  anulado: boolean;
  motivo_anulacion: string | null;
  fecha_anulacion: string | null;
  usuario_registro_id: number | null;
  usuario_registro_nombre?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LibramientoPendientePago {
  id: number;
  numero_completo: string;
  fecha: string;
  expediente_id: number;
  expediente_numero: string;
  beneficiario: string;
  neto: number;
  monto_pagado: number;
  saldo_pendiente: number;
  importe: number;
  retenciones: number;
  afectacion_id: number;
  afectacion_numero: string;
  numero_decreto: string | null;
  observaciones: string | null;
}

export interface PagosResumen {
  totalPagados: number;
  montoPagado: number;
  pendientes: number;
  montoPendiente: number;
}

export interface SiguienteNumeroPago {
  anio: number;
  siguiente: number;
  preview: string;
}

export interface ExpedienteTrazabilidad {
  expediente: {
    id: number;
    numero: number;
    anio: number;
    numero_completo: string;
    proveedor_nombre: string;
    detalle: string;
    importe: number;
    fechaIngreso: string;
    estado: EstadoExpediente;
    anulado: boolean;
  };
  afectaciones: Array<{
    id: number;
    numero_completo: string;
    fecha: string;
    destinatario: string;
    importe_total: number;
    numero_comprobante: string | null;
    anulada: boolean;
    detalle: Array<{
      cuenta_codigo: string;
      cuenta_descripcion: string;
      descripcion: string;
      importe: number;
    }>;
  }>;
  libramientos: Array<{
    id: number;
    numero_completo: string;
    fecha: string;
    beneficiario: string;
    importe: number;
    retenciones: number;
    neto: number;
    pagado: boolean;
    anulado: boolean;
    detalle: Array<{
      cuenta_codigo: string;
      descripcion: string;
      importe: number;
    }>;
  }>;
  pagos: Array<{
    id: number;
    numero_completo: string;
    fecha_pago: string;
    beneficiario: string;
    monto: number;
    medio_pago: string;
    anulado: boolean;
  }>;
  historial: Array<{
    id: number;
    accion: string;
    estado_anterior: string | null;
    estado_nuevo: string | null;
    observacion: string | null;
    usuario_nombre: string | null;
    created_at: string;
  }>;
}

export interface MovimientoCuenta {
  tipo: 'AFECTACION' | 'LIBRAMIENTO';
  documento_id: number;
  fecha: string;
  expediente_id: number;
  expediente_numero: string;
  documento_numero: string;
  beneficiario: string;
  descripcion: string;
  importe: number;
  anulado: boolean;
}

export interface BeneficiarioItem {
  tipo: string;
  id: number;
  numero_completo: string;
  fecha: string;
  beneficiario: string;
  monto: number;
  estado: string;
  expediente_numero: string;
  expediente_id: number;
}

export interface MovimientoConsolidado {
  tipo: string;
  id: number;
  numero_completo: string;
  fecha: string;
  beneficiario: string;
  monto: number;
  estado: string;
  expediente_numero: string;
  expediente_id: number;
}

export interface EjecucionCuenta {
  id: number;
  codigo: string;
  descripcion: string;
  tipo: string;
  saldo_inicial: number;
  saldo_afectado: number;
  saldo_disponible: number;
  monto_pagado: number;
  porcentaje_ejecutado: number;
}

export interface ConsultasResumen {
  expedientesActivos: number;
  enProceso: number;
  pagados: number;
  archivados: number;
  montoAfectado: number;
  montoPagado: number;
}

export interface AuditoriaRegistro {
  id: number;
  usuario_id: number | null;
  usuario_nombre: string | null;
  usuario_username: string | null;
  accion: string;
  entidad: string;
  entidad_id: number | null;
  cambios: Record<string, unknown> | null;
  ip: string | null;
  created_at: string;
}

export interface AuditoriaResumen {
  total: number;
  hoy: number;
  ultimos7Dias: number;
  porAccion: Array<{ accion: string; total: number }>;
  porEntidad: Array<{ entidad: string; total: number }>;
}

export interface AuditoriaFiltros {
  usuarios: Array<{ id: number; username: string; nombre: string }>;
  acciones: Array<{ value: string; label: string }>;
  entidades: Array<{ value: string; label: string }>;
}

export interface LoginResponse {
  token: string;
  user: User;
}
