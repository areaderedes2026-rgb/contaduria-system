import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { formatCurrency, formatDate, ESTADO_EXPEDIENTE_LABELS } from '@/utils/format';
import { MEDIO_PAGO_LABELS } from '@/services/pagos.service';
import type { ReporteGenerado } from '@/services/reportes.service';

interface ReportPreviewProps {
  reporte: ReporteGenerado;
  /** Si true, muestra links a detalle (no imprimibles). */
  interactive?: boolean;
}

function ReportHeader({ reporte }: ReportPreviewProps) {
  return (
    <div className="mb-6 border-b-2 border-primary-800 pb-4 text-center">
      <h1 className="text-xl font-bold text-primary-950">Municipalidad de Trancas</h1>
      <h2 className="mt-1 text-lg font-semibold text-slate-800">Departamento de Contaduría</h2>
      <h3 className="mt-3 text-base font-bold uppercase tracking-wide text-primary-800">
        {reporte.titulo}
      </h3>
      <p className="mt-1 text-sm text-slate-600">{reporte.periodo}</p>
      <p className="mt-1 text-xs text-slate-400">
        Generado: {new Date(reporte.generadoEn).toLocaleString('es-AR')}
      </p>
    </div>
  );
}

function DocLink({
  to,
  children,
  interactive,
}: {
  to: string;
  children: ReactNode;
  interactive?: boolean;
}) {
  if (!interactive) return <>{children}</>;
  return (
    <Link
      to={to}
      className="font-mono text-primary-700 hover:underline no-print-link"
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </Link>
  );
}

