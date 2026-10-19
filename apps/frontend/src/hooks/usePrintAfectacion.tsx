import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AfectacionPrintSheet,
  afectacionToPrintData,
} from '@/components/impresion/AfectacionPrintSheet';
import { getImpresionAfectacionConfig } from '@/services/configuracion.service';
import { getAfectacion } from '@/services/afectaciones.service';
import { downloadAfectacionPdfById } from '@/lib/afectacionPdf';
import {
  clearPrintJob,
  enqueuePrintJob,
  subscribePrintJob,
  type PrintJob,
} from '@/lib/printQueue';

/**
 * Monta la hoja de impresión fuera de pantalla y dispara window.print().
 */
export function AfectacionPrintHost() {
  const [job, setJob] = useState<PrintJob>(null);

  useEffect(() => subscribePrintJob(setJob), []);

  useEffect(() => {
    if (!job || job.tipo !== 'afectacion') return;

    document.documentElement.setAttribute('data-print', 'afectacion');

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

  if (!job || job.tipo !== 'afectacion' || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className="pointer-events-none fixed left-[-10000px] top-0 w-[210mm]" aria-hidden>
      <AfectacionPrintSheet afectacion={job.afectacion} config={job.config} />
    </div>,
    document.body
  );
}

/** Carga afectación + config e encola impresión. */
export async function printAfectacionById(afectacionId: number): Promise<void> {
  const [afectacion, config] = await Promise.all([
    getAfectacion(afectacionId),
    getImpresionAfectacionConfig(),
  ]);

  enqueuePrintJob({
    tipo: 'afectacion',
    afectacion: afectacionToPrintData(afectacion),
    config,
  });
}

export function usePrintAfectacion() {
  const [printing, setPrinting] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [error, setError] = useState('');

  const print = useCallback(async (afectacionId: number) => {
    setPrinting(true);
    setError('');
    try {
      await printAfectacionById(afectacionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo preparar la impresión');
      throw err;
    } finally {
      setPrinting(false);
    }
  }, []);

  const downloadPdf = useCallback(async (afectacionId: number) => {
    setDownloadingPdf(true);
    setError('');
    try {
      await downloadAfectacionPdfById(afectacionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el PDF');
      throw err;
    } finally {
      setDownloadingPdf(false);
    }
  }, []);

  return { print, printing, downloadPdf, downloadingPdf, error };
}
