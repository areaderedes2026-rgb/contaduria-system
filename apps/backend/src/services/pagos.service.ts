import { z } from 'zod';
import * as pagosRepo from '../repositories/pagos.repository.js';
import * as libramientosRepo from '../repositories/libramientos.repository.js';
import * as expedientesRepo from '../repositories/expedientes.repository.js';
import { registrarAuditoria } from '../repositories/audit.repository.js';
import { AppError } from '../utils/errors.js';
import {
  formatPagoNumero,
  getAnioFromFecha,
  MEDIOS_PAGO,
} from '../utils/pago.utils.js';
import type { Pago } from '../entities/index.js';

const createPagoSchema = z.object({
  fecha_pago: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  libramiento_id: z.number().int().positive(),
  medio_pago: z.enum(['EFECTIVO', 'TRANSFERENCIA', 'CHEQUE', 'OTRO']),
  /** Si se omite, se paga el saldo pendiente completo. */
  monto: z.number().positive().optional(),
  numero_comprobante: z.string().max(100).optional(),
  banco: z.string().max(150).optional(),
  observaciones: z.string().max(2000).optional(),
  anio: z.number().int().min(2000).max(2100).optional(),
  numero: z.number().int().positive().optional(),
});

const anularSchema = z.object({
  motivo: z.string().min(5).max(1000),
});

function mapTransactionError(error: unknown): never {
  if (error instanceof Error) {
    const map: Record<string, [number, string, string]> = {
      LIBRAMIENTO_NOT_FOUND: [404, 'Libramiento no encontrado', 'LIBRAMIENTO_NOT_FOUND'],
      LIBRAMIENTO_ANNULLED: [400, 'El libramiento está anulado', 'LIBRAMIENTO_ANNULLED'],
      ALREADY_PAID: [400, 'El libramiento ya fue pagado', 'ALREADY_PAID'],
      EXPEDIENTE_NOT_FOUND: [404, 'Expediente no encontrado', 'EXPEDIENTE_NOT_FOUND'],
      INVALID_EXPEDIENTE_STATE: [400, 'El expediente debe estar en estado Librado', 'INVALID_EXPEDIENTE_STATE'],
      MONTO_MISMATCH: [400, 'El monto debe coincidir con el neto del libramiento', 'MONTO_MISMATCH'],
      MONTO_INVALID: [400, 'El monto del pago debe ser mayor a cero', 'MONTO_INVALID'],
      MONTO_EXCEEDS_SALDO: [
        400,
        'El monto supera el saldo pendiente del libramiento',
        'MONTO_EXCEEDS_SALDO',
      ],
      PAGO_NOT_FOUND: [404, 'Pago no encontrado', 'PAGO_NOT_FOUND'],
      ALREADY_ANNULLED: [400, 'El pago ya está anulado', 'ALREADY_ANNULLED'],
      EXPEDIENTE_ARCHIVED: [400, 'No se puede anular un pago de un expediente archivado', 'EXPEDIENTE_ARCHIVED'],
      DUPLICATE_NUMERO: [400, 'Ya existe un pago con ese número para el año', 'DUPLICATE_NUMERO'],
    };
    const mapped = map[error.message];
    if (mapped) {
      throw new AppError(mapped[0], mapped[1], mapped[2]);
    }
  }
  throw error;
}

function saldoPendiente(libramiento: { neto: number; monto_pagado?: number }): number {
  const pagado = Number(libramiento.monto_pagado ?? 0);
  return Math.round((Number(libramiento.neto) - pagado) * 100) / 100;
}

export async function listPagos(params: {
  page?: number;
  limit?: number;
  search?: string;
  anio?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  anulado?: boolean;
  medioPago?: string;
  expedienteId?: number;
  libramientoId?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}) {
  return pagosRepo.findAll({
    page: params.page ?? 1,
    limit: Math.min(params.limit ?? 15, 100),
    search: params.search,
    anio: params.anio,
    fechaDesde: params.fechaDesde,
    fechaHasta: params.fechaHasta,
    anulado: params.anulado,
    medioPago: params.medioPago,
    expedienteId: params.expedienteId,
    libramientoId: params.libramientoId,
    sortBy: params.sortBy ?? 'created_at',
    sortOrder: params.sortOrder ?? 'desc',
  });
}

export async function getPago(id: number) {
  const pago = await pagosRepo.findById(id);
  if (!pago) {
    throw new AppError(404, 'Pago no encontrado', 'PAGO_NOT_FOUND');
  }
  return pago;
}

export async function getSiguienteNumero(anio?: number) {
  const year = anio ?? new Date().getFullYear();
  const siguiente = await pagosRepo.getNextNumero(year);
  return { anio: year, siguiente, preview: formatPagoNumero(siguiente, year) };
}

export async function getLibramientosPendientes() {
  return pagosRepo.findLibramientosPendientes();
}

export async function getLibramientoParaPago(libramientoId: number) {
  const libramiento = await libramientosRepo.findById(libramientoId, true);
  if (!libramiento || libramiento.anulado) {
    throw new AppError(404, 'Libramiento no encontrado', 'LIBRAMIENTO_NOT_FOUND');
  }
  if (libramiento.pagado) {
    throw new AppError(400, 'El libramiento ya fue pagado', 'ALREADY_PAID');
  }

  return {
    ...libramiento,
    monto_pagado: Number(libramiento.monto_pagado ?? 0),
    saldo_pendiente: saldoPendiente(libramiento),
  };
}