function ResumenEjecutivoPreview({ reporte }: ReportPreviewProps) {
  const d = reporte.datos as {
    expedientes: { total: number; porEstado: Record<string, number> };
    afectaciones: { total: number; monto: number };
    libramientos: { total: number; neto: number };
    pagos: { total: number; monto: number };
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded border border-slate-200 p-4">
          <p className="text-sm font-medium text-slate-500">Expedientes</p>
          <p className="text-2xl font-bold tabular-nums">{d.expedientes.total}</p>
        </div>
        <div className="rounded border border-slate-200 p-4">
          <p className="text-sm font-medium text-slate-500">Monto afectado</p>
          <p className="text-2xl font-bold tabular-nums text-amber-700">
            {formatCurrency(d.afectaciones.monto)}
          </p>
          <p className="mt-1 text-xs text-slate-400">{d.afectaciones.total} afectación(es)</p>
        </div>
        <div className="rounded border border-slate-200 p-4">
          <p className="text-sm font-medium text-slate-500">Neto libramientos</p>
          <p className="text-2xl font-bold tabular-nums text-primary-700">
            {formatCurrency(d.libramientos.neto)}
          </p>
          <p className="mt-1 text-xs text-slate-400">{d.libramientos.total} libramiento(s)</p>
        </div>
        <div className="rounded border border-slate-200 p-4">
          <p className="text-sm font-medium text-slate-500">Monto pagado</p>
          <p className="text-2xl font-bold tabular-nums text-emerald-700">
            {formatCurrency(d.pagos.monto)}
          </p>
          <p className="mt-1 text-xs text-slate-400">{d.pagos.total} pago(s)</p>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-slate-50">
            <th className="px-3 py-2 text-left">Estado expediente</th>
            <th className="px-3 py-2 text-right">Cantidad</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(d.expedientes.porEstado).map(([estado, count]) => (
            <tr key={estado} className="border-b">
              <td className="px-3 py-2">{ESTADO_EXPEDIENTE_LABELS[estado] ?? estado}</td>
              <td className="px-3 py-2 text-right font-medium tabular-nums">{count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EjecucionPreview({ reporte, interactive }: ReportPreviewProps) {
  const rows = reporte.datos as Array<{
    id?: number;
    codigo: string;
    descripcion: string;
    tipo: string;
    saldo_inicial: number;
    saldo_afectado: number;
    saldo_disponible: number;
    monto_pagado: number;
    porcentaje_ejecutado: number;
  }>;

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b bg-slate-50">
          <th className="px-2 py-2 text-left">Código</th>
          <th className="px-2 py-2 text-left">Descripción</th>
          <th className="px-2 py-2 text-right">Presup.</th>
          <th className="px-2 py-2 text-right">Afect.</th>
          <th className="px-2 py-2 text-right">Disp.</th>
          <th className="px-2 py-2 text-right">Pagado</th>
          <th className="px-2 py-2 text-right">% Ejec.</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id ?? r.codigo} className="border-b">
            <td className="px-2 py-1.5 font-mono">
              {r.id ? (
                <DocLink to={`/plan-cuentas/${r.id}`} interactive={interactive}>
                  {r.codigo}
                </DocLink>
              ) : (
                r.codigo
              )}
            </td>
            <td className="px-2 py-1.5">{r.descripcion}</td>
            <td className="px-2 py-1.5 text-right tabular-nums">
              {formatCurrency(r.saldo_inicial)}
            </td>
            <td className="px-2 py-1.5 text-right tabular-nums">
              {formatCurrency(r.saldo_afectado)}
            </td>
            <td className="px-2 py-1.5 text-right tabular-nums">
              {formatCurrency(r.saldo_disponible)}
            </td>
            <td className="px-2 py-1.5 text-right tabular-nums">
              {formatCurrency(r.monto_pagado)}
            </td>
            <td className="px-2 py-1.5 text-right tabular-nums">
              {r.porcentaje_ejecutado.toFixed(1)}%
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t-2 font-bold">
          <td colSpan={2} className="px-2 py-2 text-right">
            Totales
          </td>
          <td className="px-2 py-2 text-right tabular-nums">
            {formatCurrency(reporte.totales.presupuesto ?? 0)}
          </td>
          <td className="px-2 py-2 text-right tabular-nums">
            {formatCurrency(reporte.totales.afectado ?? 0)}
          </td>
          <td className="px-2 py-2 text-right tabular-nums">
            {formatCurrency(reporte.totales.disponible ?? 0)}
          </td>
          <td className="px-2 py-2 text-right tabular-nums">
            {formatCurrency(reporte.totales.pagado ?? 0)}
          </td>
          <td />
        </tr>
      </tfoot>
    </table>
  );
}

function ExpedientesPreview({ reporte, interactive }: ReportPreviewProps) {
  const rows = reporte.datos as Array<{
    id?: number;
    numero_completo: string;
    proveedor_nombre: string;
    detalle: string;
    importe: number;
    fecha_ingreso: string;
    estado: string;
    anulado: boolean;
  }>;

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b bg-slate-50">
          <th className="px-2 py-2 text-left">Número</th>
          <th className="px-2 py-2 text-left">Fecha ingreso</th>
          <th className="px-2 py-2 text-left">Proveedor</th>
          <th className="px-2 py-2 text-right">Importe</th>
          <th className="px-2 py-2 text-left">Detalle</th>
          <th className="px-2 py-2 text-left">Estado</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={6} className="px-2 py-4 text-center text-slate-500">
              Sin registros
            </td>
          </tr>
        ) : (
          rows.map((r) => (
            <tr key={r.id ?? r.numero_completo} className={`border-b ${r.anulado ? 'opacity-50' : ''}`}>
              <td className="px-2 py-1.5 font-mono">
                {r.id ? (
                  <DocLink to={`/expedientes/${r.id}`} interactive={interactive}>
                    {r.numero_completo}
                  </DocLink>
                ) : (
                  r.numero_completo
                )}
              </td>
              <td className="px-2 py-1.5 tabular-nums">{formatDate(r.fecha_ingreso)}</td>
              <td className="px-2 py-1.5">{r.proveedor_nombre}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{formatCurrency(r.importe)}</td>
              <td className="max-w-[200px] truncate px-2 py-1.5" title={r.detalle}>
                {r.detalle}
              </td>
              <td className="px-2 py-1.5">
                {ESTADO_EXPEDIENTE_LABELS[r.estado] ?? r.estado}
                {r.anulado ? ' (Anul.)' : ''}
              </td>
            </tr>
          ))
        )}
      </tbody>
      <tfoot>
        <tr className="border-t-2 font-bold">
          <td colSpan={6} className="px-2 py-2 text-right">
            Total: {reporte.totales.registros ?? 0} expediente(s)
          </td>
        </tr>
      </tfoot>
    </table>
  );
}

