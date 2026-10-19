-- Producción multi-usuario / multi-PC en LAN
-- Un solo libramiento activo por afectación (evita doble emisión concurrente)

CREATE UNIQUE INDEX IF NOT EXISTS idx_libramientos_afectacion_activa
  ON libramientos (afectacion_id)
  WHERE deleted_at IS NULL AND anulado = false;

COMMENT ON INDEX idx_libramientos_afectacion_activa IS
  'Garantiza un único libramiento vigente por afectación bajo concurrencia';
