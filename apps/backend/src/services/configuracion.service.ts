import { z } from 'zod';
import * as configRepo from '../repositories/configuracion.repository.js';
import { AppError } from '../utils/errors.js';

const fieldPosSchema = z.object({
  xMm: z.number().min(-50).max(260),
  yMm: z.number().min(-50).max(350),
  widthMm: z.number().min(0).max(220).optional(),
  heightMm: z.number().min(0).max(120).optional(),
  fontSizePt: z.number().min(5).max(28).optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
  letterSpacingEm: z.number().min(-0.2).max(1).optional(),
  visible: z.boolean().optional(),
});

export const impresionAfectacionCamposSchema = z.object({
  logo: fieldPosSchema,
  organismo: fieldPosSchema,
  titulo: fieldPosSchema,
  numero: fieldPosSchema,
  expediente: fieldPosSchema,
  destinatario: fieldPosSchema,
  intro: fieldPosSchema,
  detalle: fieldPosSchema,
  total: fieldPosSchema,
  pie: fieldPosSchema,
  firmaSello: fieldPosSchema,
});

export type ImpresionAfectacionCampos = z.infer<typeof impresionAfectacionCamposSchema>;

export const DEFAULT_IMPRESION_AFECTACION_CAMPOS: ImpresionAfectacionCampos = {
  logo: { xMm: 80, yMm: 10, widthMm: 50, heightMm: 22, align: 'center', visible: true },
  organismo: { xMm: 20, yMm: 36, widthMm: 170, fontSizePt: 12, align: 'center', visible: true },
  titulo: { xMm: 20, yMm: 46, widthMm: 170, fontSizePt: 13, align: 'center', visible: true },
  numero: { xMm: 20, yMm: 56, widthMm: 170, fontSizePt: 12, align: 'center', visible: true },
  expediente: { xMm: 20, yMm: 70, widthMm: 170, fontSizePt: 11, align: 'left', visible: true },
  destinatario: { xMm: 20, yMm: 78, widthMm: 170, fontSizePt: 11, align: 'left', visible: true },
  intro: { xMm: 20, yMm: 90, widthMm: 170, heightMm: 28, fontSizePt: 11, align: 'left', visible: true },
  detalle: { xMm: 20, yMm: 122, widthMm: 170, heightMm: 70, fontSizePt: 10, align: 'left', visible: true },
  total: { xMm: 100, yMm: 200, widthMm: 90, fontSizePt: 11, align: 'right', visible: true },
  pie: { xMm: 20, yMm: 230, widthMm: 110, fontSizePt: 11, align: 'left', visible: true },
  firmaSello: {
    xMm: 145,
    yMm: 245,
    widthMm: 45,
    heightMm: 35,
    align: 'center',
    visible: true,
  },
};

export const impresionAfectacionSchema = z.object({
  organismo: z.string().min(1).max(200),
  tituloDocumento: z.string().min(1).max(200),
  mostrarLogo: z.boolean(),
  logoDataUrl: z.string().max(3_500_000).nullable(),
  etiquetaNumero: z.string().min(1).max(20),
  usarNumeroCompleto: z.boolean(),
  paddingNumero: z.number().int().min(0).max(12),
  etiquetaExpediente: z.string().min(1).max(80),
  etiquetaDestinatario: z.string().min(1).max(80),
  textoIntroduccion: z.string().min(1).max(4000),
  pieDepartamento: z.string().min(1).max(200),
  mostrarFechaPie: z.boolean(),
  formatoFecha: z.enum(['dd/mm/yy', 'dd/mm/yyyy']),
  columnaCodigo: z.string().min(1).max(40),
  columnaDenominacion: z.string().min(1).max(40),
  columnaImporte: z.string().min(1).max(40),
  etiquetaTotal: z.string().min(1).max(40),
  tamanoFuente: z.enum(['pequeno', 'normal', 'grande']).default('normal'),
  mostrarImporteLetrasDetalle: z.boolean().default(false),
  mostrarImporteLetrasTotal: z.boolean().default(true),
  /** Firma / sello al pie (derecha): opcional */
  mostrarFirmaSello: z.boolean().default(false),
  firmaSelloDataUrl: z.string().max(3_500_000).nullable().default(null),
  offsetXMm: z.number().min(-30).max(30).default(0),
  offsetYMm: z.number().min(-30).max(30).default(0),
  escala: z.number().min(0.85).max(1.15).default(1),
  mostrarRejilla: z.boolean().default(false),
  rejillaPasoMm: z.number().min(2).max(20).default(5),
  mostrarNombresCamposPreview: z.boolean().default(true),
  campos: impresionAfectacionCamposSchema,
});