function AfectacionesPreview({ reporte, interactive }: ReportPreviewProps) {
  const rows = reporte.datos as Array<{
    id?: number;
    numero_completo: string;
    fecha: string;
    expediente_id?: number;
    expediente_numero: string;
    destinatario: string;
    importe_total: number;
    anulada: boolean;
  }>;

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b bg-slate-50">
          <th className="px-2 py-2 text-left">Número</th>
          <th className="px-2 py-2 text-left">Fecha</th>
          <th className="px-2 py-2 text-left">Expediente</th>
          <th className="px-2 py-2 text-left">Destinatario</th>
          <th className="px-2 py-2 text-right">Importe</th>
          <th className="px-2 py-2 text-left">Estado</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={6} className="px-2 py-4 text-center text-slate-500">
              Sin registros
            </td>
          </tr>
        ) : (
          rows.map((r) => (
            <tr key={r.id ?? r.numero_completo} className={`border-b ${r.anulada ? 'opacity-50' : ''}`}>
              <td className="px-2 py-1.5 font-mono">
                {r.id ? (
                  <DocLink to={`/afectaciones/${r.id}`} interactive={interactive}>
                    {r.numero_completo}
                  </DocLink>
                ) : (
                  r.numero_completo
                )}
              </td>
              <td className="px-2 py-1.5 tabular-nums">{formatDate(r.fecha)}</td>
              <td className="px-2 py-1.5 font-mono">
                {r.expediente_id ? (
                  <DocLink to={`/expedientes/${r.expediente_id}`} interactive={interactive}>
                    {r.expediente_numero}
                  </DocLink>
                ) : (
                  r.expediente_numero
                )}
              </td>
              <td className="px-2 py-1.5">{r.destinatario}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">
                {formatCurrency(r.importe_total)}
              </td>
              <td className="px-2 py-1.5">{r.anulada ? 'Anulada' : 'Activa'}</td>
            </tr>
          ))
        )}
      </tbody>
      <tfoot>
        <tr className="border-t-2 font-bold">
          <td colSpan={4} className="px-2 py-2 text-right">
            Total activo
          </td>
          <td className="px-2 py-2 text-right tabular-nums">
            {formatCurrency(reporte.totales.monto ?? 0)}
          </td>
          <td />
        </tr>
      </tfoot>
    </table>
  );
}

function LibramientosPreview({ reporte, interactive }: ReportPreviewProps) {
  const rows = reporte.datos as Array<{
    id?: number;
    numero_completo: string;
    fecha: string;
    expediente_id?: number;
    expediente_numero: string;
    beneficiario: string;
    neto: number;
    pagado: boolean;
    anulado: boolean;
  }>;

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b bg-slate-50">
          <th className="px-2 py-2 text-left">Número</th>
          <th className="px-2 py-2 text-left">Fecha</th>
          <th className="px-2 py-2 text-left">Expediente</th>
          <th className="px-2 py-2 text-left">Beneficiario</th>
          <th className="px-2 py-2 text-right">Neto</th>
          <th className="px-2 py-2 text-left">Estado</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={6} className="px-2 py-4 text-center text-slate-500">
              Sin registros
            </td>
          </tr>
        ) : (
          rows.map((r) => (
            <tr key={r.id ?? r.numero_completo} className={`border-b ${r.anulado ? 'opacity-50' : ''}`}>
              <td className="px-2 py-1.5 font-mono">
                {r.id ? (
                  <DocLink to={`/libramientos/${r.id}`} interactive={interactive}>
                    {r.numero_completo}
                  </DocLink>
                ) : (
                  r.numero_completo
                )}
              </td>
              <td className="px-2 py-1.5 tabular-nums">{formatDate(r.fecha)}</td>
              <td className="px-2 py-1.5 font-mono">
                {r.expediente_id ? (
                  <DocLink to={`/expedientes/${r.expediente_id}`} interactive={interactive}>
                    {r.expediente_numero}
                  </DocLink>
                ) : (
                  r.expediente_numero
                )}
              </td>
              <td className="px-2 py-1.5">{r.beneficiario}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{formatCurrency(r.neto)}</td>
              <td className="px-2 py-1.5">
                {r.anulado ? 'Anulado' : r.pagado ? 'Pagado' : 'Activo'}
              </td>
            </tr>
          ))
        )}
      </tbody>
      <tfoot>
        <tr className="border-t-2 font-bold">
          <td colSpan={4} className="px-2 py-2 text-right">
            Total neto activo
          </td>
          <td className="px-2 py-2 text-right tabular-nums">
            {formatCurrency(reporte.totales.neto ?? 0)}
          </td>
          <td />
        </tr>
      </tfoot>
    </table>
  );
}

