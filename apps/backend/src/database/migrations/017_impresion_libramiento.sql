-- Plantilla de impresión overlay para libramientos (formulario preimpreso A4)

INSERT INTO configuracion (clave, valor, descripcion)
VALUES (
  'impresion_libramiento',
  '{}',
  'Calibración de impresión de libramientos sobre formulario preimpreso (posiciones en mm)'
)
ON CONFLICT (clave) DO NOTHING;
