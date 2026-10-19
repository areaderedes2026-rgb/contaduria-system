-- Migración: Proveedores + refactor de campos de expedientes
-- Quita letra/causante/asunto; agrega proveedor_id, importe, detalle

CREATE TABLE IF NOT EXISTS proveedores (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  documento VARCHAR(50),
  domicilio VARCHAR(255),
  telefono VARCHAR(50),
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_proveedores_nombre ON proveedores(nombre) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_proveedores_documento ON proveedores(documento) WHERE deleted_at IS NULL AND documento IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_proveedores_activo ON proveedores(activo) WHERE deleted_at IS NULL;

-- Columnas nuevas (nullable primero para migrar datos)
ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS proveedor_id INTEGER REFERENCES proveedores(id);
ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS importe NUMERIC(18, 2);
ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS detalle TEXT;

-- Migrar causantes existentes a proveedores
INSERT INTO proveedores (nombre)
SELECT DISTINCT TRIM(causante)
FROM expedientes
WHERE deleted_at IS NULL
  AND causante IS NOT NULL
  AND TRIM(causante) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM proveedores p
    WHERE p.nombre = TRIM(expedientes.causante) AND p.deleted_at IS NULL
  );

UPDATE expedientes e
SET proveedor_id = p.id,
    detalle = COALESCE(NULLIF(TRIM(e.asunto), ''), 'Sin detalle'),
    importe = COALESCE(e.importe, 0)
FROM proveedores p
WHERE e.proveedor_id IS NULL
  AND p.nombre = TRIM(e.causante)
  AND p.deleted_at IS NULL;

-- Proveedor genérico por si quedan filas sin mapear
INSERT INTO proveedores (nombre)
SELECT 'Proveedor migrado'
WHERE NOT EXISTS (
  SELECT 1 FROM proveedores WHERE nombre = 'Proveedor migrado' AND deleted_at IS NULL
)
AND EXISTS (
  SELECT 1 FROM expedientes WHERE proveedor_id IS NULL AND deleted_at IS NULL
);

UPDATE expedientes e
SET proveedor_id = (SELECT id FROM proveedores WHERE nombre = 'Proveedor migrado' AND deleted_at IS NULL LIMIT 1),
    detalle = COALESCE(NULLIF(TRIM(e.detalle), ''), NULLIF(TRIM(e.asunto), ''), 'Sin detalle'),
    importe = COALESCE(e.importe, 0)
WHERE e.proveedor_id IS NULL;

UPDATE expedientes
SET detalle = COALESCE(NULLIF(TRIM(detalle), ''), 'Sin detalle'),
    importe = COALESCE(importe, 0)
WHERE detalle IS NULL OR importe IS NULL;

ALTER TABLE expedientes ALTER COLUMN proveedor_id SET NOT NULL;
ALTER TABLE expedientes ALTER COLUMN importe SET NOT NULL;
ALTER TABLE expedientes ALTER COLUMN detalle SET NOT NULL;
ALTER TABLE expedientes ALTER COLUMN importe SET DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_expedientes_proveedor ON expedientes(proveedor_id) WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS idx_expedientes_causante;
DROP INDEX IF EXISTS idx_expedientes_letra;

ALTER TABLE expedientes DROP COLUMN IF EXISTS letra;
ALTER TABLE expedientes DROP COLUMN IF EXISTS causante;
ALTER TABLE expedientes DROP COLUMN IF EXISTS asunto;
