-- Numeración correlativa diaria de afectaciones: N-DDMMYY
-- Ejemplo: 1-230726, 2-230726; al día siguiente vuelve a 1-240726

CREATE TABLE IF NOT EXISTS afectacion_numeracion_diaria (
  fecha DATE PRIMARY KEY,
  ultimo_numero INTEGER NOT NULL DEFAULT 0
);

-- Reasignar correlativos por día (orden histórico por id)
WITH ordenados AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY fecha ORDER BY id) AS nuevo_numero
  FROM afectaciones
  WHERE deleted_at IS NULL
)
UPDATE afectaciones a
SET numero = o.nuevo_numero,
    anio = EXTRACT(YEAR FROM a.fecha)::INTEGER,
    updated_at = NOW()
FROM ordenados o
WHERE a.id = o.id;

ALTER TABLE afectaciones DROP CONSTRAINT IF EXISTS afectaciones_numero_anio_unique;

ALTER TABLE afectaciones
  ADD CONSTRAINT afectaciones_numero_fecha_unique UNIQUE (numero, fecha);

INSERT INTO afectacion_numeracion_diaria (fecha, ultimo_numero)
SELECT fecha, MAX(numero)
FROM afectaciones
WHERE deleted_at IS NULL
GROUP BY fecha
ON CONFLICT (fecha) DO UPDATE
SET ultimo_numero = GREATEST(afectacion_numeracion_diaria.ultimo_numero, EXCLUDED.ultimo_numero);

DROP TABLE IF EXISTS afectacion_numeracion;
