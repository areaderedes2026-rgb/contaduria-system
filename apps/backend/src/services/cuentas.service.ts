import { z } from 'zod';
import * as cuentasRepo from '../repositories/cuentas.repository.js';
import { registrarAuditoria } from '../repositories/audit.repository.js';
import { AppError } from '../utils/errors.js';
import {
  TIPOS_CUENTA,
  ESTADOS_CUENTA,
  getNivelFromCodigo,
  isValidCodigoFormat,
  isValidCodigoHierarchy,
  calcularSaldoDisponible,
} from '../utils/cuenta.utils.js';
import type { Cuenta, CuentaTreeNode } from '../entities/index.js';

const createCuentaSchema = z.object({
  codigo: z.string().min(1).max(50),
  descripcion: z.string().min(1).max(255),
  tipo: z.enum(TIPOS_CUENTA),
  cuenta_padre_id: z.number().int().positive().nullable().optional(),
  saldo_inicial: z.number().min(0).default(0),
});

const updateCuentaSchema = z.object({
  codigo: z.string().min(1).max(50).optional(),
  descripcion: z.string().min(1).max(255).optional(),
  tipo: z.enum(TIPOS_CUENTA).optional(),
  cuenta_padre_id: z.number().int().positive().nullable().optional(),
  saldo_inicial: z.number().min(0).optional(),
  estado: z.enum(ESTADOS_CUENTA).optional(),
});

async function validatePadre(cuentaPadreId: number | null | undefined, codigo: string) {
  if (!cuentaPadreId) return null;

  const padre = await cuentasRepo.findById(cuentaPadreId);
  if (!padre) {
    throw new AppError(400, 'La cuenta padre no existe', 'PARENT_NOT_FOUND');
  }
  if (padre.estado !== 'ACTIVA') {
    throw new AppError(400, 'La cuenta padre debe estar activa', 'PARENT_INACTIVE');
  }
  if (!isValidCodigoHierarchy(codigo, padre.codigo)) {
    throw new AppError(
      400,
      `El código debe ser jerárquico respecto al padre (${padre.codigo})`,
      'INVALID_HIERARCHY'
    );
  }
  return padre;
}

function validateSaldoNoNegativo(saldoInicial: number, saldoAfectado: number) {
  const disponible = calcularSaldoDisponible(saldoInicial, saldoAfectado);
  if (disponible < 0) {
    throw new AppError(
      400,
      'El saldo inicial no puede ser menor al saldo afectado',
      'NEGATIVE_BALANCE'
    );
  }
}

export async function listCuentas(params: {
  page?: number;
  limit?: number;
  search?: string;
  codigoExacto?: string;
  tipo?: string;
  estado?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}) {
  return cuentasRepo.findAll({
    page: params.page ?? 1,
    limit: Math.min(params.limit ?? 15, 100),
    search: params.search,
    codigoExacto: params.codigoExacto,
    tipo: params.tipo,
    estado: params.estado,
    sortBy: params.sortBy ?? 'codigo',
    sortOrder: params.sortOrder ?? 'asc',
  });
}

export async function getCuenta(id: number) {
  const cuenta = await cuentasRepo.findById(id);
  if (!cuenta) {
    throw new AppError(404, 'Cuenta no encontrada', 'CUENTA_NOT_FOUND');
  }
  return cuenta;
}

