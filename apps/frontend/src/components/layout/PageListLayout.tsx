import { useState, type ReactNode } from 'react';
import { CollapsibleStats } from '@/components/layout/CollapsibleStats';

interface PageListLayoutProps {
  /** Tarjetas de resumen u otro bloque fijo arriba. */
  stats?: ReactNode;
  /** Normalmente un SpreadsheetShell con fillHeight. */
  children: ReactNode;
  /**
   * Si true, las tarjetas quedan ocultas por defecto y se despliegan
   * desde arriba con un control centrado (“Mostrar datos”).
   * Usar en todos los listados con tarjetas de resumen.
   */
  collapsibleStats?: boolean;
  /** Estado inicial del panel (solo con collapsibleStats). */
  statsDefaultOpen?: boolean;
  statsShowLabel?: string;
  statsHideLabel?: string;
}

/**
 * Layout de listados: alto de viewport, scroll único en la tabla.
 * Header fijo (4rem) + padding del main (3rem) se restan del alto.
 */
export function PageListLayout({
  stats,
  children,
  collapsibleStats = false,
  statsDefaultOpen = false,
  statsShowLabel = 'Mostrar datos',
  statsHideLabel = 'Ocultar datos',
}: PageListLayoutProps) {
  const [statsOpen, setStatsOpen] = useState(statsDefaultOpen);
  const useCollapse = Boolean(collapsibleStats && stats);

  return (
    <div
      className={`flex flex-col overflow-hidden ${
        collapsibleStats
          ? // Compensa el padding-top del main (p-6); el aire del toggle lo pone CollapsibleStats
            '-mt-6 h-[calc(100dvh-4rem-1.5rem)]'
          : 'h-[calc(100dvh-4rem-3rem)]'
      } ${useCollapse && !statsOpen ? 'gap-0' : 'gap-4'}`}
    >
      {stats ? (
        useCollapse ? (
          <CollapsibleStats
            defaultOpen={statsDefaultOpen}
            showLabel={statsShowLabel}
            hideLabel={statsHideLabel}
            onOpenChange={setStatsOpen}
          >
            {stats}
          </CollapsibleStats>
        ) : (
          <div className="shrink-0">{stats}</div>
        )
      ) : null}
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
