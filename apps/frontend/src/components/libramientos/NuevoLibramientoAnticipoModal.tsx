import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { AfectacionLibramientoCombobox } from '@/components/libramientos/AfectacionLibramientoCombobox';
import {
  SpreadsheetFormError,
  SpreadsheetFormFooter,
  SpreadsheetFieldGrid,
  cellInput,
  type SpreadsheetField,
} from '@/components/spreadsheet';
import {
  createLibramientoAnticipo,
  getAnticiposDisponiblesLibramiento,
  getSiguienteNumeroLibramientoAnticipo,
} from '@/services/libramientosAnticipo.service';
import { ApiClientError } from '@/services/api';
import {
  formatCurrency,
  formatLibramientoNumero,
  parseImporteAR,
} from '@/utils/format';
import { ImporteInput } from '@/components/ui/ImporteInput';
import type { AfectacionDisponibleLibramiento, AnticipoDisponibleLibramiento } from '@/types';

const today = new Date().toISOString().slice(0, 10);

function toAfectacionShape(a: AnticipoDisponibleLibramiento): AfectacionDisponibleLibramiento {
  return {
    id: a.id,
    numero: 0,
    fecha: a.fecha,
    numero_completo: a.numero_completo,
    expediente_id: a.expediente_id,
    expediente_numero: a.expediente_numero,
    expediente_detalle: '',
    destinatario: a.destinatario,
    proveedor_nombre: a.destinatario,
    importe_total: a.importe,
  };
}

interface FormState {
  numero: string;
  fecha: string;
  beneficiario: string;
  retenciones: string;
  numeroDecreto: string;
  observaciones: string;
}

const emptyForm = (): FormState => ({
  numero: '',
  fecha: today,
  beneficiario: '',
  retenciones: '',
  numeroDecreto: '',
  observaciones: '',
});

interface NuevoLibramientoAnticipoModalProps {
  open: boolean;
  onClose: () => void;
  anticipoId?: number;
  stackLevel?: number;
  /** Sin ventana propia (p. ej. pestaña dentro del modal unificado). */
  embedded?: boolean;
}

