-- Migración: Pagos (registro de pagos de libramientos)
-- Fecha: 2026-07-01

CREATE TABLE pago_numeracion (
  anio INTEGER PRIMARY KEY,
  ultimo_numero INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE pagos (
  id SERIAL PRIMARY KEY,
  numero INTEGER NOT NULL,
  anio INTEGER NOT NULL,
  fecha_pago DATE NOT NULL,
  libramiento_id INTEGER NOT NULL REFERENCES libramientos(id),
  expediente_id INTEGER NOT NULL REFERENCES expedientes(id),
  beneficiario VARCHAR(255) NOT NULL,
  monto NUMERIC(18, 2) NOT NULL CHECK (monto > 0),
  medio_pago VARCHAR(20) NOT NULL CHECK (medio_pago IN ('EFECTIVO', 'TRANSFERENCIA', 'CHEQUE', 'OTRO')),
  numero_comprobante VARCHAR(100),
  banco VARCHAR(150),
  observaciones TEXT,
  anulado BOOLEAN NOT NULL DEFAULT false,
  motivo_anulacion TEXT,
  fecha_anulacion TIMESTAMPTZ,
  usuario_registro_id INTEGER REFERENCES usuarios(id),
  usuario_modificacion_id INTEGER REFERENCES usuarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT pagos_numero_anio_unique UNIQUE (numero, anio)
);

CREATE UNIQUE INDEX idx_pagos_libramiento_activo
  ON pagos(libramiento_id)
  WHERE deleted_at IS NULL AND anulado = false;

CREATE INDEX idx_pagos_expediente ON pagos(expediente_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_pagos_fecha ON pagos(fecha_pago) WHERE deleted_at IS NULL;
CREATE INDEX idx_pagos_anulado ON pagos(anulado) WHERE deleted_at IS NULL;
CREATE INDEX idx_pagos_medio ON pagos(medio_pago) WHERE deleted_at IS NULL;
