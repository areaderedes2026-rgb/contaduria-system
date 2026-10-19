-- Numeración correlativa diaria de libramientos: N-DDMMYY (igual que afectaciones)
-- Más número de decreto/resolución opcional

CREATE TABLE IF NOT EXISTS libramiento_numeracion_diaria (
  fecha DATE PRIMARY KEY,
  ultimo_numero INTEGER NOT NULL DEFAULT 0
);

-- Reasignar correlativos por día (orden histórico por id)
WITH ordenados AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY fecha ORDER BY id) AS nuevo_numero
  FROM libramientos
  WHERE deleted_at IS NULL
)
UPDATE libramientos l
SET numero = o.nuevo_numero,
    anio = EXTRACT(YEAR FROM l.fecha)::INTEGER,
    updated_at = NOW()
FROM ordenados o
WHERE l.id = o.id;

ALTER TABLE libramientos DROP CONSTRAINT IF EXISTS libramientos_numero_anio_unique;

ALTER TABLE libramientos
  ADD CONSTRAINT libramientos_numero_fecha_unique UNIQUE (numero, fecha);

INSERT INTO libramiento_numeracion_diaria (fecha, ultimo_numero)
SELECT fecha, MAX(numero)
FROM libramientos
WHERE deleted_at IS NULL
GROUP BY fecha
ON CONFLICT (fecha) DO UPDATE
SET ultimo_numero = GREATEST(libramiento_numeracion_diaria.ultimo_numero, EXCLUDED.ultimo_numero);

DROP TABLE IF EXISTS libramiento_numeracion;

ALTER TABLE libramientos
  ADD COLUMN IF NOT EXISTS numero_decreto VARCHAR(80);

COMMENT ON COLUMN libramientos.numero_decreto IS 'Nº de Decreto u Resolución (opcional)';
