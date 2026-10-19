import bcrypt from 'bcryptjs';
import { pool, query } from './pool.js';

const PERMISOS = [
  { codigo: 'dashboard:read', modulo: 'dashboard', descripcion: 'Ver panel principal' },
  { codigo: 'usuarios:read', modulo: 'usuarios', descripcion: 'Ver usuarios' },
  { codigo: 'usuarios:write', modulo: 'usuarios', descripcion: 'Gestionar usuarios' },
  { codigo: 'cuentas:read', modulo: 'cuentas', descripcion: 'Ver plan de cuentas' },
  { codigo: 'cuentas:write', modulo: 'cuentas', descripcion: 'Gestionar plan de cuentas' },
  { codigo: 'expedientes:read', modulo: 'expedientes', descripcion: 'Ver expedientes' },
  { codigo: 'expedientes:write', modulo: 'expedientes', descripcion: 'Gestionar expedientes' },
  { codigo: 'proveedores:read', modulo: 'proveedores', descripcion: 'Ver proveedores' },
  { codigo: 'proveedores:write', modulo: 'proveedores', descripcion: 'Gestionar proveedores' },
  { codigo: 'afectaciones:read', modulo: 'afectaciones', descripcion: 'Ver afectaciones' },
  { codigo: 'afectaciones:write', modulo: 'afectaciones', descripcion: 'Gestionar afectaciones' },
  { codigo: 'libramientos:read', modulo: 'libramientos', descripcion: 'Ver libramientos' },
  { codigo: 'libramientos:write', modulo: 'libramientos', descripcion: 'Gestionar libramientos' },
  { codigo: 'pagos:read', modulo: 'pagos', descripcion: 'Ver pagos' },
  { codigo: 'pagos:write', modulo: 'pagos', descripcion: 'Gestionar pagos' },
  { codigo: 'consultas:read', modulo: 'consultas', descripcion: 'Realizar consultas e informes' },
  { codigo: 'auditoria:read', modulo: 'auditoria', descripcion: 'Consultar registro de auditoría' },
  { codigo: 'reportes:read', modulo: 'reportes', descripcion: 'Generar reportes e informes' },
  { codigo: 'configuracion:read', modulo: 'configuracion', descripcion: 'Ver configuración del sistema' },
  { codigo: 'configuracion:write', modulo: 'configuracion', descripcion: 'Modificar configuración del sistema' },
];

const ROLES = [
  { nombre: 'admin', descripcion: 'Administrador del sistema' },
  { nombre: 'empleado', descripcion: 'Empleado de contaduría' },
];

const ROL_PERMISOS: Record<string, string[]> = {
  admin: ['dashboard:read', 'usuarios:read', 'usuarios:write', 'cuentas:read', 'cuentas:write', 'expedientes:read', 'expedientes:write', 'proveedores:read', 'proveedores:write', 'afectaciones:read', 'afectaciones:write', 'libramientos:read', 'libramientos:write', 'pagos:read', 'pagos:write', 'consultas:read', 'auditoria:read', 'reportes:read', 'configuracion:read', 'configuracion:write'],
  empleado: ['dashboard:read', 'cuentas:read', 'expedientes:read', 'expedientes:write', 'proveedores:read', 'proveedores:write', 'afectaciones:read', 'afectaciones:write', 'libramientos:read', 'libramientos:write', 'pagos:read', 'pagos:write', 'consultas:read', 'reportes:read'],
};

