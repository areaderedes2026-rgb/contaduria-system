import { z } from 'zod';
import { query } from '../database/pool.js';
import * as afectacionesRepo from '../repositories/afectaciones.repository.js';
import * as expedientesRepo from '../repositories/expedientes.repository.js';
import * as expedientesService from './expedientes.service.js';
import { formatExpedienteNumero } from '../utils/expediente.utils.js';
import { registrarAuditoria } from '../repositories/audit.repository.js';
import { AppError } from '../utils/errors.js';
import { getFondoARendirCuenta } from './configuracion.service.js';
import {
  formatAfectacionNumero,
  getAnioFromFecha,
  calcularImporteTotal,
} from '../utils/afectacion.utils.js';
import type { Afectacion } from '../entities/index.js';

const detalleSchema = z.object({
  cuenta_id: z.number().int().positive(),
  descripcion: z.string().max(255).default(''),
  importe: z.number().positive(),
});

const createAfectacionSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)'),
  expediente_id: z.number().int().positive(),
  destinatario: z.string().min(1).max(500).optional(),
  numero: z.number().int().min(1).max(999999).optional(),
  importe: z.number().positive().optional(),
  observaciones: z.string().max(2000).optional().nullable(),
  numero_comprobante: z.string().max(100).optional().nullable(),
  detalle: z.array(detalleSchema).min(1, 'Debe incluir al menos una cuenta'),
});

const updateAfectacionSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)').optional(),
  destinatario: z.string().min(1).max(500).optional(),
  numero: z.number().int().min(1).max(999999).optional(),
  importe: z.number().positive().optional(),
  observaciones: z.string().max(2000).optional().nullable(),
  numero_comprobante: z.string().max(100).optional().nullable(),
  detalle: z.array(detalleSchema).min(1).optional(),
});

const anularSchema = z.object({
  motivo: z.string().min(5).max(1000),
});

function mapTransactionError(error: unknown): never {
  if (error instanceof Error) {
    if (error.message.startsWith('CUENTA_NOT_FOUND')) {
      throw new AppError(400, 'Una de las cuentas no existe', 'CUENTA_NOT_FOUND');
    }
    if (error.message.startsWith('CUENTA_INACTIVE')) {
      throw new AppError(400, 'Una de las cuentas no está activa', 'CUENTA_INACTIVE');
    }
    if (error.message.startsWith('INSUFFICIENT_BALANCE')) {
      throw new AppError(400, 'Saldo disponible insuficiente en una o más cuentas', 'INSUFFICIENT_BALANCE');
    }
    if (error.message === 'AFECTACION_NOT_FOUND') {
      throw new AppError(404, 'Afectación no encontrada', 'AFECTACION_NOT_FOUND');
    }
    if (error.message === 'ALREADY_ANNULLED') {
      throw new AppError(400, 'La afectación ya está anulada', 'ALREADY_ANNULLED');
    }
    if (error.message === 'EXPEDIENTE_NOT_FOUND') {
      throw new AppError(404, 'Expediente no encontrado', 'EXPEDIENTE_NOT_FOUND');
    }
    if (error.message === 'INVALID_EXPEDIENTE_STATE') {
      throw new AppError(
        400,
        'El expediente no admite nuevas afectaciones en su estado actual',
        'INVALID_EXPEDIENTE_STATE'
      );
    }
    if (error.message === 'IMPORTE_EXCEEDS_EXPEDIENTE') {
      throw new AppError(
        400,
        'El importe supera el saldo disponible del expediente (otro usuario puede haber afectado en paralelo)',
        'IMPORTE_EXCEEDS_EXPEDIENTE'
      );
    }
    if (error.message === 'DUPLICATE_NUMERO') {
      throw new AppError(409, 'Ya existe una afectación con ese número para la fecha', 'DUPLICATE_NUMERO');
    }
  }
  throw error;
}

function mergeDetalleByCuenta(
  detalle: Array<{ cuenta_id: number; descripcion: string; importe: number }>
) {
  const map = new Map<number, { cuenta_id: number; descripcion: string; importe: number }>();
  for (const line of detalle) {
    const existing = map.get(line.cuenta_id);
    if (existing) {
      existing.importe = Number((existing.importe + line.importe).toFixed(2));
      existing.descripcion = `${existing.descripcion} / ${line.descripcion}`;
    } else {
      map.set(line.cuenta_id, { ...line });
    }
  }
  return Array.from(map.values());
}

