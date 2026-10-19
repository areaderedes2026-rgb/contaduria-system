-- Configuración de plantillas de impresión (JSON por tipo de documento)

INSERT INTO configuracion (clave, valor, descripcion)
VALUES (
  'impresion_afectacion',
  '{
    "organismo": "Municipalidad de Trancas",
    "tituloDocumento": "Afectación Presupuestaria",
    "mostrarLogo": true,
    "logoDataUrl": null,
    "etiquetaNumero": "N°",
    "usarNumeroCompleto": true,
    "paddingNumero": 10,
    "etiquetaExpediente": "Expediente/s",
    "etiquetaDestinatario": "Destinatario",
    "textoIntroduccion": "Sr. Contador General:\\nInformo a Ud. que existen los créditos presupuestarios suficientes para afrontar la erogación que por estos actuados se tramita, la que sería registrada en:",
    "pieDepartamento": "Departamento Contaduría",
    "mostrarFechaPie": true,
    "formatoFecha": "dd/mm/yy",
    "columnaCodigo": "Código",
    "columnaDenominacion": "Denominación",
    "columnaImporte": "Importe",
    "etiquetaTotal": "Total"
  }',
  'Plantilla de impresión de afectaciones presupuestarias'
)
ON CONFLICT (clave) DO NOTHING;

INSERT INTO permisos (codigo, modulo, descripcion)
VALUES
  ('configuracion:read', 'configuracion', 'Ver configuración del sistema'),
  ('configuracion:write', 'configuracion', 'Modificar configuración del sistema')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permisos p
WHERE r.nombre = 'admin'
  AND p.codigo IN ('configuracion:read', 'configuracion:write')
ON CONFLICT DO NOTHING;
