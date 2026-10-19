import { apiRequest } from './api';
import type { ApiResponse, FondoARendirConfig } from '@/types';

export interface PrintFieldPos {
  xMm: number;
  yMm: number;
  widthMm?: number;
  heightMm?: number;
  fontSizePt?: number;
  align?: 'left' | 'center' | 'right';
  letterSpacingEm?: number;
  visible?: boolean;
}

export interface PrintColPos {
  xMm: number;
  widthMm?: number;
  fontSizePt?: number;
  align?: 'left' | 'center' | 'right';
  letterSpacingEm?: number;
  visible?: boolean;
}

export interface ImpresionAfectacionCampos {
  logo: PrintFieldPos;
  organismo: PrintFieldPos;
  titulo: PrintFieldPos;
  numero: PrintFieldPos;
  expediente: PrintFieldPos;
  destinatario: PrintFieldPos;
  intro: PrintFieldPos;
  detalle: PrintFieldPos;
  total: PrintFieldPos;
  pie: PrintFieldPos;
  firmaSello: PrintFieldPos;
}

export interface ImpresionAfectacionConfig {
  organismo: string;
  tituloDocumento: string;
  mostrarLogo: boolean;
  logoDataUrl: string | null;
  etiquetaNumero: string;
  usarNumeroCompleto: boolean;
  paddingNumero: number;
  etiquetaExpediente: string;
  etiquetaDestinatario: string;
  textoIntroduccion: string;
  pieDepartamento: string;
  mostrarFechaPie: boolean;
  formatoFecha: 'dd/mm/yy' | 'dd/mm/yyyy';
  columnaCodigo: string;
  columnaDenominacion: string;
  columnaImporte: string;
  etiquetaTotal: string;
  tamanoFuente: 'pequeno' | 'normal' | 'grande';
  mostrarImporteLetrasDetalle: boolean;
  mostrarImporteLetrasTotal: boolean;
  mostrarFirmaSello: boolean;
  firmaSelloDataUrl: string | null;
  offsetXMm: number;
  offsetYMm: number;
  escala: number;
  mostrarRejilla: boolean;
  rejillaPasoMm: number;
  mostrarNombresCamposPreview: boolean;
  campos: ImpresionAfectacionCampos;
}

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

function deepMergeAfectacionCampos(
  defaults: ImpresionAfectacionCampos,
  incoming: unknown
): ImpresionAfectacionCampos {
  const merged = structuredClone(defaults) as ImpresionAfectacionCampos &
    Record<string, unknown>;
  if (!incoming || typeof incoming !== 'object') return merged;
  for (const [key, value] of Object.entries(incoming as Record<string, unknown>)) {
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
  return merged;
}

function normalizeImpresionConfig(
  data: Partial<ImpresionAfectacionConfig> & {
    mostrarImporteEnLetras?: boolean;
  }
): ImpresionAfectacionConfig {
  const legacy = data.mostrarImporteEnLetras;
  const campos = deepMergeAfectacionCampos(DEFAULT_IMPRESION_AFECTACION_CAMPOS, data.campos);
  return {
    ...DEFAULT_IMPRESION_AFECTACION,
    ...data,
    mostrarImporteLetrasDetalle: data.mostrarImporteLetrasDetalle ?? legacy ?? false,
    mostrarImporteLetrasTotal: data.mostrarImporteLetrasTotal ?? legacy ?? true,
    mostrarFirmaSello: data.mostrarFirmaSello ?? false,
    firmaSelloDataUrl: data.firmaSelloDataUrl ?? null,
    offsetXMm: data.offsetXMm ?? 0,
    offsetYMm: data.offsetYMm ?? 0,
    escala: data.escala ?? 1,
    mostrarRejilla: data.mostrarRejilla ?? false,
    rejillaPasoMm: data.rejillaPasoMm ?? 5,
    mostrarNombresCamposPreview: data.mostrarNombresCamposPreview ?? true,
    campos,
  };
}

export async function getImpresionAfectacionConfig() {
  const res = await apiRequest<ApiResponse<ImpresionAfectacionConfig>>(
    '/configuracion/impresion/afectacion'
  );
  return normalizeImpresionConfig(res.data ?? {});
}

export async function updateImpresionAfectacionConfig(data: ImpresionAfectacionConfig) {
  const payload = normalizeImpresionConfig(data);
  const res = await apiRequest<ApiResponse<ImpresionAfectacionConfig>>(
    '/configuracion/impresion/afectacion',
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    }
  );
  return normalizeImpresionConfig(res.data ?? {});
}

/* ─── Libramientos (overlay preimpreso) ─── */

export interface ImpresionLibramientoCampos {
  numero: PrintFieldPos;
  son: PrintFieldPos;
  fechaDia: PrintFieldPos;
  fechaMes: PrintFieldPos;
  fechaAnio: PrintFieldPos;
  beneficiario: PrintFieldPos;
  importeLetras: PrintFieldPos;
  concepto: PrintFieldPos;
  nCheque: PrintFieldPos;
  nDecreto: PrintFieldPos;
  nExpediente: PrintFieldPos;
  detalleInicioYMm: number;
  detalleAltoFilaMm: number;
  detalleMaxFilas: number;
  detalleCodigo: PrintColPos;
  detalleDenominacion: PrintColPos;
  detalleImporte: PrintColPos;
  retencionesInicioYMm: number;
  retencionesAltoFilaMm: number;
  retencionesMaxFilas: number;
  retencionConcepto: PrintColPos;
  retencionImporte: PrintColPos;
  total: PrintFieldPos;
  retencionesTotal: PrintFieldPos;
  liquido: PrintFieldPos;
  reciboImporteLetras: PrintFieldPos;
  reciboConcepto: PrintFieldPos;
  reciboDia: PrintFieldPos;
  reciboMes: PrintFieldPos;
  reciboAnio: PrintFieldPos;
}