export async function listAfectaciones(params: {
  page?: number;
  limit?: number;
  search?: string;
  anio?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  anulada?: boolean;
  expedienteId?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}) {
  return afectacionesRepo.findAll({
    page: params.page ?? 1,
    limit: Math.min(params.limit ?? 15, 100),
    search: params.search,
    anio: params.anio,
    fechaDesde: params.fechaDesde,
    fechaHasta: params.fechaHasta,
    anulada: params.anulada,
    expedienteId: params.expedienteId,
    sortBy: params.sortBy ?? 'created_at',
    sortOrder: params.sortOrder ?? 'desc',
  });
}

export async function getAfectacion(id: number) {
  const afectacion = await afectacionesRepo.findById(id, true);
  if (!afectacion) {
    throw new AppError(404, 'Afectación no encontrada', 'AFECTACION_NOT_FOUND');
  }
  return afectacion;
}

export async function getSiguienteNumero(anio?: number) {
  const year = anio ?? new Date().getFullYear();
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new AppError(400, 'Año inválido', 'INVALID_ANIO');
  }
  const siguiente = await afectacionesRepo.getNextNumero(year);
  return {
    anio: year,
    siguiente,
    preview: formatAfectacionNumero(siguiente, year),
  };
}

export async function getExpedientesDisponibles() {
  const result = await query<{
    id: number;
    numero: number;
    anio: number;
    estado: string;
    proveedor_nombre: string;
    detalle: string;
    importe: string;
    importe_afectado: string;
    afectaciones_activas: string;
  }>(
    `SELECT e.id, e.numero, e.anio, e.estado,
            COALESCE(
              (
                SELECT string_agg(px.nombre, ' · ' ORDER BY ep.orden)
                FROM expediente_proveedores ep
                INNER JOIN proveedores px ON px.id = ep.proveedor_id
                WHERE ep.expediente_id = e.id
              ),
              p.nombre
            ) AS proveedor_nombre,
            e.detalle, e.importe::text,
            COALESCE(SUM(a.importe_total) FILTER (WHERE a.anulada = false AND a.deleted_at IS NULL), 0)::text AS importe_afectado,
            COUNT(a.id) FILTER (WHERE a.anulada = false AND a.deleted_at IS NULL)::text AS afectaciones_activas
     FROM expedientes e
     LEFT JOIN proveedores p ON p.id = e.proveedor_id
     LEFT JOIN afectaciones a ON a.expediente_id = e.id AND a.deleted_at IS NULL
     WHERE e.deleted_at IS NULL
       AND e.anulado = false
       AND e.circuito IN ('NORMAL', 'PENDIENTE')
       AND e.estado IN ('INICIADO', 'AFECTADO')
     GROUP BY e.id, e.numero, e.anio, e.estado, p.nombre, e.detalle, e.importe
     HAVING e.estado = 'INICIADO'
        OR (e.importe - COALESCE(SUM(a.importe_total) FILTER (WHERE a.anulada = false AND a.deleted_at IS NULL), 0)) > 0.001
     ORDER BY e.anio DESC, e.numero DESC`
  );

  const ids = result.rows.map((e) => e.id);
  const resumenByExp = new Map<
    number,
    Array<{
      id: number;
      numero_completo: string;
      fecha: string;
      importe_total: number;
      observaciones: string | null;
      numero_comprobante: string | null;
      anulada: boolean;
    }>
  >();

  const proveedoresByExp = new Map<
    number,
    Array<{ id: number; nombre: string; documento: string | null }>
  >();

  if (ids.length > 0) {
    const resumen = await query<{
      id: number;
      expediente_id: number;
      numero: number;
      fecha: string;
      importe_total: string;
      observaciones: string | null;
      numero_comprobante: string | null;
      anulada: boolean;
    }>(
      `SELECT id, expediente_id, numero, fecha::text, importe_total::text, observaciones,
              numero_comprobante, anulada
       FROM afectaciones
       WHERE expediente_id = ANY($1) AND deleted_at IS NULL AND anulada = false
       ORDER BY fecha DESC, numero DESC, id DESC`,
      [ids]
    );
    for (const r of resumen.rows) {
      const list = resumenByExp.get(r.expediente_id) ?? [];
      list.push({
        id: r.id,
        numero_completo: formatAfectacionNumero(r.numero, r.fecha),
        fecha: r.fecha,
        importe_total: parseFloat(r.importe_total),
        observaciones: r.observaciones,
        numero_comprobante: r.numero_comprobante,
        anulada: r.anulada,
      });
      resumenByExp.set(r.expediente_id, list);
    }

    const proveedores = await query<{
      expediente_id: number;
      id: number;
      nombre: string;
      documento: string | null;
    }>(
      `SELECT ep.expediente_id, p.id, p.nombre, p.documento
       FROM expediente_proveedores ep
       INNER JOIN proveedores p ON p.id = ep.proveedor_id
       WHERE ep.expediente_id = ANY($1)
       ORDER BY ep.expediente_id, ep.orden`,
      [ids]
    );
    for (const p of proveedores.rows) {
      const list = proveedoresByExp.get(p.expediente_id) ?? [];
      list.push({ id: p.id, nombre: p.nombre, documento: p.documento });
      proveedoresByExp.set(p.expediente_id, list);
    }
  }

  return result.rows.map((e) => {
    const importe = parseFloat(e.importe);
    const importe_afectado = parseFloat(e.importe_afectado);
    const importe_disponible = Number((importe - importe_afectado).toFixed(2));
    const proveedores = proveedoresByExp.get(e.id) ?? [];
    return {
      id: e.id,
      numero_completo: formatExpedienteNumero(e.numero, e.anio),
      proveedor_nombre: e.proveedor_nombre,
      proveedores,
      detalle: e.detalle,
      importe,
      importe_afectado,
      importe_disponible,
      afectaciones_activas: parseInt(e.afectaciones_activas, 10),
      afectaciones: resumenByExp.get(e.id) ?? [],
    };
  });
}

