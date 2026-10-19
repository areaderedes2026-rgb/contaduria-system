-- Migración: Índices adicionales para consultas de auditoría
-- Fecha: 2026-07-01

CREATE INDEX IF NOT EXISTS idx_auditoria_entidad ON auditoria(entidad);
CREATE INDEX IF NOT EXISTS idx_auditoria_accion ON auditoria(accion);
CREATE INDEX IF NOT EXISTS idx_auditoria_entidad_id ON auditoria(entidad, entidad_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha_entidad ON auditoria(created_at DESC, entidad);
