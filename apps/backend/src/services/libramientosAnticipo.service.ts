import { z } from 'zod';
import { query } from '../database/pool.js';
import * as libAntRepo from '../repositories/libramientosAnticipo.repository.js';
import * as anticiposRepo from '../repositories/anticipos.repository.js';
import * as expedientesRepo from '../repositories/expedientes.repository.js';
import { registrarAuditoria } from '../repositories/audit.repository.js';
import { AppError } from '../utils/errors.js';
import { formatLibramientoNumero, getAnioFromFecha, calcularNeto } from '../utils/libramiento.utils.js';
import { formatAnticipoNumero } from '../utils/anticipo.utils.js';
import { formatExpedienteNumero } from '../utils/expediente.utils.js';
import type { LibramientoAnticipo } from '../entities/index.js';

const createSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expediente_id: z.number().int().positive(),
  anticipo_id: z.number().int().positive(),
  beneficiario: z.string().min(1).max(500).optional(),
  numero: z.number().int().min(1).max(999999).optional(),
  importe: z.number().positive().optional(),
  retenciones: z.number().min(0).optional(),
  numero_decreto: z.string().max(80).optional().nullable(),
  observaciones: z.string().max(2000).optional().nullable(),
});

const anularSchema = z.object({
  motivo: z.string().min(5).max(1000),
});

function mapTransactionError(error: unknown): never {
  if (error instanceof Error) {
    const map: Record<string, [number, string, string]> = {
      ANTICIPO_NOT_FOUND: [404, 'Anticipo no encontrado', 'ANTICIPO_NOT_FOUND'],
      ANTICIPO_ANNULLED: [400, 'El anticipo está anulado', 'ANTICIPO_ANNULLED'],
      ANTICIPO_EXPEDIENTE_MISMATCH: [400, 'El anticipo no corresponde al expediente', 'ANTICIPO_EXPEDIENTE_MISMATCH'],
      ANTICIPO_YA_LIBRADO: [409, 'El anticipo ya tiene un libramiento activo', 'ANTICIPO_YA_LIBRADO'],
      EXPEDIENTE_NOT_FOUND: [404, 'Expediente no encontrado', 'EXPEDIENTE_NOT_FOUND'],
      INVALID_CIRCUITO: [400, 'El expediente no es de cargo a rendir', 'INVALID_CIRCUITO'],
      INVALID_EXPEDIENTE_STATE: [400, 'El expediente debe estar anticipado para librar', 'INVALID_EXPEDIENTE_STATE'],
      IMPORTE_EXCEEDS_ANTICIPO: [400, 'El importe supera el del anticipo', 'IMPORTE_EXCEEDS_ANTICIPO'],
      DUPLICATE_NUMERO: [409, 'Ya existe un libramiento de anticipo con ese número para la fecha', 'DUPLICATE_NUMERO'],
      LIBRAMIENTO_NOT_FOUND: [404, 'Libramiento de anticipo no encontrado', 'LIBRAMIENTO_NOT_FOUND'],
      ALREADY_ANNULLED: [400, 'El libramiento ya está anulado', 'ALREADY_ANNULLED'],
      HAS_PAYMENTS: [400, 'No se puede anular un libramiento de anticipo con pagos', 'HAS_PAYMENTS'],
    };
    const mapped = map[error.message];
    if (mapped) throw new AppError(mapped[0], mapped[1], mapped[2]);
  }
  throw error;
}

export async function listLibramientosAnticipo(params: {
  page?: number;
  limit?: number;
  search?: string;
  anio?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  anulado?: boolean;
  expedienteId?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}) {
  return libAntRepo.findAll({
    page: params.page ?? 1,
    limit: Math.min(params.limit ?? 15, 100),
    search: params.search,
    anio: params.anio,
    fechaDesde: params.fechaDesde,
    fechaHasta: params.fechaHasta,
    anulado: params.anulado,
    expedienteId: params.expedienteId,
    sortBy: params.sortBy ?? 'created_at',
    sortOrder: params.sortOrder ?? 'desc',
  });
}