export async function getCuentasDisponibles(afectacionId?: number) {
  const result = await query<{
    id: number;
    codigo: string;
    descripcion: string;
    saldo_inicial: string;
    saldo_afectado: string;
  }>(
    `SELECT id, codigo, descripcion, saldo_inicial::text, saldo_afectado::text
     FROM cuentas
     WHERE deleted_at IS NULL AND estado = 'ACTIVA'
       AND id <> COALESCE(
         (
           SELECT CASE WHEN valor ~ '^[0-9]+$' THEN valor::integer ELSE 0 END
           FROM configuracion WHERE clave = 'cuenta_fondo_a_rendir_id'
         ),
         0
       )
       AND (
         (saldo_inicial - saldo_afectado) > 0
         OR EXISTS (
           SELECT 1 FROM afectacion_detalle d
           WHERE d.afectacion_id = $1 AND d.cuenta_id = cuentas.id
         )
       )
     ORDER BY codigo`,
    [afectacionId ?? 0]
  );

  let reservedByCuenta = new Map<number, number>();
  if (afectacionId) {
    const reserved = await query<{ cuenta_id: number; importe: string }>(
      `SELECT cuenta_id, SUM(importe)::text AS importe
       FROM afectacion_detalle WHERE afectacion_id = $1
       GROUP BY cuenta_id`,
      [afectacionId]
    );
    reservedByCuenta = new Map(
      reserved.rows.map((r) => [r.cuenta_id, parseFloat(r.importe)])
    );
  }

  return result.rows.map((c) => {
    const base = parseFloat(c.saldo_inicial) - parseFloat(c.saldo_afectado);
    const reserved = reservedByCuenta.get(c.id) ?? 0;
    return {
      id: c.id,
      codigo: c.codigo,
      descripcion: c.descripcion,
      saldo_disponible: Number((base + reserved).toFixed(2)),
    };
  });
}

