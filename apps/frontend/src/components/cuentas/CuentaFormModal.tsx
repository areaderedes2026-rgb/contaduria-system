import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { CuentaPadreCombobox } from '@/components/cuentas/CuentaPadreCombobox';
import {
  SpreadsheetFieldGrid,
  SpreadsheetFormError,
  SpreadsheetFormFooter,
  cellInput,
  cellSelect,
  type SpreadsheetField,
} from '@/components/spreadsheet';
import {
  createCuenta,
  getCuentasPadres,
  updateCuenta,
} from '@/services/cuentas.service';
import { ApiClientError } from '@/services/api';
import {
  formatCurrency,
  toImporteInput,
  parseImporteAR,
  TIPO_CUENTA_LABELS,
} from '@/utils/format';
import { ImporteInput } from '@/components/ui/ImporteInput';
import type { Cuenta, CuentaPadreOption, CuentaTreeNode } from '@/types';

interface FormState {
  codigo: string;
  descripcion: string;
  tipo: string;
  saldo_inicial: string;
  estado: string;
}

const TIPO_OPTIONS = [
  { value: 'RECURSO', label: 'Recurso' },
  { value: 'GASTO', label: 'Gasto' },
  { value: 'PATRIMONIAL', label: 'Patrimonial' },
];

const CODIGO_REGEX = /^[0-9]+(\.[0-9]+)*$/;

function emptyForm(): FormState {
  return {
    codigo: '',
    descripcion: '',
    tipo: 'RECURSO',
    saldo_inicial: '',
    estado: 'ACTIVA',
  };
}

function formFromCuenta(cuenta: Cuenta | CuentaTreeNode): FormState {
  return {
    codigo: cuenta.codigo,
    descripcion: cuenta.descripcion,
    tipo: cuenta.tipo,
    saldo_inicial: toImporteInput(Number(cuenta.saldo_inicial) || 0),
    estado: cuenta.estado,
  };
}

interface CuentaFormModalProps {
  open: boolean;
  onClose: () => void;
  editingCuenta?: Cuenta | CuentaTreeNode | null;
}

