import { useEffect, useState } from 'react';

/**
 * Devuelve una versión "retrasada" (debounced) del valor recibido.
 * Útil para búsquedas en vivo: el valor solo cambia cuando el usuario
 * deja de escribir durante `delay` milisegundos.
 */
export function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
