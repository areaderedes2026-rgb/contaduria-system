import { query } from '../database/pool.js';
import type { Cuenta } from '../entities/index.js';
import { calcularSaldoDisponible } from '../utils/cuenta.utils.js';

interface CuentaRow {
  id: number;
  codigo: string;
  descripcion: string;
  tipo: Cuenta['tipo'];
  cuenta_padre_id: number | null;
  cuenta_padre_codigo: string | null;
  nivel: number;
  saldo_inicial: string;
  saldo_afectado: string;
  estado: Cuenta['estado'];
  created_at: Date;
  updated_at: Date;
}

function mapCuenta(row: CuentaRow): Cuenta {
  const saldoInicial = parseFloat(row.saldo_inicial);
  const saldoAfectado = parseFloat(row.saldo_afectado);
  return {
    id: row.id,
    codigo: row.codigo,
    descripcion: row.descripcion,
    tipo: row.tipo,
    cuenta_padre_id: row.cuenta_padre_id,
    cuenta_padre_codigo: row.cuenta_padre_codigo,
    nivel: row.nivel,
    saldo_inicial: saldoInicial,
    saldo_afectado: saldoAfectado,
    saldo_disponible: calcularSaldoDisponible(saldoInicial, saldoAfectado),
    estado: row.estado,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const SELECT_BASE = `
  SELECT c.id, c.codigo, c.descripcion, c.tipo, c.cuenta_padre_id,
         p.codigo AS cuenta_padre_codigo, c.nivel,
         c.saldo_inicial::text, c.saldo_afectado::text, c.estado,
         c.created_at, c.updated_at
  FROM cuentas c
  LEFT JOIN cuentas p ON p.id = c.cuenta_padre_id AND p.deleted_at IS NULL
`;

export interface ListCuentasParams {
  page: number;
  limit: number;
  search?: string;
  /** Coincidencia exacta de código (ej. desde detalle de afectación). */
  codigoExacto?: string;
  tipo?: string;
  estado?: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export async function findAll(params: ListCuentasParams) {
  const { page, limit, search, codigoExacto, tipo, estado, sortBy, sortOrder } = params;
  const offset = (page - 1) * limit;

  const allowedSort = ['codigo', 'descripcion', 'tipo', 'saldo_inicial', 'saldo_afectado', 'estado', 'nivel', 'created_at'];
  const orderColumn = allowedSort.includes(sortBy) ? sortBy : 'codigo';
  const order = sortOrder === 'desc' ? 'DESC' : 'ASC';

  let whereClause = 'WHERE c.deleted_at IS NULL';
  const values: unknown[] = [];

  if (codigoExacto) {
    values.push(codigoExacto);
    whereClause += ` AND c.codigo = $${values.length}`;
  } else if (search) {
    values.push(`%${search}%`);
    whereClause += ` AND (c.codigo ILIKE $${values.length} OR c.descripcion ILIKE $${values.length})`;
  }

  if (tipo) {
    values.push(tipo);
    whereClause += ` AND c.tipo = $${values.length}`;
  }

  if (estado) {
    values.push(estado);
    whereClause += ` AND c.estado = $${values.length}`;
  }

  const countResult = await query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM cuentas c ${whereClause}`,
    values
  );

  values.push(limit, offset);
  const dataResult = await query<CuentaRow>(
    `${SELECT_BASE}
     ${whereClause}
     ORDER BY c.${orderColumn} ${order}
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );

  return {
    data: dataResult.rows.map(mapCuenta),
    total: parseInt(countResult.rows[0]?.total ?? '0', 10),
    page,
    limit,
  };
}

export async function findAllForExport(filters: {
  search?: string;
  tipo?: string;
  estado?: string;
}): Promise<Cuenta[]> {
  let whereClause = 'WHERE c.deleted_at IS NULL';
  const values: unknown[] = [];

  if (filters.search) {
    values.push(`%${filters.search}%`);
    whereClause += ` AND (c.codigo ILIKE $${values.length} OR c.descripcion ILIKE $${values.length})`;
  }
  if (filters.tipo) {
    values.push(filters.tipo);
    whereClause += ` AND c.tipo = $${values.length}`;
  }
  if (filters.estado) {
    values.push(filters.estado);
    whereClause += ` AND c.estado = $${values.length}`;
  }

  const result = await query<CuentaRow>(
    `${SELECT_BASE} ${whereClause} ORDER BY c.codigo ASC`,
    values
  );
  return result.rows.map(mapCuenta);
}

export async function findAllFlat(): Promise<Cuenta[]> {
  const result = await query<CuentaRow>(
    `${SELECT_BASE} WHERE c.deleted_at IS NULL ORDER BY c.codigo ASC`
  );
  return result.rows.map(mapCuenta);
}

export async function findById(id: number): Promise<Cuenta | null> {
  const result = await query<CuentaRow>(
    `${SELECT_BASE} WHERE c.id = $1 AND c.deleted_at IS NULL`,
    [id]
  );
  return result.rows[0] ? mapCuenta(result.rows[0]) : null;
}

export async function findByCodigo(codigo: string, excludeId?: number): Promise<Cuenta | null> {
  const values: unknown[] = [codigo];
  let sql = `${SELECT_BASE} WHERE c.codigo = $1 AND c.deleted_at IS NULL`;
  if (excludeId) {
    values.push(excludeId);
    sql += ` AND c.id != $2`;
  }
  const result = await query<CuentaRow>(sql, values);
  return result.rows[0] ? mapCuenta(result.rows[0]) : null;
}

export async function hasChildren(id: number): Promise<boolean> {
  const result = await query(
    'SELECT 1 FROM cuentas WHERE cuenta_padre_id = $1 AND deleted_at IS NULL LIMIT 1',
    [id]
  );
  return result.rowCount > 0;
}

export async function countChildren(id: number): Promise<number> {
  const result = await query<{ total: string }>(
    'SELECT COUNT(*)::text AS total FROM cuentas WHERE cuenta_padre_id = $1 AND deleted_at IS NULL',
    [id]
  );
  return parseInt(result.rows[0]?.total ?? '0', 10);
}

export async function create(data: {
  codigo: string;
  descripcion: string;
  tipo: Cuenta['tipo'];
  cuenta_padre_id: number | null;
  nivel: number;
  saldo_inicial: number;
}): Promise<Cuenta> {
  const result = await query<CuentaRow>(
    `INSERT INTO cuentas (codigo, descripcion, tipo, cuenta_padre_id, nivel, saldo_inicial)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, codigo, descripcion, tipo, cuenta_padre_id, nivel,
               saldo_inicial::text, saldo_afectado::text, estado, created_at, updated_at`,
    [data.codigo, data.descripcion, data.tipo, data.cuenta_padre_id, data.nivel, data.saldo_inicial]
  );
  const created = await findById(result.rows[0].id);
  return created!;
}

export async function update(
  id: number,
  data: Partial<{
    codigo: string;
    descripcion: string;
    tipo: Cuenta['tipo'];
    cuenta_padre_id: number | null;
    nivel: number;
    saldo_inicial: number;
    estado: Cuenta['estado'];
  }>
): Promise<Cuenta | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      fields.push(`${key} = $${paramIndex++}`);
      values.push(value);
    }
  }

  if (fields.length === 0) return findById(id);

  fields.push('updated_at = NOW()');
  values.push(id);

  await query(
    `UPDATE cuentas SET ${fields.join(', ')} WHERE id = $${paramIndex} AND deleted_at IS NULL`,
    values
  );

  return findById(id);
}

