-- Comprobante opcional en afectaciones (mismo criterio que pagos)

ALTER TABLE afectaciones
  ADD COLUMN IF NOT EXISTS numero_comprobante VARCHAR(100);

COMMENT ON COLUMN afectaciones.numero_comprobante IS
  'Número de comprobante / factura / documento de respaldo (opcional)';