export type ImpresionAfectacionConfig = z.infer<typeof impresionAfectacionSchema>;

export const DEFAULT_IMPRESION_AFECTACION: ImpresionAfectacionConfig = {
  organismo: 'Municipalidad de Trancas',
  tituloDocumento: 'Afectación Presupuestaria',
  mostrarLogo: true,
  logoDataUrl: null,
  etiquetaNumero: 'N°',
  usarNumeroCompleto: true,
  paddingNumero: 10,
  etiquetaExpediente: 'Expediente/s',
  etiquetaDestinatario: 'Destinatario',
  textoIntroduccion:
    'Sr. Contador General:\nInformo a Ud. que existen los créditos presupuestarios suficientes para afrontar la erogación que por estos actuados se tramita, la que sería registrada en:',
  pieDepartamento: 'Departamento Contaduría',
  mostrarFechaPie: true,
  formatoFecha: 'dd/mm/yy',
  columnaCodigo: 'Código',
  columnaDenominacion: 'Denominación',
  columnaImporte: 'Importe',
  etiquetaTotal: 'Total',
  tamanoFuente: 'normal',
  mostrarImporteLetrasDetalle: false,
  mostrarImporteLetrasTotal: true,
  mostrarFirmaSello: false,
  firmaSelloDataUrl: null,
  offsetXMm: 0,
  offsetYMm: 0,
  escala: 1,
  mostrarRejilla: false,
  rejillaPasoMm: 5,
  mostrarNombresCamposPreview: true,
  campos: DEFAULT_IMPRESION_AFECTACION_CAMPOS,
};

const CLAVE_AFECTACION = 'impresion_afectacion';

function deepMergeCamposAfectacion(
  defaults: ImpresionAfectacionCampos,
  incoming: unknown
): ImpresionAfectacionCampos {
  const merged: Record<string, unknown> = structuredClone(defaults);
  if (!incoming || typeof incoming !== 'object') {
    return merged as ImpresionAfectacionCampos;
  }
  const o = incoming as Record<string, unknown>;
  for (const [key, value] of Object.entries(o)) {
    const current = merged[key];
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      current &&
      typeof current === 'object' &&
      !Array.isArray(current)
    ) {
      merged[key] = { ...(current as object), ...(value as object) };
    } else if (value !== undefined) {
      merged[key] = value;
    }
  }
  return merged as ImpresionAfectacionCampos;
}

function parseConfig(raw: string | null | undefined): ImpresionAfectacionConfig {
  if (!raw) return structuredClone(DEFAULT_IMPRESION_AFECTACION);
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    const base =
      parsed && typeof parsed === 'object' ? { ...parsed } : {};

    if (
      typeof base.mostrarImporteEnLetras === 'boolean' &&
      base.mostrarImporteLetrasDetalle === undefined &&
      base.mostrarImporteLetrasTotal === undefined
    ) {
      base.mostrarImporteLetrasDetalle = false;
      base.mostrarImporteLetrasTotal = base.mostrarImporteEnLetras;
    }
    delete base.mostrarImporteEnLetras;

    const campos = deepMergeCamposAfectacion(
      DEFAULT_IMPRESION_AFECTACION_CAMPOS,
      base.campos
    );

    const result = impresionAfectacionSchema.safeParse({
      ...DEFAULT_IMPRESION_AFECTACION,
      ...base,
      campos,
    });
    return result.success
      ? result.data
      : structuredClone(DEFAULT_IMPRESION_AFECTACION);
  } catch {
    return structuredClone(DEFAULT_IMPRESION_AFECTACION);
  }
}

