-- Migración: Plan de Cuentas presupuestarias
-- Fecha: 2026-06-25

CREATE TABLE cuentas (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(50) NOT NULL,
  descripcion VARCHAR(255) NOT NULL,
  tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('RECURSO', 'GASTO', 'PATRIMONIAL')),
  cuenta_padre_id INTEGER REFERENCES cuentas(id),
  nivel INTEGER NOT NULL DEFAULT 1,
  saldo_inicial NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (saldo_inicial >= 0),
  saldo_afectado NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (saldo_afectado >= 0),
  estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVA' CHECK (estado IN ('ACTIVA', 'INACTIVA')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT cuentas_saldo_disponible_check CHECK (saldo_inicial >= saldo_afectado),
  CONSTRAINT cuentas_codigo_unique UNIQUE (codigo)
);

CREATE INDEX idx_cuentas_codigo ON cuentas(codigo) WHERE deleted_at IS NULL;
CREATE INDEX idx_cuentas_padre ON cuentas(cuenta_padre_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_cuentas_tipo ON cuentas(tipo) WHERE deleted_at IS NULL;
CREATE INDEX idx_cuentas_estado ON cuentas(estado) WHERE deleted_at IS NULL;
CREATE INDEX idx_cuentas_descripcion ON cuentas USING gin (to_tsvector('spanish', descripcion));
