-- El expediente nace sin trámite definido. Afectación o anticipo se eligen después.

ALTER TABLE expedientes
  DROP CONSTRAINT IF EXISTS expedientes_circuito_check;

ALTER TABLE expedientes
  ALTER COLUMN circuito SET DEFAULT 'PENDIENTE';

ALTER TABLE expedientes
  ADD CONSTRAINT expedientes_circuito_check
  CHECK (circuito IN ('PENDIENTE', 'NORMAL', 'CARGO_A_RENDIR'));

COMMENT ON COLUMN expedientes.circuito IS
  'PENDIENTE = aún no se eligió el trámite. NORMAL = afectación. CARGO_A_RENDIR = anticipo.';