export async function softDelete(id: number): Promise<boolean> {
  const result = await query(
    `UPDATE cuentas SET deleted_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  return result.rowCount > 0;
}

export async function codigoExists(codigo: string, excludeId?: number): Promise<boolean> {
  const values: unknown[] = [codigo];
  let sql = 'SELECT 1 FROM cuentas WHERE codigo = $1 AND deleted_at IS NULL';
  if (excludeId) {
    values.push(excludeId);
    sql += ' AND id != $2';
  }
  const result = await query(sql, values);
  return result.rowCount > 0;
}

export async function countActivas(): Promise<number> {
  const result = await query<{ total: string }>(
    "SELECT COUNT(*)::text AS total FROM cuentas WHERE deleted_at IS NULL AND estado = 'ACTIVA'"
  );
  return parseInt(result.rows[0]?.total ?? '0', 10);
}

export async function getTotalesPresupuesto() {
  const result = await query<{
    total_inicial: string;
    total_afectado: string;
    total_disponible: string;
  }>(`
    SELECT
      COALESCE(SUM(saldo_inicial), 0)::text AS total_inicial,
      COALESCE(SUM(saldo_afectado), 0)::text AS total_afectado,
      COALESCE(SUM(saldo_inicial - saldo_afectado), 0)::text AS total_disponible
    FROM cuentas
    WHERE deleted_at IS NULL AND estado = 'ACTIVA' AND tipo IN ('RECURSO', 'GASTO')
  `);
  const row = result.rows[0];
  return {
    totalInicial: parseFloat(row?.total_inicial ?? '0'),
    totalAfectado: parseFloat(row?.total_afectado ?? '0'),
    totalDisponible: parseFloat(row?.total_disponible ?? '0'),
  };
}

export async function findChildren(padreId: number): Promise<Cuenta[]> {
  const result = await query<CuentaRow>(
    `${SELECT_BASE} WHERE c.cuenta_padre_id = $1 AND c.deleted_at IS NULL ORDER BY c.codigo ASC`,
    [padreId]
  );
  return result.rows.map(mapCuenta);
}

export async function insertHistorial(data: {
  cuenta_id: number;
  accion: string;
  campo?: string | null;
  valor_anterior?: string | null;
  valor_nuevo?: string | null;
  observacion?: string | null;
  usuario_id: number | null;
}): Promise<void> {
  await query(
    `INSERT INTO cuenta_historial
       (cuenta_id, accion, campo, valor_anterior, valor_nuevo, observacion, usuario_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      data.cuenta_id,
      data.accion,
      data.campo ?? null,
      data.valor_anterior ?? null,
      data.valor_nuevo ?? null,
      data.observacion ?? null,
      data.usuario_id,
    ]
  );
}

