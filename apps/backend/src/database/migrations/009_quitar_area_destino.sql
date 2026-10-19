-- Eliminar columna area_destino de expedientes
DROP INDEX IF EXISTS idx_expedientes_area_destino;
ALTER TABLE expedientes DROP COLUMN IF EXISTS area_destino;
