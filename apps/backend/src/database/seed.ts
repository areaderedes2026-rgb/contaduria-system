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

  console.log('✓ Base operativa vacía (sin cuentas, proveedores ni documentos de ejemplo)');
  console.log('\n=== Seed completado ===');
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error en seed:', err);
    process.exit(1);
  })
  .finally(() => pool.end());
