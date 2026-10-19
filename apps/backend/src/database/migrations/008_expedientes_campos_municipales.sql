-- Migración: Campos municipales de expedientes
-- letra, asunto, causante, area_destino, fecha_ingreso, fecha_nota

ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS letra VARCHAR(10);
ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS asunto TEXT;
ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS causante VARCHAR(255);
ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS area_destino VARCHAR(255);
ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS fecha_ingreso DATE;
ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS fecha_nota DATE;

UPDATE expedientes SET
  letra = COALESCE(letra, 'E'),
  asunto = COALESCE(asunto, descripcion),
  causante = COALESCE(causante, destinatario),
  area_destino = COALESCE(area_destino, ''),
  fecha_ingreso = COALESCE(fecha_ingreso, fecha),
  fecha_nota = COALESCE(fecha_nota, fecha)
WHERE fecha IS NOT NULL OR destinatario IS NOT NULL OR descripcion IS NOT NULL;

UPDATE expedientes SET
  letra = COALESCE(letra, 'E'),
  asunto = COALESCE(asunto, ''),
  causante = COALESCE(causante, ''),
  area_destino = COALESCE(area_destino, ''),
  fecha_ingreso = COALESCE(fecha_ingreso, CURRENT_DATE)
WHERE fecha_ingreso IS NULL;

ALTER TABLE expedientes ALTER COLUMN letra SET NOT NULL;
ALTER TABLE expedientes ALTER COLUMN letra SET DEFAULT 'E';
ALTER TABLE expedientes ALTER COLUMN asunto SET NOT NULL;
ALTER TABLE expedientes ALTER COLUMN causante SET NOT NULL;
ALTER TABLE expedientes ALTER COLUMN area_destino SET NOT NULL;
ALTER TABLE expedientes ALTER COLUMN area_destino SET DEFAULT '';
ALTER TABLE expedientes ALTER COLUMN fecha_ingreso SET NOT NULL;

ALTER TABLE expedientes DROP COLUMN IF EXISTS fecha;
ALTER TABLE expedientes DROP COLUMN IF EXISTS destinatario;
ALTER TABLE expedientes DROP COLUMN IF EXISTS descripcion;

DROP INDEX IF EXISTS idx_expedientes_fecha;
DROP INDEX IF EXISTS idx_expedientes_destinatario;

CREATE INDEX IF NOT EXISTS idx_expedientes_fecha_ingreso ON expedientes(fecha_ingreso) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_expedientes_causante ON expedientes(causante) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_expedientes_letra ON expedientes(letra) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_expedientes_area_destino ON expedientes(area_destino) WHERE deleted_at IS NULL;