export function CuentaFormModal({
  open,
  onClose,
  editingCuenta = null,
}: CuentaFormModalProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [padre, setPadre] = useState<CuentaPadreOption | null>(null);
  const [formError, setFormError] = useState('');
  const [codigoSugerido, setCodigoSugerido] = useState(false);

  const isEdit = !!editingCuenta;
  const codigoBloqueado =
    isEdit && !!editingCuenta && Number(editingCuenta.saldo_afectado) > 0;

  const { data: padres = [], isLoading: loadingPadres } = useQuery({
    queryKey: ['cuentas-padres'],
    queryFn: getCuentasPadres,
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;

    if (editingCuenta) {
      setForm(formFromCuenta(editingCuenta));
      setPadre(
        editingCuenta.cuenta_padre_id
          ? (padres.find((p) => p.id === editingCuenta.cuenta_padre_id) ?? null)
          : null
      );
      setCodigoSugerido(false);
    } else {
      setForm(emptyForm());
      setPadre(null);
      setCodigoSugerido(false);
    }
    setFormError('');
  }, [open, editingCuenta]);

  // Resolver padre cuando llegan las opciones (edición)
  useEffect(() => {
    if (!open || !editingCuenta?.cuenta_padre_id || padres.length === 0) return;
    setPadre(padres.find((p) => p.id === editingCuenta.cuenta_padre_id) ?? null);
  }, [open, editingCuenta, padres]);

  const handlePadreChange = (next: CuentaPadreOption | null) => {
    setPadre(next);
    if (isEdit) return;

    const shouldSuggest =
      !form.codigo.trim() || form.codigo.endsWith('.') || codigoSugerido;
    if (shouldSuggest) {
      setForm((prev) => ({
        ...prev,
        codigo: next ? `${next.codigo}.` : '',
      }));
      setCodigoSugerido(!!next);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const saldoInicial = parseImporteAR(form.saldo_inicial || '0');
      const padreId = padre?.id ?? null;
      const payload = {
        codigo: form.codigo.trim(),
        descripcion: form.descripcion.trim(),
        tipo: form.tipo,
        cuenta_padre_id: padreId,
        saldo_inicial: Number.isNaN(saldoInicial) ? 0 : saldoInicial,
      };

      if (editingCuenta) {
        return updateCuenta(editingCuenta.id, {
          ...payload,
          estado: form.estado,
        });
      }
      return createCuenta(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cuentas'] });
      queryClient.invalidateQueries({ queryKey: ['cuentas-arbol'] });
      queryClient.invalidateQueries({ queryKey: ['cuentas-padres'] });
      queryClient.invalidateQueries({ queryKey: ['cuentas-resumen'] });
      queryClient.invalidateQueries({ queryKey: ['cuentas-disponibles'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      onClose();
    },
    onError: (err) => {
      setFormError(err instanceof ApiClientError ? err.message : 'Error al guardar la cuenta');
    },
  });

  const codigoValido = CODIGO_REGEX.test(form.codigo.trim());
  const jerarquiaValida =
    !padre ||
    (form.codigo.trim().startsWith(`${padre.codigo}.`) &&
      form.codigo.trim() !== padre.codigo);

  const saldoNumero = parseImporteAR(form.saldo_inicial || '0');
  const canSubmit =
    form.codigo.trim().length > 0 &&
    codigoValido &&
    jerarquiaValida &&
    form.descripcion.trim().length > 0 &&
    !!form.tipo &&
    !Number.isNaN(saldoNumero) &&
    saldoNumero >= 0;

  const validate = (): string | null => {
    if (!form.codigo.trim()) return 'Indique el código de la cuenta';
    if (!codigoValido) {
      return 'El código debe ser numérico con segmentos separados por punto (ej: 1.1.01)';
    }
    if (!jerarquiaValida) {
      return `El código debe continuar la jerarquía del padre (${padre!.codigo}.*)`;
    }
    if (!form.descripcion.trim()) return 'Indique la descripción';
    if (Number.isNaN(saldoNumero) || saldoNumero < 0) {
      return 'El saldo inicial debe ser un importe válido (0 o mayor)';
    }
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const error = validate();
    if (error) {
      setFormError(error);
      return;
    }
    setFormError('');
    saveMutation.mutate();
  };

  const previewCodigo = form.codigo.trim() || '—';
  const nivel = form.codigo.trim() ? form.codigo.trim().split('.').length : 0;

  const fields: SpreadsheetField[] = [
      {
        label: 'Código',
        children: (
          <input
            value={form.codigo}
            onChange={(e) => {
              setCodigoSugerido(false);
              setForm({ ...form, codigo: e.target.value.replace(/\s/g, '') });
            }}
            placeholder={padre ? `${padre.codigo}.…` : 'Ej: 1.1.01'}
            disabled={codigoBloqueado}
            required
            className={`${cellInput} font-mono text-base font-semibold tracking-tight`}
          />
        ),
      },
      {
        label: 'Descripción',
        alignTop: true,
        children: (
          <textarea
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            rows={2}
            required
            placeholder="Nombre de la cuenta presupuestaria"
            className="w-full min-w-0 resize-none rounded-none border-0 bg-transparent px-2 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500/40"
          />
        ),
      },
      {
        label: 'Tipo',
        children: (
          <select
            value={form.tipo}
            onChange={(e) => setForm({ ...form, tipo: e.target.value })}
            required
            className={cellSelect}
          >
            {TIPO_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ),
      },
      {
        label: 'Cuenta padre',
        alignTop: true,
        children: (
          <div className="py-0.5">
            <CuentaPadreCombobox
              value={padre}
              onChange={handlePadreChange}
              options={padres}
              loading={loadingPadres}
              excludeId={editingCuenta?.id}
              variant="cell"
            />
          </div>
        ),
      },
      {
        label: 'Saldo inicial',
        children: (
          <ImporteInput
            value={form.saldo_inicial}
            onChange={(saldo_inicial) => setForm({ ...form, saldo_inicial })}
            placeholder="0,00"
            className={`${cellInput} text-base font-semibold`}
          />
        ),
      },
      {
        label: 'Estado',
        hidden: !isEdit,
        children: (
          <select
            value={form.estado}
            onChange={(e) => setForm({ ...form, estado: e.target.value })}
            className={cellSelect}
          >
            <option value="ACTIVA">Activa</option>
            <option value="INACTIVA">Inactiva</option>
          </select>
        ),
      },
    ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar cuenta' : 'Nueva cuenta'}
      size="lg"
      flush
    >
      <form onSubmit={handleSubmit} className="flex flex-col">
        <div className="flex items-center justify-between gap-4 border-b border-slate-300 bg-[#e8eef4] px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Código de cuenta
            </p>
            <p className="mt-0.5 truncate font-mono text-2xl font-bold tracking-tight text-primary-900 sm:text-3xl">
              {previewCodigo}
            </p>
          </div>
          <div className="shrink-0 text-right text-xs text-slate-500">
            <p>{TIPO_CUENTA_LABELS[form.tipo] ?? form.tipo}</p>
            <p className="font-mono tabular-nums">
              {nivel > 0 ? `Nivel ${nivel}` : '—'}
              {padre ? ` · hijo de ${padre.codigo}` : ' · raíz'}
            </p>
          </div>
        </div>

        {formError && <SpreadsheetFormError>{formError}</SpreadsheetFormError>}

        {codigoBloqueado && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
            Esta cuenta ya tiene saldo afectado: el código no se puede modificar.
          </div>
        )}

        <SpreadsheetFieldGrid fields={fields} layout="stack" />

        <SpreadsheetFormFooter
          info={
            <span className="text-slate-500">
              {padre
                ? `El código debe empezar con ${padre.codigo}. · Disponible estimado ${formatCurrency(
                    Number.isNaN(saldoNumero) ? 0 : saldoNumero
                  )}`
                : 'Cuenta de nivel raíz. El disponible = inicial − afectado.'}
            </span>
          }
        >
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={saveMutation.isPending} disabled={!canSubmit}>
            {isEdit ? 'Guardar cambios' : 'Crear cuenta'}
          </Button>
        </SpreadsheetFormFooter>
      </form>
    </Modal>
  );
}