export interface ImpresionLibramientoConfig {
  offsetXMm: number;
  offsetYMm: number;
  escala: number;
  fuente: string;
  tamanoFuenteBasePt: number;
  colorTexto: string;
  margenPaginaMm: number;
  usarNumeroCompleto: boolean;
  paddingNumero: number;
  anioFechaDosDigitos: boolean;
  formatoImporte: 'con_simbolo' | 'sin_simbolo' | 'solo_numero';
  decimalesImporte: number;
  mostrarImporteLetras: boolean;
  importeLetrasMayusculas: boolean;
  conceptoFuente: 'observaciones' | 'fijo' | 'vacio';
  conceptoFijo: string;
  imprimirSeccionRecibo: boolean;
  imprimirRetencionesLineas: boolean;
  imprimirNCheque: boolean;
  mesReciboEnLetras: boolean;
  mostrarGuiaEnPreview: boolean;
  guiaDataUrl: string | null;
  mostrarRejilla: boolean;
  rejillaPasoMm: number;
  mostrarNombresCamposPreview: boolean;
  incluirGuiaEnPdf: boolean;
  campos: ImpresionLibramientoCampos;
}

export const DEFAULT_IMPRESION_LIBRAMIENTO_CAMPOS: ImpresionLibramientoCampos = {
  numero: { xMm: 108, yMm: 21.5, widthMm: 55, fontSizePt: 12, align: 'left', visible: true },
  son: { xMm: 20, yMm: 35, widthMm: 48, fontSizePt: 11, align: 'right', visible: true },
  fechaDia: { xMm: 156, yMm: 33.5, widthMm: 10, fontSizePt: 11, align: 'center', visible: true },
  fechaMes: { xMm: 168, yMm: 33.5, widthMm: 10, fontSizePt: 11, align: 'center', visible: true },
  fechaAnio: { xMm: 180, yMm: 33.5, widthMm: 12, fontSizePt: 11, align: 'center', visible: true },
  beneficiario: { xMm: 90, yMm: 49.5, widthMm: 108, fontSizePt: 10, align: 'left', visible: true },
  importeLetras: {
    xMm: 52,
    yMm: 59.5,
    widthMm: 145,
    heightMm: 8,
    fontSizePt: 9,
    align: 'left',
    visible: true,
  },
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
  reciboImporteLetras: {
    xMm: 78,
    yMm: 241,
    widthMm: 118,
    heightMm: 7,
    fontSizePt: 9,
    align: 'left',
    visible: true,
  },
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

function deepMergeLibramientoCampos(
  base: ImpresionLibramientoCampos,
  override: Partial<ImpresionLibramientoCampos> | undefined
): ImpresionLibramientoCampos {
  const merged = structuredClone(base) as ImpresionLibramientoCampos;
  if (!override) return merged;
  for (const key of Object.keys(override) as (keyof ImpresionLibramientoCampos)[]) {
    const value = override[key];
    const current = merged[key];
    if (
      value &&
      typeof value === 'object' &&
      current &&
      typeof current === 'object'
    ) {
      Object.assign(merged, {
        [key]: { ...(current as object), ...(value as object) },
      });
    } else if (value !== undefined) {
      Object.assign(merged, { [key]: value });
    }
  }
  return merged;
}

export function normalizeImpresionLibramientoConfig(
  data: Partial<ImpresionLibramientoConfig> = {}
): ImpresionLibramientoConfig {
  return {
    ...DEFAULT_IMPRESION_LIBRAMIENTO,
    ...data,
    campos: deepMergeLibramientoCampos(DEFAULT_IMPRESION_LIBRAMIENTO_CAMPOS, data.campos),
  };
}

export async function getImpresionLibramientoConfig() {
  const res = await apiRequest<ApiResponse<ImpresionLibramientoConfig>>(
    '/configuracion/impresion/libramiento'
  );
  return normalizeImpresionLibramientoConfig(res.data ?? {});
}

export async function updateImpresionLibramientoConfig(data: ImpresionLibramientoConfig) {
  const payload = normalizeImpresionLibramientoConfig(data);
  const res = await apiRequest<ApiResponse<ImpresionLibramientoConfig>>(
    '/configuracion/impresion/libramiento',
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    }
  );
  return normalizeImpresionLibramientoConfig(res.data ?? {});
}

export async function getFondoARendirConfig() {
  const res = await apiRequest<ApiResponse<FondoARendirConfig>>('/configuracion/fondo-a-rendir');
  return res.data;
}

export async function updateFondoARendirConfig(cuentaId: number | null) {
  const res = await apiRequest<ApiResponse<FondoARendirConfig>>('/configuracion/fondo-a-rendir', {
    method: 'PUT',
    body: JSON.stringify({ cuenta_id: cuentaId }),
  });
  return res.data;
}
