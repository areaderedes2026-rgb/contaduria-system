import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Pencil, Trash2, RotateCcw, Filter } from 'lucide-react';
import {
  getUsers,
  getRoles,
  createUser,
  updateUser,
  deleteUser,
} from '@/services/users.service';
import { PageListLayout } from '@/components/layout/PageListLayout';
import {
  SpreadsheetShell,
  SpreadsheetGrid,
  SpreadsheetStatusBar,
  SpreadsheetTitleActions,
  SpreadsheetReloadButton,
  SpreadsheetFieldGrid,
  SpreadsheetFormHint,
  SpreadsheetFormError,
  SpreadsheetFormFooter,
  StatusBadge,
  spreadsheet,
  cellInput,
  cellSelect,
  type SpreadsheetColumn,
  type SpreadsheetField,
} from '@/components/spreadsheet';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useAuthStore } from '@/stores/authStore';
import type { User } from '@/types';
import { ApiClientError } from '@/services/api';

interface UserFormData {
  username: string;
  password: string;
  nombre: string;
  apellido: string;
  email: string;
  rol_id: string;
  activo: boolean;
}

const emptyForm: UserFormData = {
  username: '',
  password: '',
  nombre: '',
  apellido: '',
  email: '',
  rol_id: '',
  activo: true,
};

const PAGE_SIZE = 10;

