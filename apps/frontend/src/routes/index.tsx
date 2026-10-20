import { createBrowserRouter, Navigate, RouterProvider, useParams } from 'react-router-dom';
import { AppLayout } from '@/layouts/AppLayout';
import { ProtectedRoute, GuestRoute } from '@/routes/ProtectedRoute';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { UsersPage } from '@/pages/UsersPage';
import { PlanCuentasPage } from '@/pages/PlanCuentasPage';
import { CuentaDetailPage } from '@/pages/CuentaDetailPage';
import { ExpedientesPage } from '@/pages/ExpedientesPage';
import { ExpedienteDetailPage } from '@/pages/ExpedienteDetailPage';
import { ProveedoresPage } from '@/pages/ProveedoresPage';
import { ProveedorDetailPage } from '@/pages/ProveedorDetailPage';
import { AfectacionesPage } from '@/pages/AfectacionesPage';
import { AfectacionDetailPage } from '@/pages/AfectacionDetailPage';
import { LibramientosPage } from '@/pages/LibramientosPage';
import { LibramientoDetailPage } from '@/pages/LibramientoDetailPage';
import { PagosPage } from '@/pages/PagosPage';
import { PagoDetailPage } from '@/pages/PagoDetailPage';
import { ConsultasPage } from '@/pages/ConsultasPage';
import { AuditoriaPage } from '@/pages/AuditoriaPage';
import { ReportesPage } from '@/pages/ReportesPage';
import { ImpresionesPage } from '@/pages/ImpresionesPage';
import { AnticiposPage } from '@/pages/AnticiposPage';
import { AnticipoDetailPage } from '@/pages/AnticipoDetailPage';
import { LibramientoAnticipoDetailPage } from '@/pages/LibramientoAnticipoDetailPage';
import { ConfigCargosARendirPage } from '@/pages/ConfigCargosARendirPage';
import { BackupPage } from '@/pages/BackupPage';

function RedirectCargosARendirDetalle() {
  const { id } = useParams();
  return <Navigate to={`/expedientes/${id}`} replace />;
}

const router = createBrowserRouter([
  {
    element: <GuestRoute />,
    children: [{ path: '/login', element: <LoginPage /> }],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [{ path: '/', element: <DashboardPage /> }],
      },
    ],
  },
  {
    element: <ProtectedRoute permission="usuarios:read" />,
    children: [
      {
        element: <AppLayout />,
        children: [{ path: '/usuarios', element: <UsersPage /> }],
      },
    ],
  },
  {
    element: <ProtectedRoute permission="cuentas:read" />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/plan-cuentas', element: <PlanCuentasPage /> },
          { path: '/plan-cuentas/:id', element: <CuentaDetailPage /> },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute permission="expedientes:read" />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/expedientes', element: <ExpedientesPage /> },
          { path: '/expedientes/:id', element: <ExpedienteDetailPage /> },
          { path: '/cargos-a-rendir', element: <Navigate to="/expedientes" replace /> },
          { path: '/cargos-a-rendir/:id', element: <RedirectCargosARendirDetalle /> },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute permission="proveedores:read" />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/proveedores', element: <ProveedoresPage /> },
          { path: '/proveedores/:id', element: <ProveedorDetailPage /> },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute permission="afectaciones:read" />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/afectaciones', element: <AfectacionesPage /> },
          { path: '/afectaciones/:id', element: <AfectacionDetailPage /> },
          { path: '/anticipos', element: <AnticiposPage /> },
          { path: '/anticipos/:id', element: <AnticipoDetailPage /> },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute permission="libramientos:read" />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/libramientos', element: <LibramientosPage /> },
          { path: '/libramientos/:id', element: <LibramientoDetailPage /> },
          { path: '/libramientos-anticipo', element: <Navigate to="/libramientos?circuito=CARGO_A_RENDIR" replace /> },
          { path: '/libramientos-anticipo/:id', element: <LibramientoAnticipoDetailPage /> },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute permission="pagos:read" />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/pagos', element: <PagosPage /> },
          { path: '/pagos/:id', element: <PagoDetailPage /> },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute permission="consultas:read" />,
    children: [
      {
        element: <AppLayout />,
        children: [{ path: '/consultas', element: <ConsultasPage /> }],
      },
    ],
  },
  {
    element: <ProtectedRoute permission="auditoria:read" />,
    children: [
      {
        element: <AppLayout />,
        children: [{ path: '/auditoria', element: <AuditoriaPage /> }],
      },
    ],
  },
  {
    element: <ProtectedRoute permission="configuracion:read" />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/impresiones', element: <ImpresionesPage /> },
          { path: '/configuracion/cargos-a-rendir', element: <ConfigCargosARendirPage /> },
          { path: '/configuracion/respaldo', element: <BackupPage /> },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute permission="reportes:read" />,
    children: [
      {
        element: <AppLayout />,
        children: [{ path: '/reportes', element: <ReportesPage /> }],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);

export function AppRoutes() {
  return <RouterProvider router={router} />;
}
