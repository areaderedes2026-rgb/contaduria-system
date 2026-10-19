import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { ExpedienteCombobox } from '@/components/afectaciones/ExpedienteCombobox';
import { DestinatarioProveedoresField } from '@/components/afectaciones/DestinatarioProveedoresField';
import { NuevoExpedienteModal } from '@/components/expedientes/NuevoExpedienteModal';
import {
  SpreadsheetFormError,
  SpreadsheetFormFooter,
  SpreadsheetFieldGrid,
  cellInput,
  type SpreadsheetField,
} from '@/components/spreadsheet';
import {
  createAnticipo,
  getExpedientesDisponiblesAnticipo,
  getSiguienteNumeroAnticipo,
} from '@/services/anticipos.service';
import { getFondoARendirConfig } from '@/services/configuracion.service';
import { ApiClientError } from '@/services/api';
import { formatAnticipoNumero, formatCurrency, parseImporteAR } from '@/utils/format';
import { formatProveedoresNombres } from '@/utils/proveedores';
import { ImporteInput } from '@/components/ui/ImporteInput';
import type {
  Expediente,
  ExpedienteDisponible,
  ExpedienteDisponibleAnticipo,
  ExpedienteProveedorRef,
} from '@/types';

const today = new Date().toISOString().slice(0, 10);

function resolveProveedores(
  exp: ExpedienteDisponibleAnticipo | Expediente | null
): ExpedienteProveedorRef[] {
  if (!exp) return [];
  if (exp.proveedores && exp.proveedores.length > 0) return exp.proveedores;
  if (exp.proveedor_nombre) {
    return [{ id: 'proveedor_id' in exp ? exp.proveedor_id : 0, nombre: exp.proveedor_nombre }];
  }
  return [];
}

function toDisponible(exp: ExpedienteDisponibleAnticipo): ExpedienteDisponible {
  return {
    id: exp.id,
    numero_completo: exp.numero_completo,
    proveedor_nombre: exp.proveedor_nombre,
    proveedores: exp.proveedores,
    detalle: exp.detalle,
    importe: exp.importe,
    importe_afectado: exp.importe_anticipado,
    importe_disponible: exp.importe_disponible,
    afectaciones_activas: exp.anticipos_activos,
  };
}

interface FormState {
  numero: string;
  fecha: string;
  destinatario: string;
  importe: string;
  numeroComprobante: string;
  observaciones: string;
}

const emptyForm = (): FormState => ({
  numero: '',
  fecha: today,
  destinatario: '',
  importe: '',
  numeroComprobante: '',
  observaciones: '',
});

interface NuevoAnticipoModalProps {
  open: boolean;
  onClose: () => void;
  expedienteId?: number;
  stackLevel?: number;
}

