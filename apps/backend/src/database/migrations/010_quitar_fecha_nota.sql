-- Eliminar columna fecha_nota de expedientes
ALTER TABLE expedientes DROP COLUMN IF EXISTS fecha_nota;
