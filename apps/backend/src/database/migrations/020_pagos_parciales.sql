-- Pagos parciales: varios pagos activos por libramiento
-- monto_pagado acumula lo cobrado; pagado=true solo con saldo ~0

DROP INDEX IF EXISTS idx_pagos_libramiento_activo;

ALTER TABLE libramientos
  ADD COLUMN IF NOT EXISTS monto_pagado NUMERIC(18, 2) NOT NULL DEFAULT 0;

ALTER TABLE libramientos
  DROP CONSTRAINT IF EXISTS libramientos_monto_pagado_check;

ALTER TABLE libramientos
  ADD CONSTRAINT libramientos_monto_pagado_check CHECK (monto_pagado >= 0);

COMMENT ON COLUMN libramientos.monto_pagado IS
  'Suma de pagos vigentes (no anulados). Saldo pendiente = neto - monto_pagado.';

-- Backfill desde pagos existentes
UPDATE libramientos l
SET monto_pagado = COALESCE((
  SELECT SUM(p.monto)
  FROM pagos p
  WHERE p.libramiento_id = l.id
    AND p.deleted_at IS NULL
    AND p.anulado = false
), 0),
pagado = CASE
  WHEN l.anulado OR l.deleted_at IS NOT NULL THEN l.pagado
  WHEN COALESCE((
    SELECT SUM(p.monto)
    FROM pagos p
    WHERE p.libramiento_id = l.id
      AND p.deleted_at IS NULL
      AND p.anulado = false
  ), 0) >= l.neto - 0.01 THEN true
  ELSE false
END,
fecha_pago = CASE
  WHEN COALESCE((
    SELECT SUM(p.monto)
    FROM pagos p
    WHERE p.libramiento_id = l.id
      AND p.deleted_at IS NULL
      AND p.anulado = false
  ), 0) >= l.neto - 0.01 THEN COALESCE(
    (
      SELECT MAX(p.fecha_pago)
      FROM pagos p
      WHERE p.libramiento_id = l.id
        AND p.deleted_at IS NULL
        AND p.anulado = false
    ),
    l.fecha_pago
  )
  ELSE NULL
END;

CREATE INDEX IF NOT EXISTS idx_pagos_libramiento
  ON pagos (libramiento_id)
  WHERE deleted_at IS NULL AND anulado = false;
