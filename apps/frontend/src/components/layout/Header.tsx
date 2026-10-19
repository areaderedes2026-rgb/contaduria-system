import { LogOut, User, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import { Button } from '@/components/ui/Button';

interface HeaderProps {
  sidebarCollapsed: boolean;
}

export function Header({ sidebarCollapsed }: HeaderProps) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const { canInstall, installing, install } = usePwaInstall();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header
      className={`fixed right-0 top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 transition-all duration-300 ${
        sidebarCollapsed ? 'left-16' : 'left-64'
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white">
          <User size={18} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800">
            {user?.nombre} {user?.apellido}
          </p>
          <p className="truncate text-xs text-slate-500">{user?.username}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {canInstall && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void install()}
            loading={installing}
            title="Instalar Contaduria en este equipo"
          >
            <Download size={16} />
            <span className="hidden sm:inline">Instalar app</span>
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut size={16} />
          <span className="hidden sm:inline">Salir</span>
        </Button>
      </div>
    </header>
  );
}