export async function getLibramientoAnticipo(id: number) {
  const lib = await libAntRepo.findById(id);
  if (!lib) throw new AppError(404, 'Libramiento de anticipo no encontrado', 'LIBRAMIENTO_NOT_FOUND');
  return lib;
}

export async function getSiguienteNumero(anio?: number) {
  const year = anio ?? new Date().getFullYear();
  const siguiente = await libAntRepo.getNextNumero(year);
  return { anio: year, siguiente, preview: formatLibramientoNumero(siguiente, year) };
}

export async function getAnticiposDisponibles() {
  const result = await query<{
    id: number;
    numero: number;
    fecha: string;
    expediente_id: number;
    expediente_numero: string;
    destinatario: string;
    importe: string;
  }>(
    `SELECT a.id, a.numero, a.fecha::text, a.expediente_id,
            CONCAT(e.numero, '/', e.anio) AS expediente_numero,
            a.destinatario, a.importe::text
     FROM anticipos a
     INNER JOIN expedientes e ON e.id = a.expediente_id
     WHERE a.deleted_at IS NULL AND a.anulada = false
       AND COALESCE(e.circuito, 'NORMAL') = 'CARGO_A_RENDIR'
       AND e.deleted_at IS NULL AND e.anulado = false AND e.estado = 'AFECTADO'
       AND NOT EXISTS (
         SELECT 1 FROM libramientos_anticipo l
         WHERE l.anticipo_id = a.id AND l.deleted_at IS NULL AND l.anulado = false
       )
     ORDER BY a.fecha DESC, a.numero DESC`
  );

  return result.rows.map((r) => ({
    id: r.id,
    numero_completo: formatAnticipoNumero(r.numero, r.fecha),
    fecha: r.fecha,
    expediente_id: r.expediente_id,
    expediente_numero: r.expediente_numero,
    destinatario: r.destinatario,
    importe: parseFloat(r.importe),
  }));
}

export async function getExpedientesDisponibles() {
  const anticipos = await getAnticiposDisponibles();
  const byExp = new Map<
    number,
    {
      id: number;
      numero_completo: string;
      anticipos: typeof anticipos;
    }
  >();
  for (const a of anticipos) {
    const existing = byExp.get(a.expediente_id);
    if (existing) existing.anticipos.push(a);
    else {
      byExp.set(a.expediente_id, {
        id: a.expediente_id,
        numero_completo: a.expediente_numero,
        anticipos: [a],
      });
    }
  }
  return Array.from(byExp.values());
}

export async function getAnticipoParaLibramiento(anticipoId: number) {
  const anticipo = await anticiposRepo.findById(anticipoId);
  if (!anticipo || anticipo.anulada) {
    throw new AppError(404, 'Anticipo no encontrado', 'ANTICIPO_NOT_FOUND');
  }
  const expediente = await expedientesRepo.findById(anticipo.expediente_id);
  if (!expediente || expediente.circuito !== 'CARGO_A_RENDIR') {
    throw new AppError(400, 'El expediente no es de cargo a rendir', 'INVALID_CIRCUITO');
  }
  if (await anticiposRepo.hasActiveLibramiento(anticipoId)) {
    throw new AppError(409, 'El anticipo ya tiene un libramiento activo', 'ANTICIPO_YA_LIBRADO');
  }
  return anticipo;
}

