const API_URL = import.meta.env.VITE_API_URL || '/api';

function getToken(): string | null {
  try {
    const stored = localStorage.getItem('contaduria-auth');
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return parsed?.state?.token ?? null;
  } catch {
    return null;
  }
}

function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const match = /filename="?([^"]+)"?/i.exec(header);
  return match?.[1]?.trim() || fallback;
}

async function saveWithPicker(blob: Blob, suggestedName: string): Promise<void> {
  const picker = (
    window as unknown as {
      showSaveFilePicker?: (opts: {
        suggestedName: string;
        types: Array<{ description: string; accept: Record<string, string[]> }>;
      }) => Promise<{ createWritable: () => Promise<{ write: (d: Blob) => Promise<void>; close: () => Promise<void> }> }>;
    }
  ).showSaveFilePicker;

  if (typeof picker === 'function') {
    const handle = await picker({
      suggestedName,
      types: [
        {
          description: 'Respaldo Contaduría (.sql.gz)',
          accept: { 'application/gzip': ['.sql.gz'] },
        },
      ],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = suggestedName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function descargarRespaldo(): Promise<string> {
  const token = getToken();
  const response = await fetch(`${API_URL}/backup`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    let message = 'No se pudo generar el respaldo';
    try {
      const data = (await response.json()) as { message?: string };
      if (data.message) message = data.message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const filename = filenameFromDisposition(
    response.headers.get('Content-Disposition'),
    `contaduria-respaldo.sql.gz`
  );

  try {
    await saveWithPicker(blob, filename);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('CANCELLED');
    }
    throw error;
  }

  return filename;
}
