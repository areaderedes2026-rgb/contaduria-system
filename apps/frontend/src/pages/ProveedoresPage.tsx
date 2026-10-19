import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Pencil, Trash2, RotateCcw, Filter, Ban, AlertTriangle } from 'lucide-react';
import {
  getProveedores,
  createProveedor,
  updateProveedor,
  deleteProveedor,
} from '@/services/proveedores.service';
import { PageListLayout } from '@/components/layout/PageListLayout';
import {
  SpreadsheetShell,
  SpreadsheetGrid,
  SpreadsheetStatusBar,
  SpreadsheetTitleActions,
  SpreadsheetReloadButton,
  SpreadsheetFieldGrid,
  SpreadsheetFormError,
  SpreadsheetFormFooter,
  StatusBadge,
  spreadsheet,
  cellInput,
  type SpreadsheetColumn,
  type SpreadsheetField,
} from '@/components/spreadsheet';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useAuthStore } from '@/stores/authStore';
import type { Proveedor } from '@/types';
import { ApiClientError } from '@/services/api';

interface ProveedorFormData {
  nombre: string;
  documento: string;
  domicilio: string;
  telefono: string;
  activo: boolean;
}

const emptyForm: ProveedorFormData = {
  nombre: '',
  documento: '',
  domicilio: '',
  telefono: '',
  activo: true,
};

const PAGE_SIZE = 15;