export async function getImpresionAfectacion(): Promise<ImpresionAfectacionConfig> {
  const row = await configRepo.findByClave(CLAVE_AFECTACION);
  return parseConfig(row?.valor);
}

export async function updateImpresionAfectacion(
  data: unknown
): Promise<ImpresionAfectacionConfig> {
  const incoming =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const campos = deepMergeCamposAfectacion(
    DEFAULT_IMPRESION_AFECTACION_CAMPOS,
    incoming.campos
  );
  const parsed = impresionAfectacionSchema.safeParse({
    ...DEFAULT_IMPRESION_AFECTACION,
    ...incoming,
    campos,
  });
  if (!parsed.success) {
    throw new AppError(400, 'Configuración de impresión inválida', 'INVALID_PRINT_CONFIG');
  }

  if (parsed.data.logoDataUrl) {
    const ok =
      parsed.data.logoDataUrl.startsWith('data:image/') ||
      parsed.data.logoDataUrl.startsWith('/');
    if (!ok) {
      throw new AppError(
        400,
        'El logo debe ser una imagen (data URL) o una ruta relativa',
        'INVALID_LOGO'
      );
    }
  }

  if (parsed.data.firmaSelloDataUrl) {
    const ok =
      parsed.data.firmaSelloDataUrl.startsWith('data:image/') ||
      parsed.data.firmaSelloDataUrl.startsWith('/');
    if (!ok) {
      throw new AppError(
        400,
        'La firma/sello debe ser una imagen (data URL) o una ruta relativa',
        'INVALID_FIRMA'
      );
    }
  }

  await configRepo.upsert(
    CLAVE_AFECTACION,
    JSON.stringify(parsed.data),
    'Plantilla de impresión de afectaciones presupuestarias'
  );

  return parsed.data;
}

/* ─── Libramientos (overlay sobre formulario preimpreso) ─── */

const colPosSchema = z.object({
  xMm: z.number().min(-50).max(260),
  widthMm: z.number().min(0).max(220).optional(),
  fontSizePt: z.number().min(5).max(28).optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
  letterSpacingEm: z.number().min(-0.2).max(1).optional(),
  visible: z.boolean().optional(),
});

// Reutilizar fieldPosSchema ya definido arriba para libramientos

export const impresionLibramientoCamposSchema = z.object({
  numero: fieldPosSchema,
  son: fieldPosSchema,
  fechaDia: fieldPosSchema,
  fechaMes: fieldPosSchema,
  fechaAnio: fieldPosSchema,
  beneficiario: fieldPosSchema,
  importeLetras: fieldPosSchema,
  concepto: fieldPosSchema,
  nCheque: fieldPosSchema,
  nDecreto: fieldPosSchema,
  nExpediente: fieldPosSchema,
  detalleInicioYMm: z.number().min(0).max(280),
  detalleAltoFilaMm: z.number().min(2).max(20),
  detalleMaxFilas: z.number().int().min(1).max(30),
  detalleCodigo: colPosSchema,
  detalleDenominacion: colPosSchema,
  detalleImporte: colPosSchema,
  retencionesInicioYMm: z.number().min(0).max(280),
  retencionesAltoFilaMm: z.number().min(2).max(20),
  retencionesMaxFilas: z.number().int().min(0).max(8),
  retencionConcepto: colPosSchema,
  retencionImporte: colPosSchema,
  total: fieldPosSchema,
  retencionesTotal: fieldPosSchema,
  liquido: fieldPosSchema,
  reciboImporteLetras: fieldPosSchema,
  reciboConcepto: fieldPosSchema,
  reciboDia: fieldPosSchema,
  reciboMes: fieldPosSchema,
  reciboAnio: fieldPosSchema,
});

