import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  LibramientoPrintSheet,
  libramientoToPrintData,
} from '@/components/impresion/LibramientoPrintSheet';
import { getImpresionLibramientoConfig } from '@/services/configuracion.service';
import { getLibramiento } from '@/services/libramientos.service';
import { downloadLibramientoPdfById } from '@/lib/libramientoPdf';
import {
  clearPrintJob,
  enqueuePrintJob,
  subscribePrintJob,
  type PrintJob,
} from '@/lib/printQueue';

/**
 * Monta la hoja overlay fuera de pantalla y dispara window.print().
 */
export function LibramientoPrintHost() {
  const [job, setJob] = useState<PrintJob>(null);

  useEffect(() => subscribePrintJob(setJob), []);

  useEffect(() => {
    if (!job || job.tipo !== 'libramiento') return;

    document.documentElement.setAttribute('data-print', 'libramiento');

    const timer = window.setTimeout(() => {
      window.print();
      window.setTimeout(() => {
        clearPrintJob();
        document.documentElement.removeAttribute('data-print');
      }, 400);
    }, 80);

    return () => {
      window.clearTimeout(timer);
      document.documentElement.removeAttribute('data-print');
    };
  }, [job]);

  if (!job || job.tipo !== 'libramiento' || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className="pointer-events-none fixed left-[-10000px] top-0 w-[210mm]" aria-hidden>
      <LibramientoPrintSheet libramiento={job.libramiento} config={job.config} />
    </div>,
    document.body
  );
}

export async function printLibramientoById(libramientoId: number): Promise<void> {
  const [libramiento, config] = await Promise.all([
    getLibramiento(libramientoId),
    getImpresionLibramientoConfig(),
  ]);

  enqueuePrintJob({
    tipo: 'libramiento',
    libramiento: libramientoToPrintData(libramiento),
    config,
  });
}

export function usePrintLibramiento() {
  const [printing, setPrinting] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [error, setError] = useState('');

  const print = useCallback(async (libramientoId: number) => {
    setPrinting(true);
    setError('');
    try {
      await printLibramientoById(libramientoId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo preparar la impresión');
      throw err;
    } finally {
      setPrinting(false);
    }
  }, []);

  const downloadPdf = useCallback(async (libramientoId: number) => {
    setDownloadingPdf(true);
    setError('');
    try {
      await downloadLibramientoPdfById(libramientoId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el PDF');
      throw err;
    } finally {
      setDownloadingPdf(false);
    }
  }, []);

  return { print, printing, downloadPdf, downloadingPdf, error };
}
