import { z } from 'zod';
import { query } from '../database/pool.js';
import * as anticiposRepo from '../repositories/anticipos.repository.js';
import * as expedientesRepo from '../repositories/expedientes.repository.js';
import * as expedientesService from './expedientes.service.js';
import { registrarAuditoria } from '../repositories/audit.repository.js';
import { AppError } from '../utils/errors.js';
import { formatAnticipoNumero, getAnioFromFecha } from '../utils/anticipo.utils.js';
import { formatExpedienteNumero } from '../utils/expediente.utils.js';
import { getFondoARendirCuenta } from './configuracion.service.js';
import type { Anticipo } from '../entities/index.js';

const createSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expediente_id: z.number().int().positive(),
  destinatario: z.string().min(1).max(500).optional(),
  numero: z.number().int().min(1).max(999999).optional(),
  importe: z.number().positive(),
  observaciones: z.string().max(2000).optional().nullable(),
  numero_comprobante: z.string().max(100).optional().nullable(),
});

const anularSchema = z.object({
  motivo: z.string().min(5).max(1000),
});

function mapTransactionError(error: unknown): never {
  if (error instanceof Error) {
    if (error.message.startsWith('CUENTA_NOT_FOUND')) {
      throw new AppError(400, 'La cuenta Fondo a rendir no existe', 'CUENTA_NOT_FOUND');
    }
    if (error.message.startsWith('CUENTA_INACTIVE')) {
      throw new AppError(400, 'La cuenta Fondo a rendir no está activa', 'CUENTA_INACTIVE');
    }
    if (error.message.startsWith('INSUFFICIENT_BALANCE')) {
      throw new AppError(400, 'Saldo insuficiente en Fondo a rendir', 'INSUFFICIENT_BALANCE');
    }
    const map: Record<string, [number, string, string]> = {
      EXPEDIENTE_NOT_FOUND: [404, 'Expediente no encontrado', 'EXPEDIENTE_NOT_FOUND'],
      INVALID_CIRCUITO: [400, 'El expediente no es de cargo a rendir', 'INVALID_CIRCUITO'],
      INVALID_EXPEDIENTE_STATE: [
        400,
        'El expediente no admite nuevos anticipos en su estado actual',
        'INVALID_EXPEDIENTE_STATE',
      ],
      IMPORTE_EXCEEDS_EXPEDIENTE: [
        400,
        'El importe supera el saldo disponible del expediente',
        'IMPORTE_EXCEEDS_EXPEDIENTE',
      ],
      DUPLICATE_NUMERO: [409, 'Ya existe un anticipo con ese número para la fecha', 'DUPLICATE_NUMERO'],
      ANTICIPO_NOT_FOUND: [404, 'Anticipo no encontrado', 'ANTICIPO_NOT_FOUND'],
      ALREADY_ANNULLED: [400, 'El anticipo ya está anulado', 'ALREADY_ANNULLED'],
      HAS_LIBRAMIENTO: [
        400,
        'No se puede anular un anticipo con libramiento vigente. Anule el libramiento primero.',
        'HAS_LIBRAMIENTO',
      ],
    };
    const mapped = map[error.message];
    if (mapped) throw new AppError(mapped[0], mapped[1], mapped[2]);
  }
  throw error;
}

