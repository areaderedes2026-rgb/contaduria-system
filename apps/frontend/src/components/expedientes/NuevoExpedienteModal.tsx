import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { ProveedorMultiCombobox } from '@/components/expedientes/ProveedorMultiCombobox';
import {
  SpreadsheetFieldGrid,
  SpreadsheetFormError,
  SpreadsheetFormFooter,
  cellInput,
  type SpreadsheetField,
} from '@/components/spreadsheet';
import { createExpediente, getSiguienteNumero } from '@/services/expedientes.service';
import { ApiClientError } from '@/services/api';
import { formatExpedienteNumero, parseImporteAR } from '@/utils/format';
import { ImporteInput } from '@/components/ui/ImporteInput';
import type { Expediente, Proveedor } from '@/types';

const today = new Date().toISOString().slice(0, 10);

interface FormState {
  numero: string;
  fechaIngreso: string;
  importe: string;
  detalle: string;
}

const emptyForm = (): FormState => ({
  numero: '',
  fechaIngreso: today,
  importe: '',
  detalle: '',
});

interface NuevoExpedienteModalProps {
  open: boolean;
  onClose: () => void;
  /** Tras crear con éxito (p. ej. desde afectación para seleccionar el nuevo). */
  onCreated?: (expediente: Expediente) => void;
  /** Apilar encima de otro modal (Escape/z-index). */
  stackLevel?: number;
}

export function NuevoExpedienteModal({
  open,
  onClose,
  onCreated,
  stackLevel = 0,
}: NuevoExpedienteModalProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [formError, setFormError] = useState('');
  const [numeroManual, setNumeroManual] = useState(false);

  const anioForm = form.fechaIngreso
    ? new Date(form.fechaIngreso + 'T12:00:00').getFullYear()
    : new Date().getFullYear();

  const { data: siguienteNumero, isLoading: loadingNumero } = useQuery({
    queryKey: ['siguiente-numero', anioForm],
    queryFn: () => getSiguienteNumero(anioForm),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm());
    setProveedores([]);
    setFormError('');
    setNumeroManual(false);
  }, [open]);

  useEffect(() => {
    if (!open || numeroManual || !siguienteNumero) return;
    setForm((prev) => ({ ...prev, numero: String(siguienteNumero.siguiente) }));
  }, [open, numeroManual, siguienteNumero]);

  const previewNumero =
    form.numero && anioForm && parseInt(form.numero, 10) > 0
      ? formatExpedienteNumero(parseInt(form.numero, 10), anioForm)
      : '—';

  const createMutation = useMutation({
    mutationFn: () =>
      createExpediente({
        numero: form.numero ? parseInt(form.numero, 10) : undefined,
        proveedorIds: proveedores.map((p) => p.id),
        importe: parseImporteAR(form.importe),
        detalle: form.detalle.trim(),
        fechaIngreso: form.fechaIngreso,
      }),
    onSuccess: (expediente) => {
      queryClient.invalidateQueries({ queryKey: ['expedientes'] });
      queryClient.invalidateQueries({ queryKey: ['expedientes-resumen'] });
      queryClient.invalidateQueries({ queryKey: ['siguiente-numero'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['expedientes-disponibles'] });
      queryClient.invalidateQueries({ queryKey: ['expedientes-disponibles-anticipo'] });
      onCreated?.(expediente);
      onClose();
    },
    onError: (err) => {
      setFormError(err instanceof ApiClientError ? err.message : 'Error al crear el expediente');
    },
  });

  const importeNumero = parseImporteAR(form.importe);

  const canSubmit =
    proveedores.length > 0 &&
    form.fechaIngreso &&
    form.detalle.trim() &&
    form.importe &&
    !Number.isNaN(importeNumero) &&
    importeNumero > 0 &&
    form.numero &&
    parseInt(form.numero, 10) > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      setFormError('Complete todos los campos obligatorios');
      return;
    }
    setFormError('');
    createMutation.mutate();
  };

  const fields: SpreadsheetField[] = [
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
              className="shrink-0 border-l border-slate-300 bg-slate-50 px-3 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-primary-700"
              title="Volver al número sugerido"
            >
              Auto
            </button>
          )}
        </div>
      ),
    },
    {
      label: 'Fecha ingreso',
      children: (
        <input
          type="date"
          value={form.fechaIngreso}
          onChange={(e) => setForm({ ...form, fechaIngreso: e.target.value })}
          required
          className={cellInput}
        />
      ),
    },
    {
      label: (
        <span className="flex w-full flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <span>Proveedores</span>
          <Link
            to="/proveedores"
            onClick={onClose}
            className="text-[11px] font-normal text-primary-600 hover:underline"
          >
            Catálogo
          </Link>
        </span>
      ),
      alignTop: true,
      children: (
        <div className="py-0.5">
          <ProveedorMultiCombobox value={proveedores} onChange={setProveedores} variant="cell" />
          <p className="mt-1 px-1 text-[11px] text-slate-500">Hasta 5. El primero es el principal.</p>
        </div>
      ),
    },
    {
      label: 'Importe',
      children: (
        <ImporteInput
          value={form.importe}
          onChange={(importe) => setForm({ ...form, importe })}
          required
          placeholder="0,00"
          className={cellInput}
        />
      ),
    },
    {
      label: 'Detalle',
      alignTop: true,
      children: (
        <textarea
          value={form.detalle}
          onChange={(e) => setForm({ ...form, detalle: e.target.value })}
          rows={4}
          required
          placeholder="Descripción del trámite o compra..."
          className="w-full min-w-0 resize-none rounded-none border-0 bg-transparent px-2 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500/40"
        />
      ),
    },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nuevo expediente"
      size="lg"
      flush
      stackLevel={stackLevel}
    >
      <form onSubmit={handleSubmit} className="flex flex-col">
        <div className="flex items-center justify-between gap-4 border-b border-slate-300 bg-[#e8eef4] px-4 py-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Número asignado
            </p>
            <p className="mt-0.5 font-mono text-2xl font-bold tracking-tight text-primary-900 sm:text-3xl">
              {loadingNumero ? '…' : previewNumero}
            </p>
          </div>
          <div className="hidden text-right text-xs text-slate-500 sm:block">
            <p>Expediente municipal</p>
            <p className="font-mono tabular-nums">
              {anioForm}
            </p>
          </div>
        </div>

        {formError && <SpreadsheetFormError>{formError}</SpreadsheetFormError>}

        <SpreadsheetFieldGrid fields={fields} layout="stack" />

        <SpreadsheetFormFooter
          info={
            <span className="text-slate-500">
              Complete los casilleros. El trámite (afectación o anticipo) se indica después, en el expediente.
            </span>
          }
        >
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={createMutation.isPending} disabled={!canSubmit}>
            Crear expediente
          </Button>
        </SpreadsheetFormFooter>
      </form>
    </Modal>
  );
}
