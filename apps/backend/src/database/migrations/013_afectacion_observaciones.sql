-- Observaciones en afectaciones + soporte de afectaciones parciales múltiples por expediente

ALTER TABLE afectaciones
  ADD COLUMN IF NOT EXISTS observaciones TEXT;

COMMENT ON COLUMN afectaciones.observaciones IS 'Detalle / nota de la afectación (cuota, concepto, etc.)';