export function NuevoAnticipoModal({
  open,
  onClose,
  expedienteId,
  stackLevel = 0,
}: NuevoAnticipoModalProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [expediente, setExpediente] = useState<ExpedienteDisponibleAnticipo | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [formError, setFormError] = useState('');
  const [numeroManual, setNumeroManual] = useState(false);
  const [crearExpOpen, setCrearExpOpen] = useState(false);

  const { data: fondo, isLoading: loadingFondo } = useQuery({
    queryKey: ['fondo-a-rendir'],
    queryFn: getFondoARendirConfig,
    enabled: open,
  });

  const { data: expedientes = [], isLoading: loadingExp } = useQuery({
    queryKey: ['expedientes-disponibles-anticipo'],
    queryFn: getExpedientesDisponiblesAnticipo,
    enabled: open,
  });

  const anioForm = form.fecha ? Number(form.fecha.slice(0, 4)) : new Date().getFullYear();

  const { data: siguienteNumero, isLoading: loadingNumero } = useQuery({
    queryKey: ['siguiente-numero-anticipo', anioForm],
    queryFn: () => getSiguienteNumeroAnticipo(anioForm),
    enabled: open && !!form.fecha,
  });

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm());
    setExpediente(null);
    setSelectedIds([]);
    setFormError('');
    setNumeroManual(false);
  }, [open]);

  useEffect(() => {
    if (!open || !expedienteId || expedientes.length === 0) return;
    const found = expedientes.find((e) => e.id === expedienteId) ?? null;
    if (found) setExpediente(found);
  }, [open, expedienteId, expedientes]);

  useEffect(() => {
    if (!expediente) {
      setSelectedIds([]);
      setForm((prev) => ({ ...prev, destinatario: '' }));
      return;
    }
    const proveedores = resolveProveedores(expediente);
    const ids = proveedores.map((p) => p.id).filter((id) => id > 0);
    setSelectedIds(ids);
    setForm((prev) => ({
      ...prev,
      destinatario: formatProveedoresNombres(proveedores) || expediente.proveedor_nombre,
      importe: prev.importe || String(expediente.importe_disponible).replace('.', ','),
    }));
  }, [expediente]);

  useEffect(() => {
    if (!open || numeroManual || !siguienteNumero) return;
    setForm((prev) => ({ ...prev, numero: String(siguienteNumero.siguiente) }));
  }, [open, numeroManual, siguienteNumero]);

  const cuentaOk = !!fondo?.cuenta && fondo.cuenta.estado === 'ACTIVA';
  const previewNumero =
    form.numero && form.fecha && parseInt(form.numero, 10) > 0
      ? formatAnticipoNumero(parseInt(form.numero, 10), form.fecha)
      : '—';

  const createMutation = useMutation({
    mutationFn: () =>
      createAnticipo({
        fecha: form.fecha,
        expediente_id: expediente!.id,
        destinatario: form.destinatario.trim(),
        numero: form.numero ? parseInt(form.numero, 10) : undefined,
        importe: parseImporteAR(form.importe),
        observaciones: form.observaciones.trim() || null,
        numero_comprobante: form.numeroComprobante.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anticipos'] });
      queryClient.invalidateQueries({ queryKey: ['anticipos-resumen'] });
      queryClient.invalidateQueries({ queryKey: ['expedientes'] });
      queryClient.invalidateQueries({ queryKey: ['expedientes-resumen'] });
      queryClient.invalidateQueries({ queryKey: ['expediente'] });
      queryClient.invalidateQueries({ queryKey: ['expedientes-disponibles-anticipo'] });
      queryClient.invalidateQueries({ queryKey: ['fondo-a-rendir'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      onClose();
    },
    onError: (err) => {
      setFormError(err instanceof ApiClientError ? err.message : 'Error al registrar el anticipo');
    },
  });

  const importeNumero = parseImporteAR(form.importe);
  const canSubmit =
    cuentaOk &&
    !!expediente &&
    form.fecha &&
    form.destinatario.trim() &&
    form.importe &&
    !Number.isNaN(importeNumero) &&
    importeNumero > 0 &&
    form.numero &&
    parseInt(form.numero, 10) > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      setFormError(
        cuentaOk
          ? 'Complete expediente, destinatario, importe y número'
          : 'Configure la cuenta Fondo a rendir antes de registrar un anticipo'
      );
      return;
    }
    if (expediente && importeNumero - expediente.importe_disponible > 0.001) {
      setFormError(
        `El importe supera el saldo disponible del expediente (${formatCurrency(expediente.importe_disponible)})`
      );
      return;
    }
    setFormError('');
    createMutation.mutate();
  };

  const handleCreatedExpediente = (exp: Expediente) => {
    setCrearExpOpen(false);
    queryClient.invalidateQueries({ queryKey: ['expedientes-disponibles-anticipo'] }).then(() => {
      setExpediente({
        id: exp.id,
        numero_completo: exp.numero_completo,
        proveedor_nombre: exp.proveedor_nombre ?? '',
        proveedores: exp.proveedores,
        detalle: exp.detalle,
        importe: exp.importe,
        importe_anticipado: 0,
        importe_disponible: exp.importe,
        anticipos_activos: 0,
      });
    });
  };

  const fields: SpreadsheetField[] = [
    {
      label: 'Expediente',
      children: (
        <ExpedienteCombobox
          value={expediente ? toDisponible(expediente) : null}
          onChange={(sel) => {
            const found = sel ? expedientes.find((e) => e.id === sel.id) ?? null : null;
            setExpediente(found);
          }}
          options={expedientes.map(toDisponible)}
          loading={loadingExp}
          disabled={!!expedienteId}
          variant="cell"
          onCreateRequest={expedienteId ? undefined : () => setCrearExpOpen(true)}
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
      label: 'Cuenta Fondo a rendir',
      children: loadingFondo ? (
        <span className="px-2 text-sm text-slate-400">Cargando…</span>
      ) : cuentaOk ? (
        <div className="px-2 py-1.5 text-sm">
          <span className="font-mono font-semibold text-primary-800">{fondo!.cuenta!.codigo}</span>
          <span className="ml-2 text-slate-600">{fondo!.cuenta!.descripcion}</span>
          <span className="ml-2 tabular-nums text-slate-500">
            Disp. {formatCurrency(fondo!.cuenta!.saldo_disponible)}
          </span>
        </div>
      ) : (
        <p className="px-2 py-1.5 text-sm text-amber-800">
          No hay cuenta configurada.{' '}
          <Link to="/configuracion/cargos-a-rendir" className="font-medium underline">
            Elegir en Configuración
          </Link>
        </p>
      ),
    },
    {
      label: 'Destinatario',
      alignTop: true,
      children: (
        <div className="space-y-1 py-0.5">
          <DestinatarioProveedoresField
            options={resolveProveedores(expediente)}
            selectedIds={selectedIds}
            onChange={(ids, destinatario) => {
              setSelectedIds(ids);
              setForm((prev) => ({ ...prev, destinatario }));
            }}
          />
          <input
            value={form.destinatario}
            onChange={(e) => setForm({ ...form, destinatario: e.target.value })}
            className={cellInput}
            placeholder="Destinatario"
          />
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
      label: 'Comprobante',
      children: (
        <input
          value={form.numeroComprobante}
          onChange={(e) => setForm({ ...form, numeroComprobante: e.target.value })}
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
          className="w-full min-w-0 resize-none rounded-none border-0 bg-transparent px-2 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
          placeholder="Opcional"
        />
      ),
    },
  ];

  return (
    <>
      <Modal open={open} onClose={onClose} title="Nuevo anticipo" size="lg" flush stackLevel={stackLevel}>
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
            {expediente && (
              <p className="hidden text-right text-xs text-slate-500 sm:block">
                Disponible {formatCurrency(expediente.importe_disponible)} de{' '}
                {formatCurrency(expediente.importe)}
              </p>
            )}
          </div>

          {formError && <SpreadsheetFormError>{formError}</SpreadsheetFormError>}

          <SpreadsheetFieldGrid fields={fields} layout="stack" />

          <SpreadsheetFormFooter
            info={
              <span className="text-slate-500">
                Imputa únicamente la cuenta Fondo a rendir. Puede ser un anticipo parcial.
              </span>
            }
          >
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={createMutation.isPending} disabled={!canSubmit}>
              Registrar anticipo
            </Button>
          </SpreadsheetFormFooter>
        </form>
      </Modal>

      <NuevoExpedienteModal
        open={crearExpOpen}
        onClose={() => setCrearExpOpen(false)}
        onCreated={handleCreatedExpediente}
        stackLevel={stackLevel + 1}
      />
    </>
  );
}
