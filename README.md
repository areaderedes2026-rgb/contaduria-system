# Sistema de Contaduría Municipal de Trancas

Sistema web de gestión contable para el Departamento de Contaduría de la Municipalidad de Trancas.

## Requisitos

- Node.js 20+
- Docker Desktop (para PostgreSQL en desarrollo)
- Git

## Inicio rápido

```bash
# Configuración inicial (instala dependencias, levanta BD, migra y seed)
npm run setup

# Desarrollo (backend + frontend simultáneo)
npm run dev
```

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3000/api
- **Credenciales:** `admin` / `Admin123!`

## Comandos principales

Todos los cambios se realizan desde la raíz del proyecto con un solo comando:

| Comando | Descripción |
|---------|-------------|
| `npm run setup` | Configuración inicial completa |
| `npm run dev` | Desarrollo (backend + frontend) |
| `npm run dev:backend` | Solo backend |
| `npm run dev:frontend` | Solo frontend |
| `npm run build` | Compilar backend y frontend |
| `npm run start:prod` | Iniciar backend en producción |
| `npm run db:up` | Iniciar PostgreSQL (Docker) |
| `npm run db:down` | Detener PostgreSQL |
| `npm run db:migrate` | Aplicar migraciones pendientes |
| `npm run db:seed` | Cargar datos iniciales |
| `npm run db:reset` | Reiniciar BD desde cero |
| `npm run db:status` | Ver migraciones aplicadas |
| `npm run deploy` | Desplegar en servidor (git pull + build + PM2) |

## Estructura

```
apps/
  backend/     → API Express + TypeScript
  frontend/    → React + Vite + PWA
docs/          → Documentación
infra/
  docker/      → PostgreSQL
  scripts/     → Automatización
```

## Etapa actual

**Sistema completo** — Las 9 etapas están implementadas: flujo operativo (expedientes → pagos), consultas, reportes formales y auditoría.

## Despliegue en oficina (multi-PC)

Una PC actúa como servidor (app + base). El resto entra por WiFi/LAN a `http://IP-SERVIDOR:3000`. Ver checklist completa en [docs/despliegue.md](docs/despliegue.md).

## Documentación

- [Desarrollo](docs/desarrollo.md)
- [Despliegue](docs/despliegue.md)
- [Contaduría — Reglas de negocio](docs/contaduria.md)
