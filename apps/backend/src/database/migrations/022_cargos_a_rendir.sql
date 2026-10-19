-- Cargos a rendir — etapa 1: circuito, cuenta configurable, anticipos y libramientos de anticipo
-- No se mezclan con afectaciones / libramientos / pagos normales.

-- 1) Circuito en expedientes
ALTER TABLE expedientes
  ADD COLUMN IF NOT EXISTS circuito VARCHAR(30) NOT NULL DEFAULT 'NORMAL';

ALTER TABLE expedientes
  DROP CONSTRAINT IF EXISTS expedientes_circuito_check;

ALTER TABLE expedientes
  ADD CONSTRAINT expedientes_circuito_check
  CHECK (circuito IN ('NORMAL', 'CARGO_A_RENDIR'));

CREATE INDEX IF NOT EXISTS idx_expedientes_circuito
  ON expedientes (circuito)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN expedientes.circuito IS
  'NORMAL = circuito presupuestario habitual. CARGO_A_RENDIR = anticipo / fondo a rendir.';

-- 2) Cuenta Fondo a rendir (se elige en Configuración; valor vacío hasta que la carguen)
INSERT INTO configuracion (clave, valor, descripcion)
VALUES (
  'cuenta_fondo_a_rendir_id',
  '',
  'ID de la cuenta única usada en anticipos de cargos a rendir'
)
ON CONFLICT (clave) DO NOTHING;

-- 3) Numeración diaria propia (mismo formato visual N-DDMMYY, contador aparte)
CREATE TABLE IF NOT EXISTS anticipo_numeracion_diaria (
  fecha DATE PRIMARY KEY,
  ultimo_numero INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS libramiento_anticipo_numeracion_diaria (
  fecha DATE PRIMARY KEY,
  ultimo_numero INTEGER NOT NULL DEFAULT 0
);

-- 4) Anticipos (equivalente a “afectación” del cargo; solo cuenta Fondo a rendir)
CREATE TABLE IF NOT EXISTS anticipos (
  id SERIAL PRIMARY KEY,
  numero INTEGER NOT NULL,
  anio INTEGER NOT NULL,
  fecha DATE NOT NULL,
  expediente_id INTEGER NOT NULL REFERENCES expedientes(id),
  cuenta_id INTEGER NOT NULL REFERENCES cuentas(id),
  destinatario VARCHAR(500) NOT NULL,
  importe NUMERIC(18, 2) NOT NULL CHECK (importe > 0),
  observaciones TEXT,
  numero_comprobante VARCHAR(100),
  anulada BOOLEAN NOT NULL DEFAULT false,
  motivo_anulacion TEXT,
  fecha_anulacion TIMESTAMPTZ,
  usuario_creacion_id INTEGER REFERENCES usuarios(id),
  usuario_modificacion_id INTEGER REFERENCES usuarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT anticipos_numero_fecha_unique UNIQUE (numero, fecha)
);

CREATE INDEX IF NOT EXISTS idx_anticipos_expediente
  ON anticipos (expediente_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_anticipos_fecha
  ON anticipos (fecha)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_anticipos_anulada
  ON anticipos (anulada)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE anticipos IS
  'Anticipo de cargo a rendir. Imputa únicamente la cuenta Fondo a rendir configurada.';

-- 5) Libramientos de anticipo (aislados de libramientos normales)
CREATE TABLE IF NOT EXISTS libramientos_anticipo (
  id SERIAL PRIMARY KEY,
  numero INTEGER NOT NULL,
  anio INTEGER NOT NULL,
  fecha DATE NOT NULL,
  expediente_id INTEGER NOT NULL REFERENCES expedientes(id),
  anticipo_id INTEGER NOT NULL REFERENCES anticipos(id),
  beneficiario VARCHAR(500) NOT NULL,
  importe NUMERIC(18, 2) NOT NULL CHECK (importe > 0),
  retenciones NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (retenciones >= 0),
  neto NUMERIC(18, 2) NOT NULL CHECK (neto >= 0),
  numero_decreto VARCHAR(80),
  observaciones TEXT,
  anulado BOOLEAN NOT NULL DEFAULT false,
  motivo_anulacion TEXT,
  fecha_anulacion TIMESTAMPTZ,
  pagado BOOLEAN NOT NULL DEFAULT false,
  monto_pagado NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (monto_pagado >= 0),
  fecha_pago DATE,
  usuario_creacion_id INTEGER REFERENCES usuarios(id),
  usuario_modificacion_id INTEGER REFERENCES usuarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT libramientos_anticipo_numero_fecha_unique UNIQUE (numero, fecha),
  CONSTRAINT libramientos_anticipo_retenciones_lte_importe CHECK (retenciones <= importe)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_libramientos_anticipo_activo
  ON libramientos_anticipo (anticipo_id)
  WHERE deleted_at IS NULL AND anulado = false;

CREATE INDEX IF NOT EXISTS idx_libramientos_anticipo_expediente
  ON libramientos_anticipo (expediente_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_libramientos_anticipo_fecha
  ON libramientos_anticipo (fecha)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE libramientos_anticipo IS
  'Libramiento del anticipo (cargo a rendir). pagado/monto_pagado quedan listos para un pago posterior.';