export async function getHistorial(cuentaId: number) {
  const result = await query<{
    id: number;
    cuenta_id: number;
    accion: string;
    campo: string | null;
    valor_anterior: string | null;
    valor_nuevo: string | null;
    observacion: string | null;
    usuario_id: number | null;
    usuario_nombre: string | null;
    created_at: Date;
  }>(
    `SELECT h.id, h.cuenta_id, h.accion, h.campo, h.valor_anterior, h.valor_nuevo,
            h.observacion, h.usuario_id,
            NULLIF(TRIM(CONCAT(u.nombre, ' ', u.apellido)), '') AS usuario_nombre,
            h.created_at
     FROM cuenta_historial h
     LEFT JOIN usuarios u ON u.id = h.usuario_id
     WHERE h.cuenta_id = $1
     ORDER BY h.created_at DESC, h.id DESC`,
    [cuentaId]
  );
  return result.rows;
}

export async function getAfectacionesPorCuenta(cuentaId: number) {
  const result = await query<{
    id: number;
    numero: number;
    fecha: string;
    numero_completo: string;
    expediente_id: number;
    expediente_numero: string;
    destinatario: string;
    importe_linea: string;
    importe_total: string;
    observaciones: string | null;
    anulada: boolean;
  }>(
    `SELECT a.id, a.numero, a.fecha::text AS fecha,
            CONCAT(a.numero, '/', a.anio) AS numero_completo,
            a.expediente_id,
            CONCAT(e.numero, '/', e.anio) AS expediente_numero,
            a.destinatario,
            ad.importe::text AS importe_linea,
            a.importe_total::text AS importe_total,
            a.observaciones,
            a.anulada
     FROM afectacion_detalle ad
     INNER JOIN afectaciones a ON a.id = ad.afectacion_id AND a.deleted_at IS NULL
     INNER JOIN expedientes e ON e.id = a.expediente_id
     WHERE ad.cuenta_id = $1
     ORDER BY a.fecha DESC, a.numero DESC, a.id DESC`,
    [cuentaId]
  );

  return result.rows.map((r) => ({
    id: r.id,
    numero: r.numero,
    fecha: r.fecha,
    numero_completo: r.numero_completo,
    expediente_id: r.expediente_id,
    expediente_numero: r.expediente_numero,
    destinatario: r.destinatario,
    importe_linea: parseFloat(r.importe_linea),
    importe_total: parseFloat(r.importe_total),
    observaciones: r.observaciones,
    anulada: r.anulada,
  }));
}