async function seed(): Promise<void> {
  console.log('=== Ejecutando seed ===\n');

  for (const permiso of PERMISOS) {
    await query(
      `INSERT INTO permisos (codigo, modulo, descripcion)
       VALUES ($1, $2, $3)
       ON CONFLICT (codigo) DO NOTHING`,
      [permiso.codigo, permiso.modulo, permiso.descripcion]
    );
  }
  console.log('✓ Permisos');

  for (const rol of ROLES) {
    await query(
      `INSERT INTO roles (nombre, descripcion)
       VALUES ($1, $2)
       ON CONFLICT (nombre) DO NOTHING`,
      [rol.nombre, rol.descripcion]
    );
  }
  console.log('✓ Roles');

  for (const [rolNombre, permisos] of Object.entries(ROL_PERMISOS)) {
    const rol = await query<{ id: number }>(
      'SELECT id FROM roles WHERE nombre = $1',
      [rolNombre]
    );
    if (rol.rows.length === 0) continue;

    for (const permisoCodigo of permisos) {
      const permiso = await query<{ id: number }>(
        'SELECT id FROM permisos WHERE codigo = $1',
        [permisoCodigo]
      );
      if (permiso.rows.length === 0) continue;

      await query(
        `INSERT INTO rol_permiso (rol_id, permiso_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [rol.rows[0].id, permiso.rows[0].id]
      );
    }
  }
  console.log('✓ Asignación de permisos');

  const adminRol = await query<{ id: number }>(
    "SELECT id FROM roles WHERE nombre = 'admin'"
  );

  if (adminRol.rows.length > 0) {
    const passwordHash = await bcrypt.hash('Admin123!', 12);
    await query(
      `INSERT INTO usuarios (username, password_hash, nombre, apellido, email, rol_id, activo)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       ON CONFLICT (username) DO NOTHING`,
      ['admin', passwordHash, 'Administrador', 'Sistema', 'admin@trancas.gob.ar', adminRol.rows[0].id]
    );
    console.log('✓ Usuario admin (admin / Admin123!)');
  }

  await query(
    `INSERT INTO configuracion (clave, valor, descripcion)
     VALUES ($1, $2, $3)
     ON CONFLICT (clave) DO NOTHING`,
    ['sistema_nombre', 'Contaduría Municipal de Trancas', 'Nombre del sistema']
  );
  console.log('✓ Configuración');

  await seedCuentasEjemplo();
  console.log('✓ Cuentas de ejemplo');

  console.log('\n=== Seed completado ===');
}

async function seedCuentasEjemplo(): Promise<void> {
  const cuentas = [
    { codigo: '1', descripcion: 'Recursos', tipo: 'RECURSO', padre: null, saldo: 0 },
    { codigo: '1.1', descripcion: 'Recursos ordinarios', tipo: 'RECURSO', padre: '1', saldo: 0 },
    { codigo: '1.1.01', descripcion: 'Impuestos', tipo: 'RECURSO', padre: '1.1', saldo: 5000000 },
    { codigo: '1.1.01.12', descripcion: 'Tasas municipales', tipo: 'RECURSO', padre: '1.1.01', saldo: 2500000 },
    { codigo: '1.1.01.12.10', descripcion: 'Tasa de servicios generales', tipo: 'RECURSO', padre: '1.1.01.12', saldo: 1200000 },
    { codigo: '1.1.01.12.10.11', descripcion: 'Tasa por servicio de limpieza', tipo: 'RECURSO', padre: '1.1.01.12.10', saldo: 800000 },
    { codigo: '2', descripcion: 'Gastos', tipo: 'GASTO', padre: null, saldo: 0 },
    { codigo: '2.1', descripcion: 'Gastos corrientes', tipo: 'GASTO', padre: '2', saldo: 0 },
    { codigo: '2.1.01', descripcion: 'Gastos de personal', tipo: 'GASTO', padre: '2.1', saldo: 3500000 },
    { codigo: '2.1.02', descripcion: 'Gastos de bienes de consumo', tipo: 'GASTO', padre: '2.1', saldo: 1800000 },
    { codigo: '3', descripcion: 'Patrimonial', tipo: 'PATRIMONIAL', padre: null, saldo: 0 },
    { codigo: '3.1', descripcion: 'Bienes de uso', tipo: 'PATRIMONIAL', padre: '3', saldo: 4200000 },
  ];

  const idByCodigo = new Map<string, number>();

  for (const cuenta of cuentas) {
    const existing = await query<{ id: number }>(
      'SELECT id FROM cuentas WHERE codigo = $1',
      [cuenta.codigo]
    );
    if (existing.rows.length > 0) {
      idByCodigo.set(cuenta.codigo, existing.rows[0].id);
      continue;
    }

    let padreId: number | null = null;
    if (cuenta.padre) {
      padreId = idByCodigo.get(cuenta.padre) ?? null;
    }

    const nivel = cuenta.codigo.split('.').length;
    const result = await query<{ id: number }>(
      `INSERT INTO cuentas (codigo, descripcion, tipo, cuenta_padre_id, nivel, saldo_inicial)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [cuenta.codigo, cuenta.descripcion, cuenta.tipo, padreId, nivel, cuenta.saldo]
    );
    idByCodigo.set(cuenta.codigo, result.rows[0].id);
  }
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error en seed:', err);
    process.exit(1);
  })
  .finally(() => pool.end());
