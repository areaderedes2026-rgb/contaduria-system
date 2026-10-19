import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getNavigationReturn } from '@/utils/navigationReturn';

interface DetailBackNavProps {
  /** Listado del módulo (afectaciones, libramientos, etc.). */
  listTo: string;
  /** Etiqueta del listado, ej. "Volver a afectaciones". */
  listLabel: string;
}

/**
 * Navegación de vuelta en páginas de detalle.
 * Si se llegó desde otro detalle (ej. cuenta), muestra "Volver" primero
 * y el acceso al listado como opción secundaria.
 */
export function DetailBackNav({ listTo, listLabel }: DetailBackNavProps) {
  const location = useLocation();
  const from = getNavigationReturn(location.state);

  if (!from) {
    return (
      <Link
        to={listTo}
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-primary-600"
      >
        <ArrowLeft size={14} />
        {listLabel}
      </Link>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <Link
        to={from.to}
        className="inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline"
      >
        <ArrowLeft size={16} />
        {from.label}
      </Link>
      <Link
        to={listTo}
        className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-primary-600"
      >
        {listLabel}
      </Link>
    </div>
  );
}
