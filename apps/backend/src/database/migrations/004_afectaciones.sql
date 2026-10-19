-- Migración: Afectaciones presupuestarias
-- Fecha: 2026-07-01

CREATE TABLE afectacion_numeracion (
  anio INTEGER PRIMARY KEY,
  ultimo_numero INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE afectaciones (
  id SERIAL PRIMARY KEY,
  numero INTEGER NOT NULL,
  anio INTEGER NOT NULL,
  fecha DATE NOT NULL,
  expediente_id INTEGER NOT NULL REFERENCES expedientes(id),
  destinatario VARCHAR(255) NOT NULL,
  importe_total NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (importe_total >= 0),
  anulada BOOLEAN NOT NULL DEFAULT false,
  motivo_anulacion TEXT,
  fecha_anulacion TIMESTAMPTZ,
  usuario_creacion_id INTEGER REFERENCES usuarios(id),
  usuario_modificacion_id INTEGER REFERENCES usuarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT afectaciones_numero_anio_unique UNIQUE (numero, anio)
);

CREATE TABLE afectacion_detalle (
  id SERIAL PRIMARY KEY,
  afectacion_id INTEGER NOT NULL REFERENCES afectaciones(id) ON DELETE RESTRICT,
  cuenta_id INTEGER NOT NULL REFERENCES cuentas(id),
  descripcion VARCHAR(255) NOT NULL,
  importe NUMERIC(18, 2) NOT NULL CHECK (importe > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_afectaciones_expediente ON afectaciones(expediente_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_afectaciones_fecha ON afectaciones(fecha) WHERE deleted_at IS NULL;
CREATE INDEX idx_afectaciones_anio ON afectaciones(anio) WHERE deleted_at IS NULL;
CREATE INDEX idx_afectaciones_anulada ON afectaciones(anulada) WHERE deleted_at IS NULL;
CREATE INDEX idx_afectacion_detalle_afectacion ON afectacion_detalle(afectacion_id);
CREATE INDEX idx_afectacion_detalle_cuenta ON afectacion_detalle(cuenta_id);
