import { ESTADO_EXPEDIENTE_LABELS, labelEstadoExpediente } from '@/utils/format';
import type { CircuitoExpediente, EstadoExpediente } from '@/types';

const colors: Record<EstadoExpediente, string> = {
  INICIADO: 'bg-blue-100 text-blue-800 border-blue-200',
  AFECTADO: 'bg-amber-100 text-amber-800 border-amber-200',
  LIBRADO: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  PAGADO: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  ARCHIVADO: 'bg-slate-100 text-slate-600 border-slate-200',
};

interface EstadoExpedienteBadgeProps {
  estado: EstadoExpediente;
  anulado?: boolean;
  circuito?: CircuitoExpediente | string;
}

export function EstadoExpedienteBadge({ estado, anulado, circuito }: EstadoExpedienteBadgeProps) {
  if (anulado) {
    return (
      <span className="inline-flex rounded border px-2 py-0.5 text-xs font-medium text-red-700 border-red-200 bg-red-50">
        Anulado
      </span>
    );
  }
  return (
    <span className={`inline-flex rounded border px-1.5 py-0.5 text-[11px] font-medium ${colors[estado]}`}>
      {labelEstadoExpediente(estado, circuito) || ESTADO_EXPEDIENTE_LABELS[estado]}
    </span>
  );
}