export const impresionLibramientoSchema = z.object({
  offsetXMm: z.number().min(-40).max(40),
  offsetYMm: z.number().min(-40).max(40),
  escala: z.number().min(0.85).max(1.15),
  fuente: z.string().min(1).max(80),
  tamanoFuenteBasePt: z.number().min(7).max(16),
  colorTexto: z.string().min(1).max(30),
  margenPaginaMm: z.number().min(0).max(20),
  usarNumeroCompleto: z.boolean(),
  paddingNumero: z.number().int().min(0).max(12),
  anioFechaDosDigitos: z.boolean(),
  formatoImporte: z.enum(['con_simbolo', 'sin_simbolo', 'solo_numero']),
  decimalesImporte: z.number().int().min(0).max(2),
  mostrarImporteLetras: z.boolean(),
  importeLetrasMayusculas: z.boolean(),
  conceptoFuente: z.enum(['observaciones', 'fijo', 'vacio']),
  conceptoFijo: z.string().max(500),
  imprimirSeccionRecibo: z.boolean(),
  imprimirRetencionesLineas: z.boolean(),
  imprimirNCheque: z.boolean(),
  mesReciboEnLetras: z.boolean(),
  mostrarGuiaEnPreview: z.boolean(),
  guiaDataUrl: z.string().max(6_000_000).nullable(),
  mostrarRejilla: z.boolean(),
  rejillaPasoMm: z.number().min(1).max(20),
  mostrarNombresCamposPreview: z.boolean(),
  incluirGuiaEnPdf: z.boolean(),
  campos: impresionLibramientoCamposSchema,
});

export type ImpresionLibramientoConfig = z.infer<typeof impresionLibramientoSchema>;
export type ImpresionLibramientoCampoPos = z.infer<typeof fieldPosSchema>;

export const DEFAULT_IMPRESION_LIBRAMIENTO_CAMPOS: ImpresionLibramientoConfig['campos'] = {
  numero: { xMm: 108, yMm: 21.5, widthMm: 55, fontSizePt: 12, align: 'left', visible: true },
  son: { xMm: 20, yMm: 35, widthMm: 48, fontSizePt: 11, align: 'right', visible: true },
  fechaDia: { xMm: 156, yMm: 33.5, widthMm: 10, fontSizePt: 11, align: 'center', visible: true },
  fechaMes: { xMm: 168, yMm: 33.5, widthMm: 10, fontSizePt: 11, align: 'center', visible: true },
  fechaAnio: { xMm: 180, yMm: 33.5, widthMm: 12, fontSizePt: 11, align: 'center', visible: true },
  beneficiario: { xMm: 90, yMm: 49.5, widthMm: 108, fontSizePt: 10, align: 'left', visible: true },
  importeLetras: { xMm: 52, yMm: 59.5, widthMm: 145, heightMm: 8, fontSizePt: 9, align: 'left', visible: true },
  concepto: { xMm: 28, yMm: 71, widthMm: 170, fontSizePt: 9, align: 'left', visible: true },
  nCheque: { xMm: 40, yMm: 81.5, widthMm: 38, fontSizePt: 9, align: 'left', visible: true },
  nDecreto: { xMm: 98, yMm: 81.5, widthMm: 40, fontSizePt: 9, align: 'left', visible: true },
  nExpediente: { xMm: 155, yMm: 81.5, widthMm: 42, fontSizePt: 9, align: 'left', visible: true },
  detalleInicioYMm: 107,
  detalleAltoFilaMm: 5.2,
  detalleMaxFilas: 12,
  detalleCodigo: { xMm: 18, widthMm: 30, fontSizePt: 8, align: 'left', visible: true },
  detalleDenominacion: { xMm: 50, widthMm: 105, fontSizePt: 8, align: 'left', visible: true },
  detalleImporte: { xMm: 158, widthMm: 36, fontSizePt: 8, align: 'right', visible: true },
  retencionesInicioYMm: 176,
  retencionesAltoFilaMm: 4.2,
  retencionesMaxFilas: 4,
  retencionConcepto: { xMm: 22, widthMm: 72, fontSizePt: 8, align: 'left', visible: true },
  retencionImporte: { xMm: 96, widthMm: 28, fontSizePt: 8, align: 'right', visible: true },
  total: { xMm: 160, yMm: 176, widthMm: 36, fontSizePt: 10, align: 'right', visible: true },
  retencionesTotal: { xMm: 160, yMm: 184.5, widthMm: 36, fontSizePt: 10, align: 'right', visible: true },
  liquido: { xMm: 160, yMm: 193, widthMm: 36, fontSizePt: 10, align: 'right', visible: true },
  reciboImporteLetras: { xMm: 78, yMm: 241, widthMm: 118, heightMm: 7, fontSizePt: 9, align: 'left', visible: true },
  reciboConcepto: { xMm: 28, yMm: 251, widthMm: 168, fontSizePt: 9, align: 'left', visible: true },
  reciboDia: { xMm: 42, yMm: 261, widthMm: 14, fontSizePt: 10, align: 'center', visible: true },
  reciboMes: { xMm: 72, yMm: 261, widthMm: 55, fontSizePt: 10, align: 'left', visible: true },
  reciboAnio: { xMm: 148, yMm: 261, widthMm: 16, fontSizePt: 10, align: 'left', visible: true },
};