export async function createAfectacion(
  data: z.infer<typeof createAfectacionSchema>,
  actorId: number,
  ip?: string
) {
  const parsed = createAfectacionSchema.parse(data);
  const anio = getAnioFromFecha(parsed.fecha);

  const expediente = await expedientesRepo.findById(parsed.expediente_id);
  if (!expediente) {
    throw new AppError(404, 'Expediente no encontrado', 'EXPEDIENTE_NOT_FOUND');
  }
  if (expediente.anulado) {
    throw new AppError(400, 'No se puede afectar un expediente anulado', 'EXPEDIENTE_ANULADO');
  }
  await expedientesService.fijarTramiteSiPendiente(expediente, 'NORMAL', actorId);
  if (expediente.circuito === 'CARGO_A_RENDIR') {
    throw new AppError(
      400,
      'Este expediente está definido para anticipo, no para afectación',
      'INVALID_CIRCUITO'
    );
  }
  if (expediente.estado !== 'INICIADO' && expediente.estado !== 'AFECTADO') {
    throw new AppError(
      400,
      'El expediente debe estar en estado Iniciado o Afectado',
      'INVALID_EXPEDIENTE_STATE'
    );
  }

  const detalleMerged = mergeDetalleByCuenta(
    parsed.detalle.map((d) => ({
      cuenta_id: d.cuenta_id,
      descripcion: d.descripcion.trim(),
      importe: d.importe,
    }))
  );

  const fondo = await getFondoARendirCuenta();
  if (fondo && detalleMerged.some((d) => d.cuenta_id === fondo.id)) {
    throw new AppError(
      400,
      'La cuenta Fondo a rendir no se usa en afectaciones. Use Anticipos en Cargos a rendir.',
      'INVALID_CUENTA'
    );
  }

  const importe_total = calcularImporteTotal(detalleMerged);

  if (parsed.importe !== undefined && Math.abs(parsed.importe - importe_total) > 0.001) {
    throw new AppError(
      400,
      `El detalle de cuentas (${importe_total.toFixed(2)}) debe completar el importe de la afectación (${parsed.importe.toFixed(2)})`,
      'IMPORTE_DETALLE_MISMATCH'
    );
  }

  const afectado = await afectacionesRepo.getImporteAfectadoActivo(parsed.expediente_id);
  const disponible = Number((expediente.importe - afectado).toFixed(2));

  if (importe_total > disponible + 0.001) {
    throw new AppError(
      400,
      `El importe (${importe_total.toFixed(2)}) supera el saldo disponible del expediente (${disponible.toFixed(2)})`,
      'IMPORTE_EXCEEDS_EXPEDIENTE'
    );
  }

  if (importe_total <= 0) {
    throw new AppError(400, 'El importe de la afectación debe ser mayor a cero', 'INVALID_IMPORTE');
  }

  const numeroManual = parsed.numero;
  if (numeroManual != null && (await afectacionesRepo.existsByNumeroAnio(numeroManual, anio))) {
    throw new AppError(
      409,
      `Ya existe la afectación ${formatAfectacionNumero(numeroManual, parsed.fecha)}`,
      'DUPLICATE_NUMERO'
    );
  }

  const destinatario = (parsed.destinatario ?? expediente.proveedor_nombre ?? '').trim();
  if (!destinatario) {
    throw new AppError(400, 'Debe indicar el destinatario', 'DESTINATARIO_REQUIRED');
  }

  const observaciones = parsed.observaciones?.trim() || null;
  const numero_comprobante = parsed.numero_comprobante?.trim() || null;

  let afectacionId: number;
  try {
    afectacionId = await afectacionesRepo.create({
      numero: numeroManual,
      anio,
      fecha: parsed.fecha,
      expediente_id: parsed.expediente_id,
      destinatario,
      importe_total,
      observaciones,
      numero_comprobante,
      usuario_creacion_id: actorId,
      estado_anterior: expediente.estado,
      detalle: detalleMerged,
    });
  } catch (error) {
    mapTransactionError(error);
  }

  const afectacion = await afectacionesRepo.findById(afectacionId!, true);

  await registrarAuditoria({
    usuario_id: actorId,
    accion: 'CREATE',
    entidad: 'afectaciones',
    entidad_id: afectacionId!,
    cambios: {
      numero_completo: formatAfectacionNumero(afectacion!.numero, parsed.fecha),
      expediente_id: parsed.expediente_id,
      importe_total,
      observaciones,
      numero_comprobante,
      cuentas: detalleMerged.length,
    },
    ip,
  });

  return afectacion!;
}