export function UsersPage() {
  const queryClient = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPermission('usuarios:write'));
  const currentUserId = useAuthStore((s) => s.user?.id);

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim(), 350);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserFormData>(emptyForm);
  const [formError, setFormError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<User | null>(null);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['users', page, search],
    queryFn: () => getUsers({ page, limit: PAGE_SIZE, search: search || undefined }),
  });

  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: getRoles,
  });

  useEffect(() => {
    setPage(1);
  }, [search]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingUser) {
        const payload: Parameters<typeof updateUser>[1] = {
          nombre: form.nombre,
          apellido: form.apellido,
          email: form.email || undefined,
          rol_id: Number(form.rol_id),
          activo: form.activo,
        };
        if (form.password) payload.password = form.password;
        return updateUser(editingUser.id, payload);
      }
      return createUser({
        username: form.username,
        password: form.password,
        nombre: form.nombre,
        apellido: form.apellido,
        email: form.email || undefined,
        rol_id: Number(form.rol_id),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      closeModal();
    },
    onError: (err) => {
      setFormError(err instanceof ApiClientError ? err.message : 'Error al guardar');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setConfirmDelete(null);
    },
  });

  const openCreate = () => {
    setEditingUser(null);
    setForm(emptyForm);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setForm({
      username: user.username,
      password: '',
      nombre: user.nombre,
      apellido: user.apellido,
      email: user.email ?? '',
      rol_id: String(user.rol_id),
      activo: user.activo,
    });
    setFormError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingUser(null);
    setForm(emptyForm);
    setFormError('');
  };

  const handleClearFilters = () => {
    setSearchInput('');
    setPage(1);
  };

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;
  const rowOffset = (page - 1) * PAGE_SIZE;

  const columns: SpreadsheetColumn<User>[] = [
    {
      key: 'username',
      header: 'Usuario',
      width: 'w-36',
      render: (user) => <span className="font-medium text-slate-800">{user.username}</span>,
    },
    {
      key: 'nombre',
      header: 'Nombre',
      render: (user) => (
        <span className="text-slate-700">{user.nombre} {user.apellido}</span>
      ),
    },
    {
      key: 'rol',
      header: 'Rol',
      width: 'w-32',
      render: (user) => <span className="capitalize text-slate-600">{user.rol_nombre}</span>,
    },
    {
      key: 'estado',
      header: 'Estado',
      width: 'w-24',
      render: (user) => (
        <StatusBadge
          label={user.activo ? 'Activo' : 'Inactivo'}
          variant={user.activo ? 'success' : 'danger'}
        />
      ),
    },
    ...(canWrite
      ? [{
          key: 'acciones',
          header: 'Acciones',
          width: 'w-24',
          align: 'right' as const,
          render: (user: User) => (
            <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => openEdit(user)}
                className="rounded p-1.5 text-slate-500 hover:bg-primary-50 hover:text-primary-600"
                title="Editar"
              >
                <Pencil size={15} />
              </button>
              {user.id !== currentUserId && (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(user)}
                  className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                  title="Eliminar"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ),
        }]
      : []),
  ];

  const userFields: SpreadsheetField[] = [
    {
      label: 'Usuario',
      children: (
        <input
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          disabled={!!editingUser}
          required={!editingUser}
          className={cellInput}
        />
      ),
    },
    {
      label: editingUser ? 'Nueva contraseña' : 'Contraseña',
      children: (
        <input
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required={!editingUser}
          placeholder={editingUser ? 'Dejar vacío para no cambiar' : ''}
          className={cellInput}
        />
      ),
    },
    {
      label: 'Nombre',
      children: (
        <input
          value={form.nombre}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          required
          className={cellInput}
        />
      ),
    },
    {
      label: 'Apellido',
      children: (
        <input
          value={form.apellido}
          onChange={(e) => setForm({ ...form, apellido: e.target.value })}
          required
          className={cellInput}
        />
      ),
    },
    {
      label: 'Email',
      children: (
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className={cellInput}
        />
      ),
    },
    {
      label: 'Rol',
      children: (
        <select
          value={form.rol_id}
          onChange={(e) => setForm({ ...form, rol_id: e.target.value })}
          required
          className={cellSelect}
        >
          <option value="">Seleccionar rol...</option>
          {roles?.map((r) => (
            <option key={r.id} value={r.id}>{r.nombre}</option>
          ))}
        </select>
      ),
    },
    {
      label: 'Estado',
      full: true,
      hidden: !editingUser,
      children: (
        <label className="flex items-center gap-2 py-0.5 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.activo}
            onChange={(e) => setForm({ ...form, activo: e.target.checked })}
            className="rounded border-border text-primary-600 focus:ring-primary-500"
          />
          Usuario activo
        </label>
      ),
    },
  ];

  return (
    <>
    <PageListLayout>
      <SpreadsheetShell
        fillHeight
        title="Usuarios"
        actions={
          <SpreadsheetTitleActions
            onNew={openCreate}
            newLabel="Nuevo usuario"
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
                placeholder="Buscar por usuario, nombre o apellido..."
                className={`${spreadsheet.filterInput} w-full pl-9`}
              />
            </div>
            <SpreadsheetReloadButton onReload={() => refetch()} loading={isFetching} />
            <button type="button" onClick={handleClearFilters} className={spreadsheet.toolbarBtn}>
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
                    <strong>{data.total}</strong> usuario{data.total !== 1 ? 's' : ''}
                  </span>
                  <span className="text-slate-400">|</span>
                  <span>Mostrando {data.data.length > 0 ? rowOffset + 1 : 0}–{rowOffset + data.data.length}</span>
                  {canWrite && (
                    <>
                      <span className="text-slate-400">|</span>
                      <span className="text-slate-500">Clic en fila para editar</span>
                    </>
                  )}
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
          rowKey={(user) => user.id}
          loading={isLoading}
          onRowClick={canWrite ? (user) => openEdit(user) : undefined}
          rowNumberOffset={rowOffset}
          emptyMessage="No se encontraron usuarios con los filtros aplicados"
        />
      </SpreadsheetShell>
    </PageListLayout>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingUser ? 'Editar usuario' : 'Nuevo usuario'}
        size="lg"
        flush
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
          className="flex flex-col"
        >
          {formError && <SpreadsheetFormError>{formError}</SpreadsheetFormError>}
          <SpreadsheetFormHint>
            {editingUser
              ? 'Modifique los datos del usuario. El nombre de usuario no se puede cambiar.'
              : 'Complete los datos para crear un nuevo usuario del sistema.'}
          </SpreadsheetFormHint>
          <SpreadsheetFieldGrid fields={userFields} />
          <SpreadsheetFormFooter>
            <Button type="button" variant="secondary" onClick={closeModal}>
              Cancelar
            </Button>
            <Button type="submit" loading={saveMutation.isPending}>
              {editingUser ? 'Guardar cambios' : 'Crear usuario'}
            </Button>
          </SpreadsheetFormFooter>
        </form>
      </Modal>

      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Confirmar eliminación"
        size="sm"
      >
        <p className="mb-6 text-sm text-slate-600">
          ¿Está seguro que desea eliminar al usuario{' '}
          <strong>{confirmDelete?.username}</strong>? Esta acción no se puede deshacer.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmDelete(null)}>
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
    </>
  );
}