export const DEFAULT_IMPRESION_LIBRAMIENTO: ImpresionLibramientoConfig = {
  offsetXMm: 0,
  offsetYMm: 0,
  escala: 1,
  fuente: 'Courier New, Courier, monospace',
  tamanoFuenteBasePt: 10,
  colorTexto: '#000000',
  margenPaginaMm: 0,
  usarNumeroCompleto: true,
  paddingNumero: 0,
  anioFechaDosDigitos: true,
  formatoImporte: 'sin_simbolo',
  decimalesImporte: 2,
  mostrarImporteLetras: true,
  importeLetrasMayusculas: true,
  conceptoFuente: 'observaciones',
  conceptoFijo: '',
  imprimirSeccionRecibo: true,
  imprimirRetencionesLineas: true,
  imprimirNCheque: false,
  mesReciboEnLetras: true,
  mostrarGuiaEnPreview: true,
  guiaDataUrl: null,
  mostrarRejilla: false,
  rejillaPasoMm: 5,
  mostrarNombresCamposPreview: false,
  incluirGuiaEnPdf: false,
  campos: DEFAULT_IMPRESION_LIBRAMIENTO_CAMPOS,
};

const CLAVE_LIBRAMIENTO = 'impresion_libramiento';

function deepMergeCampos(
  base: ImpresionLibramientoConfig['campos'],
  override: unknown
): ImpresionLibramientoConfig['campos'] {
  if (!override || typeof override !== 'object') return { ...base };
  const o = override as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(o)) {
    const current = merged[key];
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      current &&
      typeof current === 'object' &&
      !Array.isArray(current)
    ) {
      merged[key] = { ...(current as object), ...(value as object) };
    } else if (value !== undefined) {
      merged[key] = value;
    }
  }
  return merged as ImpresionLibramientoConfig['campos'];
}

function parseLibramientoConfig(raw: string | null | undefined): ImpresionLibramientoConfig {
  if (!raw) return structuredClone(DEFAULT_IMPRESION_LIBRAMIENTO);
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    const base = parsed && typeof parsed === 'object' ? { ...parsed } : {};
    const campos = deepMergeCampos(
      DEFAULT_IMPRESION_LIBRAMIENTO_CAMPOS,
      base.campos
    );
    const result = impresionLibramientoSchema.safeParse({
      ...DEFAULT_IMPRESION_LIBRAMIENTO,
      ...base,
      campos,
    });
    return result.success
      ? result.data
      : structuredClone(DEFAULT_IMPRESION_LIBRAMIENTO);
  } catch {
    return structuredClone(DEFAULT_IMPRESION_LIBRAMIENTO);
  }
}