export function ProveedoresPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPermission('proveedores:write'));

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim(), 350);
  const [showInactive, setShowInactive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<ProveedorFormData>(emptyForm);
  const [formError, setFormError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<Proveedor | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deactivateTarget, setDeactivateTarget] = useState<Proveedor | null>(null);
  const [deactivateError, setDeactivateError] = useState('');

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['proveedores', page, search, showInactive],
    queryFn: () =>
      getProveedores({
        page,
        limit: PAGE_SIZE,
        search: search || undefined,
        activo: showInactive ? undefined : true,
      }),
  });

  useEffect(() => {
    setPage(1);
  }, [search, showInactive]);

  const saveMutation = useMutation({
    mutationFn: async () =>
      createProveedor({
        nombre: form.nombre,
        documento: form.documento || undefined,
        domicilio: form.domicilio || undefined,
        telefono: form.telefono || undefined,
        activo: form.activo,
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['proveedores'] });
      queryClient.invalidateQueries({ queryKey: ['proveedores-activos'] });
      closeModal();
      navigate(`/proveedores/${created.id}`);
    },
    onError: (err) => {
      setFormError(err instanceof ApiClientError ? err.message : 'Error al guardar');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteProveedor(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proveedores'] });
      queryClient.invalidateQueries({ queryKey: ['proveedores-activos'] });
      setConfirmDelete(null);
      setDeleteError('');
    },
    onError: (err) => {
      const inUse = err instanceof ApiClientError && err.code === 'PROVEEDOR_IN_USE';
      if (inUse) {
        const target = confirmDelete;
        setConfirmDelete(null);
        setDeleteError('');
        setDeactivateError('');
        setDeactivateTarget(target);
        return;
      }
      setDeleteError(err instanceof ApiClientError ? err.message : 'Error al eliminar el proveedor');
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (proveedor: Proveedor) => updateProveedor(proveedor.id, { activo: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proveedores'] });
      queryClient.invalidateQueries({ queryKey: ['proveedores-activos'] });
      setDeactivateTarget(null);
      setDeactivateError('');
    },
    onError: (err) => {
      setDeactivateError(
        err instanceof ApiClientError ? err.message : 'Error al desactivar el proveedor'
      );
    },
  });

  const openProveedor = (proveedor: Proveedor) => {
    navigate(`/proveedores/${proveedor.id}`);
  };

  const openConfirmDelete = (proveedor: Proveedor) => {
    setDeleteError('');
    setConfirmDelete(proveedor);
  };

  const closeConfirmDelete = () => {
    setConfirmDelete(null);
    setDeleteError('');
  };

  const openCreate = () => {
    setForm(emptyForm);
    setFormError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setForm(emptyForm);
    setFormError('');
  };

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;
  const rowOffset = (page - 1) * PAGE_SIZE;

  const columns: SpreadsheetColumn<Proveedor>[] = [
    {
      key: 'nombre',
      header: 'Nombre',
      render: (p) => (
        <span className="font-medium text-primary-800">{p.nombre}</span>
      ),
    },
    {
      key: 'documento',
      header: 'CUIT / DNI',
      width: 'w-36',
      render: (p) => <span className="font-mono text-slate-600">{p.documento || '—'}</span>,
    },
    {
      key: 'domicilio',
      header: 'Domicilio',
      render: (p) => <span className="text-slate-600">{p.domicilio || '—'}</span>,
    },
    {
      key: 'telefono',
      header: 'Teléfono',
      width: 'w-32',
      render: (p) => <span className="tabular-nums text-slate-600">{p.telefono || '—'}</span>,
    },
    {
      key: 'estado',
      header: 'Estado',
      width: 'w-24',
      render: (p) => (
        <StatusBadge
          label={p.activo ? 'Activo' : 'Inactivo'}
          variant={p.activo ? 'success' : 'danger'}
        />
      ),
    },
    ...(canWrite
      ? [
          {
            key: 'acciones',
            header: 'Acciones',
            width: 'w-24',
            align: 'right' as const,
            render: (p: Proveedor) => (
              <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => openProveedor(p)}
                  className="rounded p-1.5 text-slate-500 hover:bg-primary-50 hover:text-primary-600"
                  title="Ver detalle"
                >
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => openConfirmDelete(p)}
                  className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                  title="Eliminar"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ),
          },
        ]
      : []),
  ];

  const fields: SpreadsheetField[] = [
    {
      label: 'Nombre',
      children: (
        <input
          value={form.nombre}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          required
          placeholder="Razón social o nombre"
          className={cellInput}
        />
      ),
    },
    {
      label: 'CUIT / DNI',
      children: (
        <input
          value={form.documento}
          onChange={(e) => setForm({ ...form, documento: e.target.value })}
          placeholder="Opcional"
          className={cellInput}
        />
      ),
    },
    {
      label: 'Teléfono',
      children: (
        <input
          value={form.telefono}
          onChange={(e) => setForm({ ...form, telefono: e.target.value })}
          placeholder="Opcional"
          className={cellInput}
        />
      ),
    },
    {
      label: 'Domicilio',
      children: (
        <input
          value={form.domicilio}
          onChange={(e) => setForm({ ...form, domicilio: e.target.value })}
          placeholder="Opcional"
          className={cellInput}
        />
      ),
    },
    {
      label: 'Estado',
      children: (
        <label className="flex items-center gap-2 px-2 py-1.5 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.activo}
            onChange={(e) => setForm({ ...form, activo: e.target.checked })}
            className="rounded border-border text-primary-600 focus:ring-primary-500"
          />
          Proveedor activo
        </label>
      ),
    },
  ];

  return (
    <>
      <PageListLayout>
        <SpreadsheetShell
          fillHeight
          title="Proveedores"
          actions={
            <SpreadsheetTitleActions
              onNew={openCreate}
              newLabel="Nuevo proveedor"
              canWrite={canWrite}
            />
          }
          filters={
            <div className="flex w-full flex-wrap items-center gap-2.5">
              <Filter size={16} className="shrink-0 text-slate-400" />
              <div className="relative min-w-[220px] flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Buscar por nombre, documento o domicilio..."
                  className={`${spreadsheet.filterInput} w-full pl-9`}
                />
              </div>
              <label className="flex shrink-0 cursor-pointer select-none items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                  className="rounded border-border text-primary-600 focus:ring-primary-500"
                />
                Mostrar inactivos
              </label>
              <SpreadsheetReloadButton onReload={() => refetch()} loading={isFetching} />
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  setShowInactive(false);
                  setPage(1);
                }}
                className={spreadsheet.toolbarBtn}
              >
                <RotateCcw size={15} />
                Limpiar
              </button>
            </div>
          }
          footer={
            <SpreadsheetStatusBar
              left={
                data && (
                  <>
                    <span>
                      <strong>{data.total}</strong> proveedor{data.total !== 1 ? 'es' : ''}
                    </span>
                    <span className="text-slate-400">|</span>
                    <span>
                      Mostrando {data.data.length > 0 ? rowOffset + 1 : 0}–
                      {rowOffset + data.data.length}
                    </span>
                    <span className="text-slate-400">|</span>
                    <span className="text-slate-500">Clic en fila para ver detalle</span>
                  </>
                )
              }
              page={page}
              totalPages={totalPages}
              canPrev={page > 1}
              canNext={page < totalPages}
              onPrevPage={() => setPage((p) => p - 1)}
              onNextPage={() => setPage((p) => p + 1)}
            />
          }
        >
          <SpreadsheetGrid
            columns={columns}
            data={data?.data ?? []}
            rowKey={(p) => p.id}
            loading={isLoading}
            onRowClick={(p) => openProveedor(p)}
            rowNumberOffset={rowOffset}
            emptyMessage="No se encontraron proveedores"
          />
        </SpreadsheetShell>
      </PageListLayout>

      <Modal open={modalOpen} onClose={closeModal} title="Nuevo proveedor" size="lg" flush>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
          className="flex flex-col"
        >
          <div className="flex items-center justify-between gap-4 border-b border-slate-300 bg-[#e8eef4] px-4 py-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Alta de proveedor
              </p>
              <p className="mt-0.5 text-lg font-semibold tracking-tight text-primary-900 sm:text-xl">
                {form.nombre.trim() || 'Nuevo registro'}
              </p>
            </div>
            <div className="hidden text-right text-xs text-slate-500 sm:block">
              <p>Catálogo municipal</p>
              <p className={form.activo ? 'font-medium text-emerald-700' : 'font-medium text-slate-500'}>
                {form.activo ? 'Activo' : 'Inactivo'}
              </p>
            </div>
          </div>

          {formError && <SpreadsheetFormError>{formError}</SpreadsheetFormError>}

          <SpreadsheetFieldGrid fields={fields} layout="stack" />

          <SpreadsheetFormFooter
            info={<span className="text-slate-500">Solo el nombre es obligatorio.</span>}
          >
            <Button type="button" variant="secondary" onClick={closeModal}>
              Cancelar
            </Button>
            <Button type="submit" loading={saveMutation.isPending} disabled={!form.nombre.trim()}>
              Crear proveedor
            </Button>
          </SpreadsheetFormFooter>
        </form>
      </Modal>

      <Modal
        open={!!confirmDelete}
        onClose={closeConfirmDelete}
        title="Confirmar eliminación"
        size="sm"
      >
        <p className="mb-4 text-sm text-slate-600">
          ¿Está seguro que desea eliminar al proveedor{' '}
          <strong>{confirmDelete?.nombre}</strong>? Esta acción no se puede deshacer.
        </p>
        {deleteError && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{deleteError}</span>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={closeConfirmDelete}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            loading={deleteMutation.isPending}
            onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
          >
            Eliminar
          </Button>
        </div>
      </Modal>

      <Modal
        open={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        title="No se puede eliminar"
        size="sm"
      >
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <AlertTriangle size={20} />
          </div>
          <p className="text-sm leading-relaxed text-slate-600">
            El proveedor <strong>{deactivateTarget?.nombre}</strong> tiene expedientes
            vinculados, por lo que no puede eliminarse. Puede <strong>desactivarlo</strong>:
            dejará de aparecer en el listado y no podrá usarse en nuevos expedientes, pero se
            conservará el historial.
          </p>
        </div>
        {deactivateError && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{deactivateError}</span>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeactivateTarget(null)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            loading={deactivateMutation.isPending}
            onClick={() => deactivateTarget && deactivateMutation.mutate(deactivateTarget)}
          >
            <Ban size={15} />
            Desactivar proveedor
          </Button>
        </div>
      </Modal>
    </>
  );
}