export async function createPago(
  data: z.infer<typeof createPagoSchema>,
  actorId: number,
  ip?: string
) {
  const parsed = createPagoSchema.parse(data);
  const anio = parsed.anio ?? getAnioFromFecha(parsed.fecha_pago);

  if (getAnioFromFecha(parsed.fecha_pago) !== anio) {
    throw new AppError(400, 'El año debe coincidir con la fecha de pago', 'YEAR_MISMATCH');
  }

  const libramiento = await getLibramientoParaPago(parsed.libramiento_id);
  const expedientePago = await expedientesRepo.findById(libramiento.expediente_id);
  if (expedientePago?.circuito === 'CARGO_A_RENDIR') {
    throw new AppError(
      400,
      'Los libramientos de cargo a rendir no se pagan desde Pagos. El pago de anticipo se habilitará más adelante.',
      'INVALID_CIRCUITO'
    );
  }
  const saldo = saldoPendiente(libramiento);
  const monto = parsed.monto != null
    ? Math.round(parsed.monto * 100) / 100
    : saldo;

  if (!(monto > 0)) {
    throw new AppError(400, 'El monto del pago debe ser mayor a cero', 'MONTO_INVALID');
  }
  if (monto - saldo > 0.01) {
    throw new AppError(
      400,
      'El monto supera el saldo pendiente del libramiento',
      'MONTO_EXCEEDS_SALDO'
    );
  }

  const numeroManual = parsed.numero;
  if (numeroManual != null) {
    if (await pagosRepo.existsNumeroAnio(numeroManual, anio)) {
      throw new AppError(
        400,
        `Ya existe un pago con el número ${formatPagoNumero(numeroManual, anio)}`,
        'DUPLICATE_NUMERO'
      );
    }
  }

  let pagoId: number;
  try {
    pagoId = await pagosRepo.create({
      numero: numeroManual,
      anio,
      fecha_pago: parsed.fecha_pago,
      libramiento_id: parsed.libramiento_id,
      expediente_id: libramiento.expediente_id,
      beneficiario: libramiento.beneficiario,
      monto,
      medio_pago: parsed.medio_pago,
      numero_comprobante: parsed.numero_comprobante?.trim(),
      banco: parsed.banco?.trim(),
      observaciones: parsed.observaciones?.trim(),
      usuario_registro_id: actorId,
    });
  } catch (error) {
    mapTransactionError(error);
  }

  const pago = await pagosRepo.findById(pagoId!);

  await registrarAuditoria({
    usuario_id: actorId,
    accion: 'CREATE',
    entidad: 'pagos',
    entidad_id: pagoId!,
    cambios: {
      numero_completo: formatPagoNumero(pago!.numero, anio),
      libramiento_id: parsed.libramiento_id,
      monto,
      medio_pago: parsed.medio_pago,
      parcial: monto < saldo - 0.01 || Number(libramiento.monto_pagado ?? 0) > 0.01,
    },
    ip,
  });

  return pago!;
}

export async function anularPago(
  id: number,
  data: z.infer<typeof anularSchema>,
  actorId: number,
  ip?: string
) {
  const parsed = anularSchema.parse(data);
  const existing = await getPago(id);

  if (existing.anulado) {
    throw new AppError(400, 'El pago ya está anulado', 'ALREADY_ANNULLED');
  }

  try {
    await pagosRepo.anular(id, parsed.motivo.trim(), actorId);
  } catch (error) {
    mapTransactionError(error);
  }

  await registrarAuditoria({
    usuario_id: actorId,
    accion: 'ANULAR',
    entidad: 'pagos',
    entidad_id: id,
    cambios: { motivo: parsed.motivo, monto: existing.monto },
    ip,
  });

  return pagosRepo.findById(id);
}

export async function exportPagos(filters: {
  search?: string;
  anio?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  anulado?: boolean;
  medioPago?: string;
  expedienteId?: number;
  libramientoId?: number;
}) {
  return pagosRepo.findAllForExport(filters);
}

export function pagosToCsv(pagos: Pago[]): string {
  const headers = [
    'Número',
    'Año',
    'Fecha pago',
    'Expediente',
    'Libramiento',
    'Beneficiario',
    'Monto',
    'Medio de pago',
    'Comprobante',
    'Banco',
    'Observaciones',
    'Anulado',
    'Motivo anulación',
    'Registrado por',
  ];

  const rows = pagos.map((p) => [
    p.numero,
    p.anio,
    p.fecha_pago,
    p.expediente_numero ?? p.expediente_id,
    p.libramiento_numero ?? p.libramiento_id,
    `"${p.beneficiario.replace(/"/g, '""')}"`,
    p.monto.toFixed(2),
    p.medio_pago,
    p.numero_comprobante ?? '',
    p.banco ? `"${p.banco.replace(/"/g, '""')}"` : '',
    p.observaciones ? `"${p.observaciones.replace(/"/g, '""')}"` : '',
    p.anulado ? 'Sí' : 'No',
    p.motivo_anulacion ? `"${p.motivo_anulacion.replace(/"/g, '""')}"` : '',
    p.usuario_registro_nombre
      ? `"${p.usuario_registro_nombre.replace(/"/g, '""')}"`
      : '',
  ]);

  return [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
}

export async function getResumen() {
  return pagosRepo.getResumenTotales();
}

export function getMediosPago() {
  return MEDIOS_PAGO;
}