export async function createLibramientoAnticipo(
  data: z.infer<typeof createSchema>,
  actorId: number,
  ip?: string
) {
  const parsed = createSchema.parse(data);
  const anio = getAnioFromFecha(parsed.fecha);
  const anticipo = await getAnticipoParaLibramiento(parsed.anticipo_id);

  if (anticipo.expediente_id !== parsed.expediente_id) {
    throw new AppError(400, 'El anticipo no corresponde al expediente', 'ANTICIPO_EXPEDIENTE_MISMATCH');
  }

  const expediente = await expedientesRepo.findById(parsed.expediente_id);
  const beneficiario = (parsed.beneficiario ?? anticipo.destinatario ?? expediente?.proveedor_nombre ?? '').trim();
  if (!beneficiario) {
    throw new AppError(400, 'Debe indicar el beneficiario', 'BENEFICIARIO_REQUIRED');
  }

  const importe = parsed.importe ?? anticipo.importe;
  const retenciones = parsed.retenciones ?? 0;
  const neto = calcularNeto(importe, retenciones);
  if (retenciones > importe) {
    throw new AppError(400, 'Las retenciones no pueden superar el importe', 'RETENCIONES_INVALID');
  }

  const numeroManual = parsed.numero;
  if (numeroManual != null && (await libAntRepo.existsByNumeroAnio(numeroManual, anio))) {
    throw new AppError(
      409,
      `Ya existe el libramiento ${formatLibramientoNumero(numeroManual, parsed.fecha)}`,
      'DUPLICATE_NUMERO'
    );
  }

  let libId: number;
  try {
    libId = await libAntRepo.create({
      numero: numeroManual,
      anio,
      fecha: parsed.fecha,
      expediente_id: parsed.expediente_id,
      anticipo_id: parsed.anticipo_id,
      beneficiario,
      importe,
      retenciones,
      neto,
      numero_decreto: parsed.numero_decreto?.trim() || null,
      observaciones: parsed.observaciones?.trim() || null,
      usuario_creacion_id: actorId,
    });
  } catch (error) {
    mapTransactionError(error);
  }

  const lib = await libAntRepo.findById(libId!);
  await registrarAuditoria({
    usuario_id: actorId,
    accion: 'CREATE',
    entidad: 'libramientos_anticipo',
    entidad_id: libId!,
    cambios: { numero_completo: lib!.numero_completo, anticipo_id: parsed.anticipo_id, neto },
    ip,
  });
  return lib!;
}

export async function anularLibramientoAnticipo(
  id: number,
  data: z.infer<typeof anularSchema>,
  actorId: number,
  ip?: string
) {
  const parsed = anularSchema.parse(data);
  const existing = await getLibramientoAnticipo(id);
  if (existing.anulado) {
    throw new AppError(400, 'El libramiento ya está anulado', 'ALREADY_ANNULLED');
  }
  try {
    await libAntRepo.anular(id, parsed.motivo.trim(), actorId);
  } catch (error) {
    mapTransactionError(error);
  }
  await registrarAuditoria({
    usuario_id: actorId,
    accion: 'ANULAR',
    entidad: 'libramientos_anticipo',
    entidad_id: id,
    cambios: { motivo: parsed.motivo, neto: existing.neto },
    ip,
  });
  return libAntRepo.findById(id);
}

export async function exportLibramientosAnticipo(filters: {
  search?: string;
  anio?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  anulado?: boolean;
  expedienteId?: number;
}) {
  return libAntRepo.findAllForExport(filters);
}

export function libramientosAnticipoToCsv(items: LibramientoAnticipo[]): string {
  const headers = [
    'Número', 'Fecha', 'Expediente', 'Anticipo', 'Beneficiario', 'Importe', 'Retenciones', 'Neto', 'Anulado',
  ];
  const rows = items.map((l) => [
    l.numero_completo,
    l.fecha,
    l.expediente_numero ?? l.expediente_id,
    l.anticipo_numero ?? l.anticipo_id,
    `"${l.beneficiario.replace(/"/g, '""')}"`,
    l.importe.toFixed(2),
    l.retenciones.toFixed(2),
    l.neto.toFixed(2),
    l.anulado ? 'Sí' : 'No',
  ]);
  return [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
}

export async function getResumen() {
  return libAntRepo.getResumenTotales();
}

export { formatExpedienteNumero };
