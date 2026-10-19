import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { NuevaLibramientoModal } from '@/components/libramientos/NuevaLibramientoModal';
import { NuevoLibramientoAnticipoModal } from '@/components/libramientos/NuevoLibramientoAnticipoModal';

export type LibramientoOrigenTab = 'afectacion' | 'anticipo';

interface NuevoLibramientoUnificadoModalProps {
  open: boolean;
  onClose: () => void;
  initialTab?: LibramientoOrigenTab;
}

function OrigenTabs({
  value,
  onChange,
}: {
  value: LibramientoOrigenTab;
  onChange: (next: LibramientoOrigenTab) => void;
}) {
  const item = (id: LibramientoOrigenTab, label: string) => {
    const active = value === id;
    return (
      <button
        type="button"
        onClick={() => onChange(id)}
        aria-pressed={active}
        className={`rounded px-2.5 py-1 text-sm font-medium transition ${
          active
            ? 'bg-white text-primary-950 shadow-sm'
            : 'text-primary-100 hover:text-white'
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="inline-flex rounded-md bg-white/10 p-0.5" role="group" aria-label="Tipo de libramiento">
      {item('afectacion', 'Afectación')}
      {item('anticipo', 'Anticipo')}
    </div>
  );
}

export function NuevoLibramientoUnificadoModal({
  open,
  onClose,
  initialTab = 'afectacion',
}: NuevoLibramientoUnificadoModalProps) {
  const [tab, setTab] = useState<LibramientoOrigenTab>(initialTab);

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
  }, [open, initialTab]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nuevo libramiento"
      size="2xl"
      flush
      headerExtra={<OrigenTabs value={tab} onChange={setTab} />}
    >
      {tab === 'afectacion' ? (
        <NuevaLibramientoModal embedded open={open} onClose={onClose} />
      ) : (
        <NuevoLibramientoAnticipoModal embedded open={open} onClose={onClose} />
      )}
    </Modal>
  );
}
