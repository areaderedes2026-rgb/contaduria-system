import { z } from 'zod';
import * as consultasRepo from '../repositories/consultas.repository.js';
import { AppError } from '../utils/errors.js';
import type { MovimientoConsolidado, EjecucionCuenta } from '../repositories/consultas.repository.js';

const buscarExpedienteSchema = z.object({
  numero: z.coerce.number().int().positive(),
  anio: z.coerce.number().int().min(2000).max(2100),
});

const movimientosCuentaSchema = z.object({
  cuentaId: z.coerce.number().int().positive(),
  fechaDesde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  fechaHasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function getExpedienteTrazabilidad(expedienteId: number) {
  const data = await consultasRepo.getExpedienteTrazabilidad(expedienteId);
  if (!data) {
    throw new AppError(404, 'Expediente no encontrado', 'EXPEDIENTE_NOT_FOUND');
  }
  return data;
}

export async function buscarExpedienteTrazabilidad(params: { numero: number; anio: number }) {
  const parsed = buscarExpedienteSchema.parse(params);
  const id = await consultasRepo.findExpedienteIdByNumero(parsed.numero, parsed.anio);
  if (!id) {
    throw new AppError(404, 'Expediente no encontrado', 'EXPEDIENTE_NOT_FOUND');
  }
  return getExpedienteTrazabilidad(id);
}

export async function getMovimientosPorCuenta(params: {
  cuentaId: number;
  fechaDesde?: string;
  fechaHasta?: string;
}) {
  const parsed = movimientosCuentaSchema.parse(params);
  return consultasRepo.getMovimientosPorCuenta(
    parsed.cuentaId,
    parsed.fechaDesde,
    parsed.fechaHasta
  );
}

export async function buscarPorBeneficiario(
  search: string,
  page = 1,
  limit = 15,
  tipo?: string
) {
  if (!search || search.trim().length < 2) {
    throw new AppError(400, 'Ingrese al menos 2 caracteres para buscar', 'SEARCH_TOO_SHORT');
  }

  const tiposValidos = ['EXPEDIENTE', 'AFECTACION', 'LIBRAMIENTO', 'PAGO'];
  if (tipo && !tiposValidos.includes(tipo)) {
    throw new AppError(400, 'Tipo de documento inválido', 'INVALID_TIPO');
  }

  return consultasRepo.buscarPorBeneficiario(
    search.trim(),
    page,
    Math.min(limit, 100),
    tipo
  );
}

export async function getMovimientosConsolidados(params: {
  page?: number;
  limit?: number;
  tipo?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  anio?: number;
  search?: string;
}) {
  const tiposValidos = ['EXPEDIENTE', 'AFECTACION', 'LIBRAMIENTO', 'PAGO'];
  if (params.tipo && !tiposValidos.includes(params.tipo)) {
    throw new AppError(400, 'Tipo de movimiento inválido', 'INVALID_TIPO');
  }

  return consultasRepo.getMovimientosConsolidados({
    page: params.page ?? 1,
    limit: Math.min(params.limit ?? 15, 100),
    tipo: params.tipo,
    fechaDesde: params.fechaDesde,
    fechaHasta: params.fechaHasta,
    anio: params.anio,
    search: params.search,
  });
}

export async function getEjecucionPresupuestaria(anio?: number) {
  return consultasRepo.getEjecucionPresupuestaria(anio);
}

export async function getResumen() {
  return consultasRepo.getResumenConsultas();
}

export function movimientosToCsv(movimientos: MovimientoConsolidado[]): string {
  const headers = ['Tipo', 'Número', 'Fecha', 'Expediente', 'Beneficiario', 'Monto', 'Estado'];
  const rows = movimientos.map((m) => [
    m.tipo,
    m.numero_completo,
    m.fecha,
    m.expediente_numero,
    `"${m.beneficiario.replace(/"/g, '""')}"`,
    m.monto.toFixed(2),
    m.estado,
  ]);
  return [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
}

export function ejecucionToCsv(cuentas: EjecucionCuenta[]): string {
  const headers = [
    'Código', 'Descripción', 'Tipo', 'Presupuesto', 'Afectado', 'Disponible', 'Pagado', '% Ejecutado',
  ];
  const rows = cuentas.map((c) => [
    c.codigo,
    `"${c.descripcion.replace(/"/g, '""')}"`,
    c.tipo,
    c.saldo_inicial.toFixed(2),
    c.saldo_afectado.toFixed(2),
    c.saldo_disponible.toFixed(2),
    c.monto_pagado.toFixed(2),
    c.porcentaje_ejecutado.toFixed(2),
  ]);
  return [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
}

export async function exportMovimientos(filters: {
  tipo?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  anio?: number;
  search?: string;
}) {
  const result = await consultasRepo.getMovimientosConsolidadosForExport({
    tipo: filters.tipo,
    fechaDesde: filters.fechaDesde,
    fechaHasta: filters.fechaHasta,
    anio: filters.anio,
    search: filters.search,
  });
  return result.data;
}