export function NuevoLibramientoAnticipoModal({
  open,
  onClose,
  anticipoId,
  stackLevel = 0,
  embedded = false,
}: NuevoLibramientoAnticipoModalProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [anticipo, setAnticipo] = useState<AnticipoDisponibleLibramiento | null>(null);
  const [formError, setFormError] = useState('');
  const [numeroManual, setNumeroManual] = useState(false);

  const { data: anticipos = [], isLoading } = useQuery({
    queryKey: ['anticipos-disponibles-libramiento'],
    queryFn: getAnticiposDisponiblesLibramiento,
    enabled: open,
  });

  const anioForm = form.fecha ? Number(form.fecha.slice(0, 4)) : new Date().getFullYear();

  const { data: siguienteNumero, isLoading: loadingNumero } = useQuery({
    queryKey: ['siguiente-numero-libramiento-anticipo', anioForm],
    queryFn: () => getSiguienteNumeroLibramientoAnticipo(anioForm),
    enabled: open && !!form.fecha,
  });

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm());
    setAnticipo(null);
    setFormError('');
    setNumeroManual(false);
  }, [open]);

  useEffect(() => {
    if (!open || !anticipoId || anticipos.length === 0) return;
    const found = anticipos.find((a) => a.id === anticipoId) ?? null;
    if (found) setAnticipo(found);
  }, [open, anticipoId, anticipos]);

  useEffect(() => {
    if (!anticipo) return;
    setForm((prev) => ({
      ...prev,
      beneficiario: prev.beneficiario || anticipo.destinatario,
    }));
  }, [anticipo]);

  useEffect(() => {
    if (!open || numeroManual || !siguienteNumero) return;
    setForm((prev) => ({ ...prev, numero: String(siguienteNumero.siguiente) }));
  }, [open, numeroManual, siguienteNumero]);

  const retencionesNum = form.retenciones ? parseImporteAR(form.retenciones) : 0;
  const neto = anticipo
    ? Number((anticipo.importe - (Number.isNaN(retencionesNum) ? 0 : retencionesNum)).toFixed(2))
    : 0;

  const previewNumero =
    form.numero && form.fecha && parseInt(form.numero, 10) > 0
      ? formatLibramientoNumero(parseInt(form.numero, 10), form.fecha)
      : '—';

  const createMutation = useMutation({
    mutationFn: () =>
      createLibramientoAnticipo({
        fecha: form.fecha,
        expediente_id: anticipo!.expediente_id,
        anticipo_id: anticipo!.id,
        beneficiario: form.beneficiario.trim(),
        numero: form.numero ? parseInt(form.numero, 10) : undefined,
        importe: anticipo!.importe,
        retenciones: Number.isNaN(retencionesNum) ? 0 : retencionesNum,
        numero_decreto: form.numeroDecreto.trim() || null,
        observaciones: form.observaciones.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['libramientos'] });
      queryClient.invalidateQueries({ queryKey: ['libramientos-resumen'] });
      queryClient.invalidateQueries({ queryKey: ['libramientos-anticipo'] });
      queryClient.invalidateQueries({ queryKey: ['anticipos'] });
      queryClient.invalidateQueries({ queryKey: ['anticipos-disponibles-libramiento'] });
      queryClient.invalidateQueries({ queryKey: ['expedientes'] });
      queryClient.invalidateQueries({ queryKey: ['expediente'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      onClose();
    },
    onError: (err) => {
      setFormError(err instanceof ApiClientError ? err.message : 'Error al emitir el libramiento');
    },
  });

  const canSubmit =
    !!anticipo &&
    form.fecha &&
    form.beneficiario.trim() &&
    form.numero &&
    parseInt(form.numero, 10) > 0 &&
    !Number.isNaN(retencionesNum) &&
    retencionesNum >= 0 &&
    retencionesNum <= anticipo.importe + 0.001 &&
    neto >= 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      setFormError('Complete anticipo, beneficiario y número');
      return;
    }
    setFormError('');
    createMutation.mutate();
  };

  const comboValue = useMemo(
    () => (anticipo ? toAfectacionShape(anticipo) : null),
    [anticipo]
  );

  const fields: SpreadsheetField[] = [
    {
      label: 'Anticipo',
      children: (
        <AfectacionLibramientoCombobox
          value={comboValue}
          onChange={(sel) => {
            const found = sel ? anticipos.find((a) => a.id === sel.id) ?? null : null;
            setAnticipo(found);
          }}
          options={anticipos.map(toAfectacionShape)}
          loading={isLoading}
          disabled={!!anticipoId}
          variant="cell"
        />
      ),
    },
    {
      label: 'Número',
      children: (
        <div className="flex items-stretch">
          <input
            type="number"
            min="1"
            value={form.numero}
            onChange={(e) => {
              setNumeroManual(true);
              setForm({ ...form, numero: e.target.value });
            }}
            required
            className={`${cellInput} font-mono`}
          />
          {numeroManual && (
            <button
              type="button"
              onClick={() => {
                setNumeroManual(false);
                if (siguienteNumero) {
                  setForm((prev) => ({ ...prev, numero: String(siguienteNumero.siguiente) }));
                }
              }}
              className="shrink-0 border-l border-slate-300 bg-slate-50 px-3 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              Auto
            </button>
          )}
        </div>
      ),
    },
    {
      label: 'Fecha',
      children: (
        <input
          type="date"
          value={form.fecha}
          onChange={(e) => setForm({ ...form, fecha: e.target.value })}
          required
          className={cellInput}
        />
      ),
    },
    {
      label: 'Beneficiario',
      children: (
        <input
          value={form.beneficiario}
          onChange={(e) => setForm({ ...form, beneficiario: e.target.value })}
          className={cellInput}
          required
        />
      ),
    },
    {
      label: 'Importe',
      children: (
        <div className="px-2 py-1.5 text-sm font-medium tabular-nums text-slate-800">
          {anticipo ? formatCurrency(anticipo.importe) : '—'}
        </div>
      ),
    },
    {
      label: 'Retenciones',
      children: (
        <ImporteInput
          value={form.retenciones}
          onChange={(retenciones) => setForm({ ...form, retenciones })}
          placeholder="0,00"
          className={cellInput}
        />
      ),
    },
    {
      label: 'Neto',
      children: (
        <div className="px-2 py-1.5 text-sm font-semibold tabular-nums text-emerald-700">
          {anticipo ? formatCurrency(neto) : '—'}
        </div>
      ),
    },
    {
      label: 'N° decreto',
      children: (
        <input
          value={form.numeroDecreto}
          onChange={(e) => setForm({ ...form, numeroDecreto: e.target.value })}
          className={cellInput}
          placeholder="Opcional"
        />
      ),
    },
    {
      label: 'Observaciones',
      alignTop: true,
      children: (
        <textarea
          value={form.observaciones}
          onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
          rows={3}
          className="w-full min-w-0 resize-none rounded-none border-0 bg-transparent px-2 py-2 text-sm text-slate-800 focus:outline-none"
        />
      ),
    },
  ];

  const formNode = (
      <form onSubmit={handleSubmit} className="flex flex-col">
        <div className="flex items-center justify-between gap-4 border-b border-slate-300 bg-[#e8eef4] px-4 py-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Número asignado
            </p>
            <p className="mt-0.5 font-mono text-2xl font-bold tracking-tight text-primary-900">
              {loadingNumero ? '…' : previewNumero}
            </p>
          </div>
          {anticipo && (
            <p className="hidden text-right text-xs text-slate-500 sm:block">
              Anticipo {anticipo.numero_completo}
              <br />
              Exp. {anticipo.expediente_numero}
            </p>
          )}
        </div>

        {formError && <SpreadsheetFormError>{formError}</SpreadsheetFormError>}

        <SpreadsheetFieldGrid fields={fields} layout="stack" />

        <SpreadsheetFormFooter
          info={
            <span className="text-slate-500">
              El importe coincide con el anticipo. El pago se registrará en una etapa posterior.
            </span>
          }
        >
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={createMutation.isPending} disabled={!canSubmit}>
            Emitir libramiento
          </Button>
        </SpreadsheetFormFooter>
      </form>
  );

  if (embedded) return formNode;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Libramiento de anticipo"
      size="lg"
      flush
      stackLevel={stackLevel}
    >
      {formNode}
    </Modal>
  );
}
