import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { NavigationProgress } from '@/components/layout/NavigationProgress';
import { PageTransition } from '@/components/layout/PageTransition';
import { PwaInstallBanner } from '@/components/app/PwaInstallBanner';
import { AfectacionPrintHost } from '@/hooks/usePrintAfectacion';
import { LibramientoPrintHost } from '@/hooks/usePrintLibramiento';

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden bg-surface-muted">
      <NavigationProgress />
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <Header sidebarCollapsed={collapsed} />
      {/* Único scroll vertical de la app (crítico en PWA/iOS) */}
      <main
        className={`min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain pt-16 transition-all duration-300 [-webkit-overflow-scrolling:touch] ${
          collapsed ? 'pl-16' : 'pl-64'
        }`}
      >
        <div className="p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </div>
      </main>
      {/* Solo con sesión iniciada: no ofrecer instalación en la pantalla de login */}
      <PwaInstallBanner />
      <AfectacionPrintHost />
      <LibramientoPrintHost />
    </div>
  );
}
