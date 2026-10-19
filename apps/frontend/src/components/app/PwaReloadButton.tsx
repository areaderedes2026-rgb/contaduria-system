import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { hardReloadApp, isStandaloneDisplay } from '@/lib/displayMode';

/**
 * Botón fijo de recarga, siempre visible en modo PWA instalada
 * (también útil si la sesión/API se cuelga).
 */
export function PwaReloadButton() {
  const [visible, setVisible] = useState(() => isStandaloneDisplay());

  useEffect(() => {
    const mq = window.matchMedia('(display-mode: standalone)');
    const sync = () => setVisible(isStandaloneDisplay());
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => hardReloadApp()}
      title="Recargar aplicación"
      aria-label="Recargar aplicación"
      className="fixed bottom-4 right-4 z-120 flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-md backdrop-blur-sm transition hover:bg-slate-50 hover:text-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 active:scale-95"
    >
      <RefreshCw size={18} strokeWidth={2.25} />
    </button>
  );
}
