-- Numeración anual (número/año) para afectaciones, libramientos, anticipos
-- y libramientos de anticipo. Deja de usarse el correlativo diario N-DDMMYY.
-- Los documentos existentes se reordenan por año (fecha, luego id) para que
-- el número sea único dentro del año.

-- Afectaciones
ALTER TABLE afectaciones DROP CONSTRAINT IF EXISTS afectaciones_numero_fecha_unique;
ALTER TABLE afectaciones DROP CONSTRAINT IF EXISTS afectaciones_numero_anio_unique;

WITH ordenados AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY EXTRACT(YEAR FROM fecha)::INTEGER
           ORDER BY fecha, id
         ) AS nuevo_numero
  FROM afectaciones
)
UPDATE afectaciones a
SET numero = o.nuevo_numero,
    anio = EXTRACT(YEAR FROM a.fecha)::INTEGER,
    updated_at = NOW()
FROM ordenados o
WHERE a.id = o.id;

ALTER TABLE afectaciones
  ADD CONSTRAINT afectaciones_numero_anio_unique UNIQUE (numero, anio);

CREATE TABLE IF NOT EXISTS afectacion_numeracion (
  anio INTEGER PRIMARY KEY,
  ultimo_numero INTEGER NOT NULL DEFAULT 0
);

INSERT INTO afectacion_numeracion (anio, ultimo_numero)
SELECT anio, MAX(numero)
FROM afectaciones
GROUP BY anio
ON CONFLICT (anio) DO UPDATE
SET ultimo_numero = GREATEST(afectacion_numeracion.ultimo_numero, EXCLUDED.ultimo_numero);

DROP TABLE IF EXISTS afectacion_numeracion_diaria;

-- Libramientos
ALTER TABLE libramientos DROP CONSTRAINT IF EXISTS libramientos_numero_fecha_unique;
ALTER TABLE libramientos DROP CONSTRAINT IF EXISTS libramientos_numero_anio_unique;

WITH ordenados AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY EXTRACT(YEAR FROM fecha)::INTEGER
           ORDER BY fecha, id
         ) AS nuevo_numero
  FROM libramientos
)
UPDATE libramientos l
SET numero = o.nuevo_numero,
    anio = EXTRACT(YEAR FROM l.fecha)::INTEGER,
    updated_at = NOW()
FROM ordenados o
WHERE l.id = o.id;

ALTER TABLE libramientos
  ADD CONSTRAINT libramientos_numero_anio_unique UNIQUE (numero, anio);

CREATE TABLE IF NOT EXISTS libramiento_numeracion (
  anio INTEGER PRIMARY KEY,
  ultimo_numero INTEGER NOT NULL DEFAULT 0
);

INSERT INTO libramiento_numeracion (anio, ultimo_numero)
SELECT anio, MAX(numero)
FROM libramientos
GROUP BY anio
ON CONFLICT (anio) DO UPDATE
SET ultimo_numero = GREATEST(libramiento_numeracion.ultimo_numero, EXCLUDED.ultimo_numero);

DROP TABLE IF EXISTS libramiento_numeracion_diaria;

-- Anticipos
ALTER TABLE anticipos DROP CONSTRAINT IF EXISTS anticipos_numero_fecha_unique;
ALTER TABLE anticipos DROP CONSTRAINT IF EXISTS anticipos_numero_anio_unique;

WITH ordenados AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY EXTRACT(YEAR FROM fecha)::INTEGER
           ORDER BY fecha, id
         ) AS nuevo_numero
  FROM anticipos
)
UPDATE anticipos a
SET numero = o.nuevo_numero,
    anio = EXTRACT(YEAR FROM a.fecha)::INTEGER,
    updated_at = NOW()
FROM ordenados o
WHERE a.id = o.id;

ALTER TABLE anticipos
  ADD CONSTRAINT anticipos_numero_anio_unique UNIQUE (numero, anio);

CREATE TABLE IF NOT EXISTS anticipo_numeracion (
  anio INTEGER PRIMARY KEY,
  ultimo_numero INTEGER NOT NULL DEFAULT 0
);

INSERT INTO anticipo_numeracion (anio, ultimo_numero)
SELECT anio, MAX(numero)
FROM anticipos
GROUP BY anio
ON CONFLICT (anio) DO UPDATE
SET ultimo_numero = GREATEST(anticipo_numeracion.ultimo_numero, EXCLUDED.ultimo_numero);

DROP TABLE IF EXISTS anticipo_numeracion_diaria;

-- Libramientos de anticipo
ALTER TABLE libramientos_anticipo DROP CONSTRAINT IF EXISTS libramientos_anticipo_numero_fecha_unique;
ALTER TABLE libramientos_anticipo DROP CONSTRAINT IF EXISTS libramientos_anticipo_numero_anio_unique;

WITH ordenados AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY EXTRACT(YEAR FROM fecha)::INTEGER
           ORDER BY fecha, id
         ) AS nuevo_numero
  FROM libramientos_anticipo
)
UPDATE libramientos_anticipo l
SET numero = o.nuevo_numero,
    anio = EXTRACT(YEAR FROM l.fecha)::INTEGER,
    updated_at = NOW()
FROM ordenados o
WHERE l.id = o.id;

ALTER TABLE libramientos_anticipo
  ADD CONSTRAINT libramientos_anticipo_numero_anio_unique UNIQUE (numero, anio);

CREATE TABLE IF NOT EXISTS libramiento_anticipo_numeracion (
  anio INTEGER PRIMARY KEY,
  ultimo_numero INTEGER NOT NULL DEFAULT 0
);

INSERT INTO libramiento_anticipo_numeracion (anio, ultimo_numero)
SELECT anio, MAX(numero)
FROM libramientos_anticipo
GROUP BY anio
ON CONFLICT (anio) DO UPDATE
SET ultimo_numero = GREATEST(libramiento_anticipo_numeracion.ultimo_numero, EXCLUDED.ultimo_numero);

DROP TABLE IF EXISTS libramiento_anticipo_numeracion_diaria;
