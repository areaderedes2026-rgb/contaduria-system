export interface Rol {
  id: number;
  nombre: string;
  descripcion: string | null;
}

export interface Usuario {
  id: number;
  username: string;
  nombre: string;
  apellido: string;
  email: string | null;
  rol_id: number;
  rol_nombre?: string;
  activo: boolean;
  debe_cambiar_password: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface UsuarioConPermisos extends Usuario {
  permisos: string[];
}

export interface AuditoriaEntry {
  id: number;
  usuario_id: number | null;
  accion: string;
  entidad: string;
  entidad_id: number | null;
  cambios: Record<string, unknown> | null;
  ip: string | null;
  created_at: Date;
}

export interface JwtPayload {
  userId: number;
  username: string;
  rol: string;
  permisos: string[];
}

export interface Cuenta {
  id: number;
  codigo: string;
  descripcion: string;
  tipo: 'RECURSO' | 'GASTO' | 'PATRIMONIAL';
  cuenta_padre_id: number | null;
  cuenta_padre_codigo?: string | null;
  nivel: number;
  saldo_inicial: number;
  saldo_afectado: number;
  saldo_disponible: number;
  estado: 'ACTIVA' | 'INACTIVA';
  created_at: Date;
  updated_at: Date;
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
  created_at: Date;
}

export interface CuentaTreeNode extends Cuenta {
  hijos: CuentaTreeNode[];
}

export interface Proveedor {
  id: number;
  nombre: string;
  documento: string | null;
  domicilio: string | null;
  telefono: string | null;
  activo: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ExpedienteProveedorRef {
  id: number;
  nombre: string;
  documento?: string | null;
}

export type CircuitoExpediente = 'PENDIENTE' | 'NORMAL' | 'CARGO_A_RENDIR';

export interface Expediente {
  id: number;
  numero: number;
  anio: number;
  numero_completo: string;
  /** Proveedor principal (orden 1). Conservado por compatibilidad. */
  proveedor_id: number;
  /** Nombres unidos de todos los proveedores vinculados. */
  proveedor_nombre?: string;
  /** Hasta 5 proveedores vinculados (ordenados). */
  proveedores?: ExpedienteProveedorRef[];
  importe: number;
  detalle: string;
  fecha_ingreso: string;
  estado: 'INICIADO' | 'AFECTADO' | 'LIBRADO' | 'PAGADO' | 'ARCHIVADO';
  circuito: CircuitoExpediente;
  anulado: boolean;
  motivo_anulacion: string | null;
  fecha_anulacion: Date | null;
  usuario_creacion_id: number | null;
  usuario_creacion_nombre?: string | null;
  usuario_modificacion_id: number | null;
  afectaciones_activas?: number;
  anticipos_activos?: number;
  created_at: Date;
  updated_at: Date;
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
  created_at: Date;
}

export interface AfectacionDetalle {
  id: number;
  afectacion_id: number;
  cuenta_id: number;
  cuenta_codigo?: string;
  cuenta_descripcion?: string;
  descripcion: string;
  importe: number;
  created_at: Date;
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
  fecha_anulacion: Date | null;
  usuario_creacion_id: number | null;
  usuario_creacion_nombre?: string | null;
  created_at: Date;
  updated_at: Date;
  detalle?: AfectacionDetalle[];
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
  created_at: Date;
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
  monto_pagado: number;
  numero_decreto: string | null;
  observaciones: string | null;
  anulado: boolean;
  motivo_anulacion: string | null;
  fecha_anulacion: Date | null;
  pagado: boolean;
  fecha_pago: string | null;
  usuario_creacion_id: number | null;
  usuario_creacion_nombre?: string | null;
  created_at: Date;
  updated_at: Date;
  detalle?: LibramientoDetalle[];
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
  fecha_anulacion: Date | null;
  usuario_registro_id: number | null;
  usuario_registro_nombre?: string | null;
  created_at: Date;
  updated_at: Date;
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
  created_at: Date;
}

export interface AuditoriaResumen {
  total: number;
  hoy: number;
  ultimos7Dias: number;
  porAccion: Array<{ accion: string; total: number }>;
  porEntidad: Array<{ entidad: string; total: number }>;
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
  fecha_anulacion: Date | null;
  usuario_creacion_id: number | null;
  usuario_creacion_nombre?: string | null;
  created_at: Date;
  updated_at: Date;
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
  monto_pagado: number;
  numero_decreto: string | null;
  observaciones: string | null;
  anulado: boolean;
  motivo_anulacion: string | null;
  fecha_anulacion: Date | null;
  pagado: boolean;
  fecha_pago: string | null;
  usuario_creacion_id: number | null;
  usuario_creacion_nombre?: string | null;
  created_at: Date;
  updated_at: Date;
}