export async function getMovimientosPorCuenta(cuentaId: number) {
  const result = await query<{
    tipo: string;
    documento_id: number;
    fecha: string;
    expediente_id: number | null;
    expediente_numero: string | null;
    documento_numero: string;
    beneficiario: string;
    descripcion: string;
    importe: string;
    anulado: boolean;
    pago_id: number | null;
    pago_numero: string | null;
    pagado: boolean;
  }>(
    `SELECT * FROM (
        SELECT 'LIBRAMIENTO' AS tipo, l.id AS documento_id, l.fecha::text AS fecha,
               e.id AS expediente_id, CONCAT(e.numero, '/', e.anio) AS expediente_numero,
               CONCAT(l.numero, '/', l.anio) AS documento_numero,
               l.beneficiario, COALESCE(ld.descripcion, '') AS descripcion,
               ld.importe::text AS importe, l.anulado,
               p.id AS pago_id,
               CASE WHEN p.id IS NOT NULL
                 THEN CONCAT(p.numero, '/', p.anio)
                 ELSE NULL
               END AS pago_numero,
               (p.id IS NOT NULL) AS pagado
        FROM libramiento_detalle ld
        INNER JOIN libramientos l ON l.id = ld.libramiento_id AND l.deleted_at IS NULL
        INNER JOIN expedientes e ON e.id = l.expediente_id
        LEFT JOIN pagos p ON p.libramiento_id = l.id
          AND p.deleted_at IS NULL AND p.anulado = false
        WHERE ld.cuenta_id = $1

        UNION ALL

        SELECT 'ANTICIPO', a.id, a.fecha::text,
               e.id, CONCAT(e.numero, '/', e.anio),
               CONCAT(a.numero, '/', a.anio),
               a.destinatario, COALESCE(a.observaciones, 'Anticipo fondo a rendir'),
               a.importe::text, a.anulada,
               NULL, NULL, false
        FROM anticipos a
        INNER JOIN expedientes e ON e.id = a.expediente_id
        WHERE a.cuenta_id = $1 AND a.deleted_at IS NULL
      ) mov
      ORDER BY fecha DESC, documento_id DESC`,
    [cuentaId]
  );

  return result.rows.map((r) => ({
    tipo: r.tipo,
    documento_id: r.documento_id,
    fecha: r.fecha,
    expediente_id: r.expediente_id,
    expediente_numero: r.expediente_numero,
    documento_numero: r.documento_numero,
    beneficiario: r.beneficiario,
    descripcion: r.descripcion,
    importe: parseFloat(r.importe),
    anulado: r.anulado,
    pago_id: r.pago_id,
    pago_numero: r.pago_numero,
    pagado: r.pagado,
  }));
}
