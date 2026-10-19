-- Varios proveedores por expediente (máx. 5). proveedor_id del expediente = principal (orden 1).

CREATE TABLE IF NOT EXISTS expediente_proveedores (
  expediente_id INTEGER NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
  proveedor_id INTEGER NOT NULL REFERENCES proveedores(id),
  orden SMALLINT NOT NULL,
  PRIMARY KEY (expediente_id, proveedor_id),
  CONSTRAINT expediente_proveedores_orden_rango CHECK (orden >= 1 AND orden <= 5)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_expediente_proveedores_orden
  ON expediente_proveedores (expediente_id, orden);

CREATE INDEX IF NOT EXISTS idx_expediente_proveedores_proveedor
  ON expediente_proveedores (proveedor_id);

COMMENT ON TABLE expediente_proveedores IS
  'Proveedores vinculados a un expediente (1 a 5). El de orden 1 es el principal.';

-- Migrar el proveedor único actual
INSERT INTO expediente_proveedores (expediente_id, proveedor_id, orden)
SELECT e.id, e.proveedor_id, 1
FROM expedientes e
WHERE e.proveedor_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Destinatario de afectación: varios nombres unidos
ALTER TABLE afectaciones
  ALTER COLUMN destinatario TYPE VARCHAR(500);