function assertGuiaOk(guia: string | null): void {
  if (!guia) return;
  const ok = guia.startsWith('data:image/') || guia.startsWith('/');
  if (!ok) {
    throw new AppError(
      400,
      'La guía debe ser una imagen (data URL) o una ruta relativa',
      'INVALID_GUIA'
    );
  }
}

export async function getImpresionLibramiento(): Promise<ImpresionLibramientoConfig> {
  const row = await configRepo.findByClave(CLAVE_LIBRAMIENTO);
  return parseLibramientoConfig(row?.valor);
}

export async function updateImpresionLibramiento(
  data: unknown
): Promise<ImpresionLibramientoConfig> {
  const incoming =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const campos = deepMergeCampos(
    DEFAULT_IMPRESION_LIBRAMIENTO_CAMPOS,
    incoming.campos
  );
  const parsed = impresionLibramientoSchema.safeParse({
    ...DEFAULT_IMPRESION_LIBRAMIENTO,
    ...incoming,
    campos,
  });
  if (!parsed.success) {
    throw new AppError(
      400,
      'Configuración de impresión de libramiento inválida',
      'INVALID_PRINT_CONFIG'
    );
  }

  assertGuiaOk(parsed.data.guiaDataUrl);

  await configRepo.upsert(
    CLAVE_LIBRAMIENTO,
    JSON.stringify(parsed.data),
    'Calibración de impresión de libramientos sobre formulario preimpreso'
  );

  return parsed.data;
}

const CLAVE_FONDO = 'cuenta_fondo_a_rendir_id';

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

export async function getFondoARendirCuenta() {
  const row = await configRepo.findByClave(CLAVE_FONDO);
  const raw = row?.valor?.trim() ?? '';
  const id = raw ? parseInt(raw, 10) : NaN;
  if (!Number.isInteger(id) || id <= 0) return null;
  const { findById } = await import('../repositories/cuentas.repository.js');
  const cuenta = await findById(id);
  if (!cuenta || cuenta.estado !== 'ACTIVA') return null;
  return cuenta;
}

export async function getFondoARendirConfig(): Promise<FondoARendirConfig> {
  const row = await configRepo.findByClave(CLAVE_FONDO);
  const raw = row?.valor?.trim() ?? '';
  const id = raw ? parseInt(raw, 10) : NaN;
  if (!Number.isInteger(id) || id <= 0) {
    return { cuenta_id: null, cuenta: null };
  }
  const { findById } = await import('../repositories/cuentas.repository.js');
  const cuenta = await findById(id);
  if (!cuenta) {
    return { cuenta_id: id, cuenta: null };
  }
  return {
    cuenta_id: cuenta.id,
    cuenta: {
      id: cuenta.id,
      codigo: cuenta.codigo,
      descripcion: cuenta.descripcion,
      tipo: cuenta.tipo,
      estado: cuenta.estado,
      saldo_disponible: cuenta.saldo_disponible,
    },
  };
}

export async function updateFondoARendirConfig(cuentaId: number | null): Promise<FondoARendirConfig> {
  if (cuentaId == null) {
    await configRepo.upsert(CLAVE_FONDO, '', 'ID de la cuenta única usada en anticipos de cargos a rendir');
    return { cuenta_id: null, cuenta: null };
  }

  const { findById } = await import('../repositories/cuentas.repository.js');
  const cuenta = await findById(cuentaId);
  if (!cuenta) {
    throw new AppError(404, 'Cuenta no encontrada', 'CUENTA_NOT_FOUND');
  }
  if (cuenta.estado !== 'ACTIVA') {
    throw new AppError(400, 'La cuenta debe estar activa', 'CUENTA_INACTIVE');
  }

  await configRepo.upsert(
    CLAVE_FONDO,
    String(cuenta.id),
    'ID de la cuenta única usada en anticipos de cargos a rendir'
  );
  return getFondoARendirConfig();
}

