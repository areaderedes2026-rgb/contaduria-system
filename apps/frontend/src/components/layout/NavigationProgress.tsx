import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  getLastNavigatedPathname,
  setLastNavigatedPathname,
} from '@/lib/navigationTransition';

/**
 * Barra superior tipo NProgress al cambiar de ruta (sidebar o enlaces).
 * Rápida y no bloqueante; ignora cambios solo de query/hash.
 */
export function NavigationProgress() {
  const { pathname } = useLocation();
  const [tick, setTick] = useState(0);
  const [active, setActive] = useState(false);
  const [width, setWidth] = useState(0);
  const isFirstLayoutPass = useRef(true);
  const timersRef = useRef<number[]>([]);

  // Detecta cambio de ruta (incluye remount entre módulos del router)
  useEffect(() => {
    const previous = getLastNavigatedPathname();

    if (isFirstLayoutPass.current) {
      isFirstLayoutPass.current = false;

      if (previous === null) {
        setLastNavigatedPathname(pathname);
        return;
      }

      // Nuevo AppLayout tras navegar a otro módulo
      if (previous !== pathname) {
        setLastNavigatedPathname(pathname);
        setTick((t) => t + 1);
      }
      return;
    }

    if (previous === pathname) return;
    setLastNavigatedPathname(pathname);
    setTick((t) => t + 1);
  }, [pathname]);

  // Ejecuta la animación de la barra
  useEffect(() => {
    if (tick === 0) return;

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];

    if (reduced) {
      setActive(true);
      setWidth(100);
      const hide = window.setTimeout(() => {
        setActive(false);
        setWidth(0);
      }, 100);
      timersRef.current.push(hide);
      return () => {
        timersRef.current.forEach((id) => window.clearTimeout(id));
        timersRef.current = [];
      };
    }

    setActive(true);
    setWidth(0);

    const frame = window.requestAnimationFrame(() => {
      setWidth(72);
      timersRef.current.push(
        window.setTimeout(() => setWidth(88), 90),
        window.setTimeout(() => {
          setWidth(100);
          timersRef.current.push(
            window.setTimeout(() => {
              setActive(false);
              setWidth(0);
            }, 150)
          );
        }, 180)
      );
    });

    return () => {
      window.cancelAnimationFrame(frame);
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current = [];
    };
  }, [tick]);

  if (!active && width === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] overflow-hidden"
      aria-hidden
      role="presentation"
    >
      <div
        className="h-full origin-left rounded-r-full bg-primary-500 shadow-[0_0_10px_rgba(37,99,235,0.55)] transition-[width,opacity] duration-150 ease-out"
        style={{
          width: `${width}%`,
          opacity: active ? 1 : 0,
        }}
      />
    </div>
  );
}
