# Guía de desarrollo

## Entorno local

### 1. Clonar e instalar

```bash
git clone <repo-url>
cd contaduria-municipal
npm run setup
```

El comando `setup` realiza automáticamente:

1. Copia archivos `.env` de ejemplo
2. Instala dependencias (`npm install`)
3. Inicia PostgreSQL con Docker
4. Ejecuta migraciones (`npm run db:migrate`)
5. Carga lo mínimo para entrar (`npm run db:seed`: roles y usuario admin). No carga cuentas ni documentos de ejemplo.

### 2. Desarrollo

```bash
npm run dev
```

Abre http://localhost:5173 e inicia sesión con `admin` / `Admin123!`.

## Variables de entorno

| Archivo | Variables |
|---------|-----------|
| `apps/backend/.env` | BD, JWT, puerto, HTTPS opcional |
| `apps/frontend/.env` | `VITE_API_URL` |

Copiar desde `.env.example` en la raíz si no existen.

## Base de datos

### Crear una nueva migración

1. Crear archivo SQL en `apps/backend/src/database/migrations/`:
   ```
   002_nombre_descriptivo.sql
   ```
2. Aplicar:
   ```bash
   npm run db:migrate
   ```

Las migraciones se ejecutan en orden alfabético y solo se aplican una vez.

### Reiniciar base de datos

```bash
npm run db:reset
```

> **Nota:** Docker usa el puerto **5433** en el host (para no conflictuar con PostgreSQL local en 5432). Configurar `DB_PORT=5433` en `apps/backend/.env`.

Elimina todos los datos y vuelve a aplicar migraciones + seed.

### Ver estado

```bash
npm run db:status
```

## Roles y permisos

| Rol | Permisos |
|-----|----------|
| `admin` | dashboard:read, usuarios:read, usuarios:write, cuentas:read, cuentas:write, expedientes:read, expedientes:write, afectaciones:read, afectaciones:write, libramientos:read, libramientos:write, pagos:read, pagos:write, consultas:read, reportes:read, auditoria:read |
| `empleado` | dashboard:read, cuentas:read, expedientes:read, expedientes:write, afectaciones:read, afectaciones:write, libramientos:read, libramientos:write, pagos:read, pagos:write, consultas:read, reportes:read |

## Flujo de trabajo con Git (oficina)

1. Desarrollar en su PC local (`npm run dev`)
2. Commit y push a GitHub
3. En la **PC principal** de la oficina: doble clic en **Actualizar Contaduría** (acceso a `infra/scripts/actualizar-contaduria.bat`) o `npm run deploy`
4. En las PCs de trabajo: cartel “Nueva versión disponible” → Recargar

Si cambia el WiFi o la IP: **Cambiar red** en el servidor (`infra/scripts/cambiar-red.bat`) y en cada puesto `configurar-acceso-cliente.bat`. La URL sigue siendo `https://contaduria.local:3000`.

**Nunca desarrollar directamente en producción.**  
Las PCs de trabajo **no** clonan el repo: solo usan el navegador/PWA contra el servidor.

Instalación desde cero en la oficina (su PC, servidor y clientes): [despliegue.md](./despliegue.md).

## Estructura del backend

```
controllers/  → HTTP handlers
services/     → Lógica de negocio
repositories/ → Acceso a datos
middlewares/  → Auth, errores
database/
  migrations/ → Cambios de esquema SQL
  seed.ts     → Datos iniciales
```

## Estructura del frontend

```
pages/       → Vistas
components/  → UI reutilizable
layouts/     → Layout principal
services/    → Llamadas API
stores/      → Zustand (auth)
routes/      → React Router
```
