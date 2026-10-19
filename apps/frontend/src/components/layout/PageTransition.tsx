import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Entrada suave del contenido al cambiar de ruta.
 * Solo depende del pathname (no de query) para no animar filtros.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  return (
    <div key={pathname} className="page-transition-enter">
      {children}
    </div>
  );
}