export function buildTree(cuentas: Cuenta[]): CuentaTreeNode[] {
  const map = new Map<number, CuentaTreeNode>();
  const roots: CuentaTreeNode[] = [];

  for (const cuenta of cuentas) {
    map.set(cuenta.id, { ...cuenta, hijos: [] });
  }

  for (const cuenta of cuentas) {
    const node = map.get(cuenta.id)!;
    if (cuenta.cuenta_padre_id && map.has(cuenta.cuenta_padre_id)) {
      map.get(cuenta.cuenta_padre_id)!.hijos.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export async function getArbol(filters?: { tipo?: string; estado?: string }) {
  const cuentas = await cuentasRepo.findAllForExport({
    tipo: filters?.tipo,
    estado: filters?.estado,
  });
  return buildTree(cuentas);
}

export async function getPadresOptions() {
  const cuentas = await cuentasRepo.findAllFlat();
  return cuentas
    .filter((c) => c.estado === 'ACTIVA')
    .map((c) => ({
      id: c.id,
      codigo: c.codigo,
      descripcion: c.descripcion,
      nivel: c.nivel,
    }));
}

export async function createCuenta(
  data: z.infer<typeof createCuentaSchema>,
  actorId: number,
  ip?: string
) {
  const parsed = createCuentaSchema.parse(data);

  if (!isValidCodigoFormat(parsed.codigo)) {
    throw new AppError(
      400,
      'Formato de código inválido. Use segmentos numéricos separados por punto (ej: 1.1.01.12)',
      'INVALID_CODE_FORMAT'
    );
  }

  if (await cuentasRepo.codigoExists(parsed.codigo)) {
    throw new AppError(409, 'El código de cuenta ya existe', 'CODE_EXISTS');
  }

  const padre = await validatePadre(parsed.cuenta_padre_id ?? null, parsed.codigo);
  const nivel = getNivelFromCodigo(parsed.codigo);

  if (padre && nivel !== padre.nivel + 1) {
    throw new AppError(
      400,
      'El nivel del código no coincide con la jerarquía del padre',
      'INVALID_LEVEL'
    );
  }

  if (!padre && nivel !== 1) {
    throw new AppError(
      400,
      'Las cuentas de nivel superior no requieren padre, o debe indicar cuenta padre',
      'MISSING_PARENT'
    );
  }

  validateSaldoNoNegativo(parsed.saldo_inicial, 0);

  const cuenta = await cuentasRepo.create({
    codigo: parsed.codigo,
    descripcion: parsed.descripcion,
    tipo: parsed.tipo,
    cuenta_padre_id: parsed.cuenta_padre_id ?? null,
    nivel,
    saldo_inicial: parsed.saldo_inicial,
  });

  await cuentasRepo.insertHistorial({
    cuenta_id: cuenta.id,
    accion: 'ALTA',
    observacion: `Cuenta ${cuenta.codigo} creada`,
    usuario_id: actorId,
  });

  await registrarAuditoria({
    usuario_id: actorId,
    accion: 'CREATE',
    entidad: 'cuentas',
    entidad_id: cuenta.id,
    cambios: { codigo: cuenta.codigo, tipo: cuenta.tipo, saldo_inicial: cuenta.saldo_inicial },
    ip,
  });

  return cuenta;
}

export async function updateCuenta(
  id: number,
  data: z.infer<typeof updateCuentaSchema>,
  actorId: number,
  ip?: string
) {
  const parsed = updateCuentaSchema.parse(data);

  const existing = await cuentasRepo.findById(id);
  if (!existing) {
    throw new AppError(404, 'Cuenta no encontrada', 'CUENTA_NOT_FOUND');
  }

  const newCodigo = parsed.codigo ?? existing.codigo;
  const newSaldoInicial = parsed.saldo_inicial ?? existing.saldo_inicial;
  const newPadreId = parsed.cuenta_padre_id !== undefined
    ? parsed.cuenta_padre_id
    : existing.cuenta_padre_id;

  if (parsed.codigo && parsed.codigo !== existing.codigo) {
    const tieneHijos = await cuentasRepo.hasChildren(id);
    if (tieneHijos) {
      throw new AppError(
        400,
        'No se puede cambiar el código de una cuenta con subcuentas',
        'HAS_CHILDREN'
      );
    }
    if (!isValidCodigoFormat(newCodigo)) {
      throw new AppError(400, 'Formato de código inválido', 'INVALID_CODE_FORMAT');
    }
    if (await cuentasRepo.codigoExists(newCodigo, id)) {
      throw new AppError(409, 'El código de cuenta ya existe', 'CODE_EXISTS');
    }
  }

  if (parsed.cuenta_padre_id !== undefined || parsed.codigo) {
    if (newPadreId === id) {
      throw new AppError(400, 'Una cuenta no puede ser padre de sí misma', 'SELF_PARENT');
    }
    await validatePadre(newPadreId, newCodigo);
  }

  validateSaldoNoNegativo(newSaldoInicial, existing.saldo_afectado);

  if (parsed.estado === 'INACTIVA' && existing.saldo_afectado > 0) {
    throw new AppError(
      400,
      'No se puede inactivar una cuenta con saldo afectado',
      'HAS_AFFECTED_BALANCE'
    );
  }

  if (parsed.estado === 'INACTIVA') {
    const { getFondoARendirCuenta } = await import('./configuracion.service.js');
    const fondo = await getFondoARendirCuenta();
    if (fondo && fondo.id === id) {
      throw new AppError(
        400,
        'No se puede inactivar la cuenta configurada como Fondo a rendir',
        'FONDO_A_RENDIR_CUENTA'
      );
    }
  }

  const nivel = getNivelFromCodigo(newCodigo);

  const cuenta = await cuentasRepo.update(id, {
    ...parsed,
    codigo: parsed.codigo,
    cuenta_padre_id: parsed.cuenta_padre_id !== undefined ? parsed.cuenta_padre_id : undefined,
    nivel: parsed.codigo || parsed.cuenta_padre_id !== undefined ? nivel : undefined,
  });

  const trackFields: Array<{
    key: keyof typeof parsed;
    label: string;
    format?: (v: unknown) => string;
  }> = [
    { key: 'codigo', label: 'codigo' },
    { key: 'descripcion', label: 'descripcion' },
    { key: 'tipo', label: 'tipo' },
    { key: 'estado', label: 'estado' },
    {
      key: 'saldo_inicial',
      label: 'saldo_inicial',
      format: (v) => Number(v).toFixed(2),
    },
    {
      key: 'cuenta_padre_id',
      label: 'cuenta_padre_id',
      format: (v) => (v == null ? '' : String(v)),
    },
  ];

  for (const field of trackFields) {
    if (parsed[field.key] === undefined) continue;
    const prevRaw = existing[field.key as keyof typeof existing];
    const nextRaw = parsed[field.key];
    const prev = field.format ? field.format(prevRaw) : String(prevRaw ?? '');
    const next = field.format ? field.format(nextRaw) : String(nextRaw ?? '');
    if (prev === next) continue;
    await cuentasRepo.insertHistorial({
      cuenta_id: id,
      accion: 'MODIFICACION',
      campo: field.label,
      valor_anterior: prev || null,
      valor_nuevo: next || null,
      usuario_id: actorId,
    });
  }

  await registrarAuditoria({
    usuario_id: actorId,
    accion: 'UPDATE',
    entidad: 'cuentas',
    entidad_id: id,
    cambios: parsed as Record<string, unknown>,
    ip,
  });

  return cuenta;
}

const ajusteSaldoSchema = z.object({
  saldo_inicial: z.number().min(0),
  motivo: z.string().min(3).max(500),
});

export async function ajustarSaldo(
  id: number,
  data: z.infer<typeof ajusteSaldoSchema>,
  actorId: number,
  ip?: string
) {
  const parsed = ajusteSaldoSchema.parse(data);
  const existing = await cuentasRepo.findById(id);
  if (!existing) {
    throw new AppError(404, 'Cuenta no encontrada', 'CUENTA_NOT_FOUND');
  }

  validateSaldoNoNegativo(parsed.saldo_inicial, existing.saldo_afectado);

  if (Math.abs(parsed.saldo_inicial - existing.saldo_inicial) < 0.001) {
    throw new AppError(400, 'El saldo indicado es igual al actual', 'SALDO_SIN_CAMBIO');
  }

  const cuenta = await cuentasRepo.update(id, { saldo_inicial: parsed.saldo_inicial });

  const delta = Number((parsed.saldo_inicial - existing.saldo_inicial).toFixed(2));
  await cuentasRepo.insertHistorial({
    cuenta_id: id,
    accion: 'AJUSTE_SALDO',
    campo: 'saldo_inicial',
    valor_anterior: existing.saldo_inicial.toFixed(2),
    valor_nuevo: parsed.saldo_inicial.toFixed(2),
    observacion: `${parsed.motivo} (delta ${delta >= 0 ? '+' : ''}${delta.toFixed(2)})`,
    usuario_id: actorId,
  });

  await registrarAuditoria({
    usuario_id: actorId,
    accion: 'UPDATE',
    entidad: 'cuentas',
    entidad_id: id,
    cambios: {
      ajuste_saldo: true,
      saldo_anterior: existing.saldo_inicial,
      saldo_nuevo: parsed.saldo_inicial,
      motivo: parsed.motivo,
    },
    ip,
  });

  return cuenta;
}

export async function getHistorial(cuentaId: number) {
  await getCuenta(cuentaId);
  return cuentasRepo.getHistorial(cuentaId);
}

export async function getHijos(cuentaId: number) {
  await getCuenta(cuentaId);
  return cuentasRepo.findChildren(cuentaId);
}

export async function getAfectaciones(cuentaId: number) {
  await getCuenta(cuentaId);
  return cuentasRepo.getAfectacionesPorCuenta(cuentaId);
}

export async function getMovimientos(cuentaId: number) {
  await getCuenta(cuentaId);
  return cuentasRepo.getMovimientosPorCuenta(cuentaId);
}

export async function deleteCuenta(id: number, actorId: number, ip?: string) {
  const existing = await cuentasRepo.findById(id);
  if (!existing) {
    throw new AppError(404, 'Cuenta no encontrada', 'CUENTA_NOT_FOUND');
  }

  if (await cuentasRepo.hasChildren(id)) {
    throw new AppError(
      400,
      'No se puede eliminar una cuenta con subcuentas asociadas',
      'HAS_CHILDREN'
    );
  }

  if (existing.saldo_afectado > 0) {
    throw new AppError(
      400,
      'No se puede eliminar una cuenta con saldo afectado',
      'HAS_AFFECTED_BALANCE'
    );
  }

  {
    const { getFondoARendirCuenta } = await import('./configuracion.service.js');
    const fondo = await getFondoARendirCuenta();
    if (fondo && fondo.id === id) {
      throw new AppError(
        400,
        'No se puede eliminar la cuenta configurada como Fondo a rendir',
        'FONDO_A_RENDIR_CUENTA'
      );
    }
  }

  await cuentasRepo.softDelete(id);

  await cuentasRepo.insertHistorial({
    cuenta_id: id,
    accion: 'ELIMINACION',
    observacion: `Cuenta ${existing.codigo} eliminada`,
    usuario_id: actorId,
  });

  await registrarAuditoria({
    usuario_id: actorId,
    accion: 'DELETE',
    entidad: 'cuentas',
    entidad_id: id,
    cambios: { codigo: existing.codigo },
    ip,
  });
}

export async function exportCuentas(filters: {
  search?: string;
  tipo?: string;
  estado?: string;
}) {
  return cuentasRepo.findAllForExport(filters);
}

export function cuentasToCsv(cuentas: Cuenta[]): string {
  const headers = [
    'Código',
    'Descripción',
    'Tipo',
    'Nivel',
    'Cuenta Padre',
    'Saldo Inicial',
    'Saldo Afectado',
    'Saldo Disponible',
    'Estado',
  ];

  const rows = cuentas.map((c) => [
    c.codigo,
    `"${c.descripcion.replace(/"/g, '""')}"`,
    c.tipo,
    c.nivel,
    c.cuenta_padre_codigo ?? '',
    c.saldo_inicial.toFixed(2),
    c.saldo_afectado.toFixed(2),
    c.saldo_disponible.toFixed(2),
    c.estado,
  ]);

  return [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
}

export async function getResumen() {
  const [totalActivas, totales] = await Promise.all([
    cuentasRepo.countActivas(),
    cuentasRepo.getTotalesPresupuesto(),
  ]);

  return {
    totalActivas,
    ...totales,
  };
}