export async function listAnticipos(params: {
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
  return anticiposRepo.findAll({
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

export async function getAnticipo(id: number) {
  const anticipo = await anticiposRepo.findById(id);
  if (!anticipo) throw new AppError(404, 'Anticipo no encontrado', 'ANTICIPO_NOT_FOUND');
  return anticipo;
}

export async function getSiguienteNumero(anio?: number) {
  const year = anio ?? new Date().getFullYear();
  const siguiente = await anticiposRepo.getNextNumero(year);
  return { anio: year, siguiente, preview: formatAnticipoNumero(siguiente, year) };
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
    importe_anticipado: string;
    anticipos_activos: string;
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
            COALESCE(SUM(a.importe) FILTER (WHERE a.anulada = false AND a.deleted_at IS NULL), 0)::text AS importe_anticipado,
            COUNT(a.id) FILTER (WHERE a.anulada = false AND a.deleted_at IS NULL)::text AS anticipos_activos
     FROM expedientes e
     LEFT JOIN proveedores p ON p.id = e.proveedor_id
     LEFT JOIN anticipos a ON a.expediente_id = e.id AND a.deleted_at IS NULL
     WHERE e.deleted_at IS NULL AND e.anulado = false
       AND e.circuito IN ('CARGO_A_RENDIR', 'PENDIENTE')
       AND e.estado IN ('INICIADO', 'AFECTADO')
     GROUP BY e.id, e.numero, e.anio, e.estado, p.nombre, e.detalle, e.importe
     HAVING e.estado = 'INICIADO'
        OR (e.importe - COALESCE(SUM(a.importe) FILTER (WHERE a.anulada = false AND a.deleted_at IS NULL), 0)) > 0.001
     ORDER BY e.anio DESC, e.numero DESC`
  );

  const ids = result.rows.map((e) => e.id);
  const proveedoresByExp = new Map<
    number,
    Array<{ id: number; nombre: string; documento: string | null }>
  >();
  if (ids.length > 0) {
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
    for (const r of proveedores.rows) {
      const list = proveedoresByExp.get(r.expediente_id) ?? [];
      list.push({ id: r.id, nombre: r.nombre, documento: r.documento });
      proveedoresByExp.set(r.expediente_id, list);
    }
  }

  return result.rows.map((e) => {
    const importe = parseFloat(e.importe);
    const anticipado = parseFloat(e.importe_anticipado);
    return {
      id: e.id,
      numero_completo: formatExpedienteNumero(e.numero, e.anio),
      proveedor_nombre: e.proveedor_nombre,
      proveedores: proveedoresByExp.get(e.id) ?? [],
      detalle: e.detalle,
      importe,
      importe_anticipado: anticipado,
      importe_disponible: Number((importe - anticipado).toFixed(2)),
      anticipos_activos: parseInt(e.anticipos_activos, 10),
    };
  });
}

export async function createAnticipo(
  data: z.infer<typeof createSchema>,
  actorId: number,
  ip?: string
) {
  const parsed = createSchema.parse(data);
  const anio = getAnioFromFecha(parsed.fecha);
  const fondo = await getFondoARendirCuenta();
  if (!fondo) {
    throw new AppError(
      400,
      'Configure la cuenta Fondo a rendir en Configuración antes de registrar un anticipo',
      'FONDO_A_RENDIR_NOT_CONFIGURED'
    );
  }

  const expediente = await expedientesRepo.findById(parsed.expediente_id);
  if (!expediente || expediente.anulado) {
    throw new AppError(404, 'Expediente no encontrado', 'EXPEDIENTE_NOT_FOUND');
  }
  await expedientesService.fijarTramiteSiPendiente(expediente, 'CARGO_A_RENDIR', actorId);
  if (expediente.circuito === 'NORMAL') {
    throw new AppError(
      400,
      'Este expediente está definido para afectación, no para anticipo',
      'INVALID_CIRCUITO'
    );
  }

  const destinatario = (parsed.destinatario ?? expediente.proveedor_nombre ?? '').trim();
  if (!destinatario) {
    throw new AppError(400, 'Debe indicar el destinatario', 'DESTINATARIO_REQUIRED');
  }

  const numeroManual = parsed.numero;
  if (numeroManual != null && (await anticiposRepo.existsByNumeroAnio(numeroManual, anio))) {
    throw new AppError(
      409,
      `Ya existe el anticipo ${formatAnticipoNumero(numeroManual, parsed.fecha)}`,
      'DUPLICATE_NUMERO'
    );
  }

  let anticipoId: number;
  try {
    anticipoId = await anticiposRepo.create({
      numero: numeroManual,
      anio,
      fecha: parsed.fecha,
      expediente_id: parsed.expediente_id,
      cuenta_id: fondo.id,
      destinatario,
      importe: parsed.importe,
      observaciones: parsed.observaciones?.trim() || null,
      numero_comprobante: parsed.numero_comprobante?.trim() || null,
      usuario_creacion_id: actorId,
    });
  } catch (error) {
    mapTransactionError(error);
  }

  const anticipo = await anticiposRepo.findById(anticipoId!);
  await registrarAuditoria({
    usuario_id: actorId,
    accion: 'CREATE',
    entidad: 'anticipos',
    entidad_id: anticipoId!,
    cambios: {
      numero_completo: formatAnticipoNumero(anticipo!.numero, parsed.fecha),
      expediente_id: parsed.expediente_id,
      importe: parsed.importe,
    },
    ip,
  });
  return anticipo!;
}

export async function anularAnticipo(
  id: number,
  data: z.infer<typeof anularSchema>,
  actorId: number,
  ip?: string
) {
  const parsed = anularSchema.parse(data);
  const existing = await getAnticipo(id);
  if (existing.anulada) {
    throw new AppError(400, 'El anticipo ya está anulado', 'ALREADY_ANNULLED');
  }
  try {
    await anticiposRepo.anular(id, parsed.motivo.trim(), actorId);
  } catch (error) {
    mapTransactionError(error);
  }
  await registrarAuditoria({
    usuario_id: actorId,
    accion: 'ANULAR',
    entidad: 'anticipos',
    entidad_id: id,
    cambios: { motivo: parsed.motivo, importe: existing.importe },
    ip,
  });
  return anticiposRepo.findById(id);
}

export async function exportAnticipos(filters: {
  search?: string;
  anio?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  anulada?: boolean;
  expedienteId?: number;
}) {
  return anticiposRepo.findAllForExport(filters);
}

export function anticiposToCsv(anticipos: Anticipo[]): string {
  const headers = [
    'Número', 'Fecha', 'Expediente', 'Destinatario', 'Importe', 'Cuenta', 'Comprobante', 'Observaciones', 'Anulado',
  ];
  const rows = anticipos.map((a) => [
    a.numero_completo,
    a.fecha,
    a.expediente_numero ?? a.expediente_id,
    `"${a.destinatario.replace(/"/g, '""')}"`,
    a.importe.toFixed(2),
    a.cuenta_codigo ?? '',
    a.numero_comprobante ?? '',
    `"${(a.observaciones ?? '').replace(/"/g, '""')}"`,
    a.anulada ? 'Sí' : 'No',
  ]);
  return [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
}

export async function getResumen() {
  return anticiposRepo.getResumenTotales();
}
