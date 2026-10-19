-- Migración: Expedientes
-- Fecha: 2026-07-01

CREATE TABLE expediente_numeracion (
  anio INTEGER PRIMARY KEY,
  ultimo_numero INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE expedientes (
  id SERIAL PRIMARY KEY,
  numero INTEGER NOT NULL,
  anio INTEGER NOT NULL,
  letra VARCHAR(10) NOT NULL DEFAULT 'E',
  asunto TEXT NOT NULL,
  causante VARCHAR(255) NOT NULL,
  fecha_ingreso DATE NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'INICIADO'
    CHECK (estado IN ('INICIADO', 'AFECTADO', 'LIBRADO', 'PAGADO', 'ARCHIVADO')),
  anulado BOOLEAN NOT NULL DEFAULT false,
  motivo_anulacion TEXT,
  fecha_anulacion TIMESTAMPTZ,
  usuario_creacion_id INTEGER REFERENCES usuarios(id),
  usuario_modificacion_id INTEGER REFERENCES usuarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT expedientes_numero_anio_unique UNIQUE (numero, anio)
);

CREATE TABLE expediente_historial (
  id SERIAL PRIMARY KEY,
  expediente_id INTEGER NOT NULL REFERENCES expedientes(id),
  accion VARCHAR(50) NOT NULL,
  estado_anterior VARCHAR(20),
  estado_nuevo VARCHAR(20),
  observacion TEXT,
  usuario_id INTEGER REFERENCES usuarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_expedientes_numero_anio ON expedientes(numero, anio) WHERE deleted_at IS NULL;
CREATE INDEX idx_expedientes_estado ON expedientes(estado) WHERE deleted_at IS NULL;
CREATE INDEX idx_expedientes_fecha_ingreso ON expedientes(fecha_ingreso) WHERE deleted_at IS NULL;
CREATE INDEX idx_expedientes_anio ON expedientes(anio) WHERE deleted_at IS NULL;
CREATE INDEX idx_expedientes_causante ON expedientes(causante) WHERE deleted_at IS NULL;
CREATE INDEX idx_expedientes_letra ON expedientes(letra) WHERE deleted_at IS NULL;
CREATE INDEX idx_expediente_historial_expediente ON expediente_historial(expediente_id);
