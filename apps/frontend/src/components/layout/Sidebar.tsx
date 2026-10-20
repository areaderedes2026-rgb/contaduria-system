import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  Users,
  Building2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  BookOpen,
  FileText,
  Truck,
  Wallet,
  Receipt,
  Banknote,
  Search,
  Shield,
  FileBarChart,
  Settings,
  FolderSearch,
  Printer,
  HandCoins,
  Landmark,
  Database,
  type LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

interface NavLinkItem {
  type: 'link';
  to: string;
  icon: LucideIcon;
  label: string;
  permission: string;
}

interface NavGroupItem {
  type: 'group';
  id: string;
  icon: LucideIcon;
  label: string;
  children: Omit<NavLinkItem, 'type'>[];
}

type NavEntry = NavLinkItem | NavGroupItem;

const navEntries: NavEntry[] = [
  {
    type: 'link',
    to: '/plan-cuentas',
    icon: BookOpen,
    label: 'Plan de Cuentas',
    permission: 'cuentas:read',
  },
  {
    type: 'link',
    to: '/expedientes',
    icon: FileText,
    label: 'Expedientes',
    permission: 'expedientes:read',
  },
  {
    type: 'link',
    to: '/afectaciones',
    icon: Wallet,
    label: 'Afectaciones',
    permission: 'afectaciones:read',
  },
  {
    type: 'link',
    to: '/anticipos',
    icon: HandCoins,
    label: 'Anticipos',
    permission: 'afectaciones:read',
  },
  {
    type: 'link',
    to: '/libramientos',
    icon: Receipt,
    label: 'Libramientos',
    permission: 'libramientos:read',
  },
  { type: 'link', to: '/pagos', icon: Banknote, label: 'Pagos', permission: 'pagos:read' },
  {
    type: 'link',
    to: '/proveedores',
    icon: Truck,
    label: 'Proveedores',
    permission: 'proveedores:read',
  },
  {
    type: 'group',
    id: 'consultas-reportes',
    icon: FolderSearch,
    label: 'Consultas y reportes',
    children: [
      { to: '/consultas', icon: Search, label: 'Consultas', permission: 'consultas:read' },
      { to: '/reportes', icon: FileBarChart, label: 'Reportes', permission: 'reportes:read' },
    ],
  },
  {
    type: 'group',
    id: 'configuracion',
    icon: Settings,
    label: 'Configuración',
    children: [
      { to: '/usuarios', icon: Users, label: 'Usuarios', permission: 'usuarios:read' },
      { to: '/impresiones', icon: Printer, label: 'Impresiones', permission: 'configuracion:read' },
      {
        to: '/configuracion/cargos-a-rendir',
        icon: Landmark,
        label: 'Fondo a rendir',
        permission: 'configuracion:read',
      },
      { to: '/auditoria', icon: Shield, label: 'Auditoría', permission: 'auditoria:read' },
      { to: '/configuracion/respaldo', icon: Database, label: 'Respaldo', permission: 'configuracion:write' },
    ],
  },
];

function linkClass(isActive: boolean, nested = false) {
  return `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
    nested ? 'py-2 pl-10' : ''
  } ${
    isActive
      ? 'bg-primary-700 text-white'
      : 'text-primary-200 hover:bg-primary-900 hover:text-white'
  }`;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const location = useLocation();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const isPathActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const entry of navEntries) {
        if (entry.type !== 'group') continue;
        const childActive = entry.children.some((child) =>
          child.to === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(child.to)
        );
        if (childActive) next[entry.id] = true;
      }
      return next;
    });
  }, [location.pathname]);

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const atHome = location.pathname === '/';

  return (
    <aside
      className={`fixed left-0 top-0 z-40 flex h-full flex-col bg-primary-950 text-white transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      <Link
        to="/"
        title="Inicio"
        className={`flex h-16 items-center gap-3 border-b border-primary-800 px-4 transition-colors hover:bg-primary-900 ${
          atHome ? 'bg-primary-900/60' : ''
        }`}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-600">
          <Building2 size={20} />
        </div>
        {!collapsed && (
          <p className="truncate text-sm font-bold leading-tight">Contaduria</p>
        )}
      </Link>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navEntries.map((entry) => {
          if (entry.type === 'link') {
            if (!hasPermission(entry.permission)) return null;
            return (
              <NavLink
                key={entry.to}
                to={entry.to}
                title={collapsed ? entry.label : undefined}
                className={({ isActive }) => linkClass(isActive)}
              >
                <entry.icon size={20} className="shrink-0" />
                {!collapsed && <span>{entry.label}</span>}
              </NavLink>
            );
          }

          const visibleChildren = entry.children.filter((child) =>
            hasPermission(child.permission)
          );
          if (visibleChildren.length === 0) return null;

          const groupActive = visibleChildren.some((child) => isPathActive(child.to));
          const isOpen = collapsed ? groupActive : (openGroups[entry.id] ?? groupActive);

          if (collapsed) {
            return (
              <div key={entry.id} className="space-y-1">
                {visibleChildren.map((child) => (
                  <NavLink
                    key={child.to}
                    to={child.to}
                    title={child.label}
                    className={({ isActive }) => linkClass(isActive)}
                  >
                    <child.icon size={20} className="shrink-0" />
                  </NavLink>
                ))}
              </div>
            );
          }

          return (
            <div key={entry.id} className="space-y-0.5">
              <button
                type="button"
                onClick={() => toggleGroup(entry.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  groupActive
                    ? 'bg-primary-900 text-white'
                    : 'text-primary-200 hover:bg-primary-900 hover:text-white'
                }`}
                aria-expanded={isOpen}
              >
                <entry.icon size={20} className="shrink-0" />
                <span className="flex-1 text-left">{entry.label}</span>
                <ChevronDown
                  size={16}
                  className={`shrink-0 transition-transform ${isOpen ? 'rotate-0' : '-rotate-90'}`}
                />
              </button>
              {isOpen &&
                visibleChildren.map((child) => (
                  <NavLink
                    key={child.to}
                    to={child.to}
                    className={({ isActive }) => linkClass(isActive, true)}
                  >
                    <child.icon size={18} className="shrink-0" />
                    <span>{child.label}</span>
                  </NavLink>
                ))}
            </div>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={onToggle}
        className="flex h-12 items-center justify-center border-t border-primary-800 text-primary-300 hover:bg-primary-900 hover:text-white"
      >
        {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
      </button>
    </aside>
  );
}
