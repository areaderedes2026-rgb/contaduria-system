-- Historial de cambios del plan de cuentas (ajustes de saldo, ediciones, estado)

CREATE TABLE cuenta_historial (
  id SERIAL PRIMARY KEY,
  cuenta_id INTEGER NOT NULL REFERENCES cuentas(id),
  accion VARCHAR(50) NOT NULL,
  campo VARCHAR(50),
  valor_anterior TEXT,
  valor_nuevo TEXT,
  observacion TEXT,
  usuario_id INTEGER REFERENCES usuarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cuenta_historial_cuenta ON cuenta_historial(cuenta_id);
CREATE INDEX idx_cuenta_historial_created ON cuenta_historial(created_at DESC);
