/**
 * Cola simple de trabajos de impresión (misma pestaña + window.print).
 * El host monta la hoja, imprime y limpia.
 */

import type {
  ImpresionAfectacionConfig,
  ImpresionLibramientoConfig,
} from '@/services/configuracion.service';
import type { AfectacionPrintData } from '@/components/impresion/AfectacionPrintSheet';
import type { LibramientoPrintData } from '@/components/impresion/LibramientoPrintSheet';

export type PrintJob =
  | {
      tipo: 'afectacion';
      afectacion: AfectacionPrintData;
      config: ImpresionAfectacionConfig;
    }
  | {
      tipo: 'libramiento';
      libramiento: LibramientoPrintData;
      config: ImpresionLibramientoConfig;
    }
  | null;

type Listener = (job: PrintJob) => void;

const listeners = new Set<Listener>();
let currentJob: PrintJob = null;

function notify(job: PrintJob): void {
  for (const fn of listeners) fn(job);
}

export function subscribePrintJob(fn: Listener): () => void {
  listeners.add(fn);
  if (currentJob) fn(currentJob);
  return () => {
    listeners.delete(fn);
  };
}

export function enqueuePrintJob(job: Exclude<PrintJob, null>): void {
  currentJob = job;
  notify(job);
}

export function clearPrintJob(): void {
  currentJob = null;
  notify(null);
}

export function getPrintJob(): PrintJob {
  return currentJob;
}
