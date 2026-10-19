-- Migración: Libramientos (órdenes de pago)
-- Fecha: 2026-07-01

CREATE TABLE libramiento_numeracion (
  anio INTEGER PRIMARY KEY,
  ultimo_numero INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE libramientos (
  id SERIAL PRIMARY KEY,
  numero INTEGER NOT NULL,
  anio INTEGER NOT NULL,
  fecha DATE NOT NULL,
  expediente_id INTEGER NOT NULL REFERENCES expedientes(id),
  afectacion_id INTEGER NOT NULL REFERENCES afectaciones(id),
  beneficiario VARCHAR(255) NOT NULL,
  importe NUMERIC(18, 2) NOT NULL CHECK (importe > 0),
  retenciones NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (retenciones >= 0),
  neto NUMERIC(18, 2) NOT NULL CHECK (neto >= 0),
  observaciones TEXT,
  anulado BOOLEAN NOT NULL DEFAULT false,
  motivo_anulacion TEXT,
  fecha_anulacion TIMESTAMPTZ,
  pagado BOOLEAN NOT NULL DEFAULT false,
  fecha_pago DATE,
  usuario_creacion_id INTEGER REFERENCES usuarios(id),
  usuario_modificacion_id INTEGER REFERENCES usuarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT libramientos_numero_anio_unique UNIQUE (numero, anio),
  CONSTRAINT libramientos_retenciones_lte_importe CHECK (retenciones <= importe)
);

CREATE TABLE libramiento_detalle (
  id SERIAL PRIMARY KEY,
  libramiento_id INTEGER NOT NULL REFERENCES libramientos(id) ON DELETE RESTRICT,
  afectacion_detalle_id INTEGER REFERENCES afectacion_detalle(id),
  cuenta_id INTEGER NOT NULL REFERENCES cuentas(id),
  descripcion VARCHAR(255) NOT NULL,
  importe NUMERIC(18, 2) NOT NULL CHECK (importe > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_libramientos_expediente ON libramientos(expediente_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_libramientos_afectacion ON libramientos(afectacion_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_libramientos_fecha ON libramientos(fecha) WHERE deleted_at IS NULL;
CREATE INDEX idx_libramientos_anulado ON libramientos(anulado) WHERE deleted_at IS NULL;
CREATE INDEX idx_libramiento_detalle_libramiento ON libramiento_detalle(libramiento_id);
