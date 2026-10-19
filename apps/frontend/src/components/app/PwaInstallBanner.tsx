import { useState } from 'react';
import { Check, Download, MonitorSmartphone, Shield, Share, X } from 'lucide-react';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import { Button } from '@/components/ui/Button';

const BENEFITS = [
  {
    icon: MonitorSmartphone,
    text: 'Acceso directo como aplicación de escritorio o móvil',
  },
  {
    icon: Shield,
    text: 'Misma seguridad de sesión: tus datos no se almacenan en el dispositivo',
  },
  {
    icon: Download,
    text: 'Actualizaciones controladas y arranque más ágil',
  },
] as const;

/**
 * Invitación profesional a instalar la PWA (Chrome/Edge/Android)
 * e instrucciones claras en iOS/Safari.
 */
export function PwaInstallBanner() {
  const { visible, canInstall, installing, install, dismiss } = usePwaInstall();
  const [busy, setBusy] = useState(false);

  if (!visible) return null;

  const handleInstall = async () => {
    setBusy(true);
    try {
      await install();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex justify-center p-4 sm:justify-end sm:p-5"
      role="dialog"
      aria-modal="false"
      aria-labelledby="pwa-install-title"
      aria-describedby="pwa-install-desc"
    >
      <div className="pointer-events-auto w-full max-w-[26rem] overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_12px_40px_-8px_rgba(15,23,42,0.28)]">
        <div className="relative bg-gradient-to-br from-primary-950 via-primary-900 to-primary-800 px-5 pb-4 pt-5 text-white">
          <button
            type="button"
            onClick={dismiss}
            className="absolute right-3 top-3 rounded-lg p-1.5 text-primary-200/80 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-3.5 pr-8">
            <img
              src="/icons/icon-192.png"
              alt=""
              width={52}
              height={52}
              className="h-[52px] w-[52px] rounded-xl shadow-lg ring-1 ring-white/20"
              draggable={false}
            />
            <div className="min-w-0">
              <p id="pwa-install-title" className="text-base font-semibold tracking-tight">
                Instalar Contaduria
              </p>
              <p className="mt-0.5 text-sm text-primary-200">
                Sistema municipal — acceso institucional
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 py-4">
          <p id="pwa-install-desc" className="text-sm leading-relaxed text-slate-600">
            {canInstall
              ? 'Instalá la aplicación en este equipo para trabajar con una experiencia más estable y profesional.'
              : 'En iPhone o iPad podés agregarla a la pantalla de inicio desde Safari.'}
          </p>

          {canInstall ? (
            <ul className="mt-3.5 space-y-2.5">
              {BENEFITS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700">
                    <Icon size={12} aria-hidden />
                  </span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <ol className="mt-3.5 list-decimal space-y-1.5 pl-4 text-sm text-slate-700">
              <li>
                Tocá <Share size={14} className="mx-0.5 inline align-text-bottom text-primary-700" />{' '}
                <strong>Compartir</strong>
              </li>
              <li>
                Elegí <strong>Agregar a pantalla de inicio</strong>
              </li>
              <li>
                Confirmá con <strong>Agregar</strong>
              </li>
            </ol>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {canInstall && (
              <Button
                type="button"
                size="sm"
                onClick={() => void handleInstall()}
                loading={busy || installing}
                className="min-w-[8.5rem]"
              >
                <Download size={15} />
                Instalar ahora
              </Button>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={dismiss} disabled={busy}>
              Ahora no
            </Button>
          </div>

          <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-snug text-slate-400">
            <Check size={12} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden />
            La instalación es local en este dispositivo. La autenticación y los datos continúan
            protegidos por tu sesión institucional.
          </p>
        </div>
      </div>
    </div>
  );
}
