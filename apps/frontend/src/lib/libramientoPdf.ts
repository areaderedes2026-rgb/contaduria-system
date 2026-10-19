import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  LibramientoPrintSheet,
  libramientoToPrintData,
  type LibramientoPrintData,
} from '@/components/impresion/LibramientoPrintSheet';
import {
  getImpresionLibramientoConfig,
  type ImpresionLibramientoConfig,
} from '@/services/configuracion.service';
import { getLibramiento } from '@/services/libramientos.service';

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

function waitForNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

function waitForImages(root: ParentNode): Promise<void> {
  const images = Array.from(root.querySelectorAll('img'));
  if (images.length === 0) return Promise.resolve();

  return Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          const done = () => resolve();
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
        })
    )
  ).then(() => undefined);
}

function buildPdfFilename(libramiento: LibramientoPrintData): string {
  const raw =
    libramiento.numero_completo || String(libramiento.numero) || 'sin-numero';
  const safe = raw.replace(/[/\\?%*:|"<>]/g, '-').trim() || 'sin-numero';
  return `Libramiento_${safe}.pdf`;
}

/**
 * PDF A4 con solo los datos (overlay). La guía solo si config.incluirGuiaEnPdf.
 */
export async function renderLibramientoPdf(
  libramiento: LibramientoPrintData,
  config: ImpresionLibramientoConfig,
  options?: { forceGuia?: boolean }
): Promise<void> {
  const host = document.createElement('div');
  host.setAttribute('data-libramiento-pdf-host', 'true');
  host.style.cssText = [
    'position: fixed',
    'left: 0',
    'top: 0',
    'transform: translateX(-120vw)',
    'width: 210mm',
    'background: #ffffff',
    'z-index: 0',
    'pointer-events: none',
    'opacity: 1',
  ].join(';');

  document.body.appendChild(host);

  const root = createRoot(host);

  try {
    root.render(
      createElement(LibramientoPrintSheet, {
        libramiento,
        config,
        preview: false,
        forceGuia: Boolean(options?.forceGuia || config.incluirGuiaEnPdf),
      })
    );

    await waitForNextPaint();
    await waitForImages(host);
    await new Promise((r) => window.setTimeout(r, 120));

    const sheet = host.querySelector('.libramiento-print-sheet') as HTMLElement | null;
    if (!sheet) {
      throw new Error('No se pudo generar la hoja para el PDF');
    }

    const canvas = await html2canvas(sheet, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: sheet.scrollWidth,
      windowHeight: sheet.scrollHeight,
    });

    const imgData = canvas.toDataURL('image/png', 1.0);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const imgWidth = A4_WIDTH_MM;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= A4_HEIGHT_MM;

    while (heightLeft > 1) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= A4_HEIGHT_MM;
    }

    pdf.save(buildPdfFilename(libramiento));
  } finally {
    root.unmount();
    host.remove();
  }
}

export async function downloadLibramientoPdfById(libramientoId: number): Promise<void> {
  const [libramiento, config] = await Promise.all([
    getLibramiento(libramientoId),
    getImpresionLibramientoConfig(),
  ]);

  await renderLibramientoPdf(libramientoToPrintData(libramiento), config);
}
