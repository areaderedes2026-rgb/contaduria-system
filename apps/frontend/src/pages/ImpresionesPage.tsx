import { useState } from 'react';
import { ImpresionAfectacionPanel } from '@/pages/impresiones/ImpresionAfectacionPanel';
import { ImpresionLibramientoPanel } from '@/pages/impresiones/ImpresionLibramientoPanel';

type TabId = 'afectacion' | 'libramiento';

const TABS: { id: TabId; label: string }[] = [
  { id: 'afectacion', label: 'Afectaciones' },
  { id: 'libramiento', label: 'Libramientos' },
];

export function ImpresionesPage() {
  const [tab, setTab] = useState<TabId>('afectacion');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Impresiones</h1>
        <p className="mt-1 text-sm text-slate-600">
          Plantillas A4. En afectaciones podés mover cada bloque en la hoja y cargar una firma/sello
          opcional.
        </p>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-t-md px-3 py-2 text-sm font-medium transition ${
              tab === t.id
                ? 'border border-b-0 border-slate-300 bg-white text-primary-800'
                : 'text-slate-600 hover:bg-white/70'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'afectacion' && <ImpresionAfectacionPanel />}
      {tab === 'libramiento' && <ImpresionLibramientoPanel />}
    </div>
  );
}