export async function updateAfectacion(
  id: number,
  data: z.infer<typeof updateAfectacionSchema>,
  actorId: number,
  ip?: string
) {
  const parsed = updateAfectacionSchema.parse(data);
  const existing = await getAfectacion(id);

  if (existing.anulada) {
    throw new AppError(400, 'No se puede editar una afectación anulada', 'ALREADY_ANNULLED');
  }

  const hasLibramiento = await afectacionesRepo.hasActiveLibramiento(id);
  if (hasLibramiento && parsed.detalle) {
    throw new AppError(
      400,
      'No se puede modificar el detalle: la afectación ya tiene un libramiento activo',
      'HAS_LIBRAMIENTO'
    );
  }

  const fecha = parsed.fecha ?? existing.fecha;
  const destinatario = (parsed.destinatario ?? existing.destinatario).trim();
  const anio = getAnioFromFecha(fecha);
  const observaciones =
    parsed.observaciones !== undefined
      ? parsed.observaciones?.trim() || null
      : existing.observaciones;
  const numero_comprobante =
    parsed.numero_comprobante !== undefined
      ? parsed.numero_comprobante?.trim() || null
      : existing.numero_comprobante;

  let detalleMerged: Array<{ cuenta_id: number; descripcion: string; importe: number }> | undefined;
  let importe_total = existing.importe_total;

  if (parsed.detalle) {
    detalleMerged = mergeDetalleByCuenta(
      parsed.detalle.map((d) => ({
        cuenta_id: d.cuenta_id,
        descripcion: d.descripcion.trim(),
        importe: d.importe,
      }))
    );
    importe_total = calcularImporteTotal(detalleMerged);
  }

  if (parsed.importe !== undefined && Math.abs(parsed.importe - importe_total) > 0.001) {
    throw new AppError(
      400,
      `El detalle de cuentas (${importe_total.toFixed(2)}) debe completar el importe de la afectación (${parsed.importe.toFixed(2)})`,
      'IMPORTE_DETALLE_MISMATCH'
    );
  }

  const expediente = await expedientesRepo.findById(existing.expediente_id);
  if (!expediente) {
    throw new AppError(404, 'Expediente no encontrado', 'EXPEDIENTE_NOT_FOUND');
  }

  const afectadoOtros = await afectacionesRepo.getImporteAfectadoActivo(existing.expediente_id, id);
  const disponible = Number((expediente.importe - afectadoOtros).toFixed(2));

  if (importe_total > disponible + 0.001) {
    throw new AppError(
      400,
      `El importe (${importe_total.toFixed(2)}) supera el saldo disponible del expediente (${disponible.toFixed(2)})`,
      'IMPORTE_EXCEEDS_EXPEDIENTE'
    );
  }

  let numero = existing.numero;
  if (parsed.numero !== undefined) {
    numero = parsed.numero;
  } else if (anio !== existing.anio) {
    numero = await afectacionesRepo.getNextNumero(anio);
  }

  if (await afectacionesRepo.existsByNumeroAnio(numero, anio, id)) {
    throw new AppError(
      409,
      `Ya existe la afectación ${formatAfectacionNumero(numero, fecha)}`,
      'DUPLICATE_NUMERO'
    );
  }

  try {
    await afectacionesRepo.update(id, {
      numero,
      anio,
      fecha,
      destinatario,
      importe_total,
      observaciones,
      numero_comprobante,
      usuario_id: actorId,
      detalle: detalleMerged,
    });
  } catch (error) {
    mapTransactionError(error);
  }

  await registrarAuditoria({
    usuario_id: actorId,
    accion: 'UPDATE',
    entidad: 'afectaciones',
    entidad_id: id,
    cambios: {
      numero_completo: formatAfectacionNumero(numero, fecha),
      fecha,
      destinatario,
      importe_total,
      observaciones,
      numero_comprobante,
    },
    ip,
  });

  return afectacionesRepo.findById(id, true);
}

export async function anularAfectacion(
  id: number,
  data: z.infer<typeof anularSchema>,
  actorId: number,
  ip?: string
) {
  const parsed = anularSchema.parse(data);
  const existing = await getAfectacion(id);

  if (existing.anulada) {
    throw new AppError(400, 'La afectación ya está anulada', 'ALREADY_ANNULLED');
  }

  try {
    await afectacionesRepo.anular(id, parsed.motivo.trim(), actorId);
  } catch (error) {
    mapTransactionError(error);
  }

  await registrarAuditoria({
    usuario_id: actorId,
    accion: 'ANULAR',
    entidad: 'afectaciones',
    entidad_id: id,
    cambios: { motivo: parsed.motivo, importe_total: existing.importe_total },
    ip,
  });

  return afectacionesRepo.findById(id, true);
}

export async function exportAfectaciones(filters: {
  search?: string;
  anio?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  anulada?: boolean;
}) {
  return afectacionesRepo.findAllForExport(filters);
}

export function afectacionesToCsv(afectaciones: Afectacion[]): string {
  const headers = [
    'Número',
    'Fecha',
    'Expediente',
    'Destinatario',
    'Importe total',
    'Comprobante',
    'Observaciones',
    'Anulada',
  ];

  const rows = afectaciones.map((a) => [
    a.numero_completo,
    a.fecha,
    a.expediente_numero ?? a.expediente_id,
    `"${a.destinatario.replace(/"/g, '""')}"`,
    a.importe_total.toFixed(2),
    a.numero_comprobante ?? '',
    `"${(a.observaciones ?? '').replace(/"/g, '""')}"`,
    a.anulada ? 'Sí' : 'No',
  ]);

  return [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
}

export async function getResumen() {
  return afectacionesRepo.getResumenTotales();
}