function PagosPreview({ reporte, interactive }: ReportPreviewProps) {
  const rows = reporte.datos as Array<{
    id?: number;
    numero_completo: string;
    fecha_pago: string;
    expediente_id?: number;
    expediente_numero: string;
    libramiento_id?: number;
    libramiento_numero?: string;
    beneficiario: string;
    monto: number;
    medio_pago: string;
    anulado: boolean;
  }>;

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b bg-slate-50">
          <th className="px-2 py-2 text-left">Número</th>
          <th className="px-2 py-2 text-left">Fecha</th>
          <th className="px-2 py-2 text-left">Expediente</th>
          <th className="px-2 py-2 text-left">Libramiento</th>
          <th className="px-2 py-2 text-left">Beneficiario</th>
          <th className="px-2 py-2 text-right">Monto</th>
          <th className="px-2 py-2 text-left">Medio</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={7} className="px-2 py-4 text-center text-slate-500">
              Sin registros
            </td>
          </tr>
        ) : (
          rows.map((r) => (
            <tr key={r.id ?? r.numero_completo} className={`border-b ${r.anulado ? 'opacity-50' : ''}`}>
              <td className="px-2 py-1.5 font-mono">
                {r.id ? (
                  <DocLink to={`/pagos/${r.id}`} interactive={interactive}>
                    {r.numero_completo}
                  </DocLink>
                ) : (
                  r.numero_completo
                )}
              </td>
              <td className="px-2 py-1.5 tabular-nums">{formatDate(r.fecha_pago)}</td>
              <td className="px-2 py-1.5 font-mono">
                {r.expediente_id ? (
                  <DocLink to={`/expedientes/${r.expediente_id}`} interactive={interactive}>
                    {r.expediente_numero}
                  </DocLink>
                ) : (
                  r.expediente_numero
                )}
              </td>
              <td className="px-2 py-1.5 font-mono">
                {r.libramiento_id && r.libramiento_numero ? (
                  <DocLink to={`/libramientos/${r.libramiento_id}`} interactive={interactive}>
                    {r.libramiento_numero}
                  </DocLink>
                ) : (
                  r.libramiento_numero ?? '—'
                )}
              </td>
              <td className="px-2 py-1.5">{r.beneficiario}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{formatCurrency(r.monto)}</td>
              <td className="px-2 py-1.5">
                {MEDIO_PAGO_LABELS[r.medio_pago as keyof typeof MEDIO_PAGO_LABELS] ?? r.medio_pago}
              </td>
            </tr>
          ))
        )}
      </tbody>
      <tfoot>
        <tr className="border-t-2 font-bold">
          <td colSpan={5} className="px-2 py-2 text-right">
            Total vigente
          </td>
          <td className="px-2 py-2 text-right tabular-nums">
            {formatCurrency(reporte.totales.monto ?? 0)}
          </td>
          <td />
        </tr>
      </tfoot>
    </table>
  );
}

export function ReportPreview({ reporte, interactive = false }: ReportPreviewProps) {
  const renderContent = () => {
    switch (reporte.tipo) {
      case 'resumen-ejecutivo':
        return <ResumenEjecutivoPreview reporte={reporte} />;
      case 'ejecucion-presupuestaria':
        return <EjecucionPreview reporte={reporte} interactive={interactive} />;
      case 'expedientes':
        return <ExpedientesPreview reporte={reporte} interactive={interactive} />;
      case 'afectaciones':
        return <AfectacionesPreview reporte={reporte} interactive={interactive} />;
      case 'libramientos':
        return <LibramientosPreview reporte={reporte} interactive={interactive} />;
      case 'pagos':
        return <PagosPreview reporte={reporte} interactive={interactive} />;
      default:
        return <p className="text-slate-500">Tipo de reporte no soportado</p>;
    }
  };

  return (
    <div id="reporte-preview" className="reporte-preview bg-white p-8 text-slate-900">
      <ReportHeader reporte={reporte} />
      {renderContent()}
      <div className="mt-8 border-t pt-4 text-center text-xs text-slate-400">
        Sistema de Contaduría Municipal de Trancas — Documento generado automáticamente
      </div>
    </div>
  );
}
