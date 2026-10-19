import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { spreadsheet, StatusBadge } from '@/components/spreadsheet';
import type { CuentaTreeNode } from '@/types';
import { formatCurrency, TIPO_CUENTA_LABELS, ESTADO_CUENTA_LABELS } from '@/utils/format';

interface CuentaTreeViewProps {
  nodes: CuentaTreeNode[];
  canWrite: boolean;
  onOpen: (cuenta: CuentaTreeNode) => void;
  onDelete: (cuenta: CuentaTreeNode) => void;
}

function TipoBadge({ tipo }: { tipo: string }) {
  const variants: Record<string, 'success' | 'warning' | 'info'> = {
    RECURSO: 'success',
    GASTO: 'warning',
    PATRIMONIAL: 'info',
  };
  return (
    <StatusBadge
      label={TIPO_CUENTA_LABELS[tipo] ?? tipo}
      variant={variants[tipo] ?? 'neutral'}
    />
  );
}

function TreeNode({
  node,
  depth,
  canWrite,
  onOpen,
  onDelete,
}: {
  node: CuentaTreeNode;
  depth: number;
  canWrite: boolean;
  onOpen: (cuenta: CuentaTreeNode) => void;
  onDelete: (cuenta: CuentaTreeNode) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.hijos.length > 0;

  return (
    <>
      <tr
        className={`${spreadsheet.row} cursor-pointer ${depth % 2 === 1 ? spreadsheet.rowAlt : ''}`}
        onClick={() => onOpen(node)}
      >
        <td className={spreadsheet.bodyCell} style={{ paddingLeft: `${12 + depth * 20}px` }}>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-200"
              disabled={!hasChildren}
            >
              {hasChildren ? (
                expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />
              ) : (
                <span className="w-4" />
              )}
            </button>
            <span className="font-mono font-semibold text-primary-800">{node.codigo}</span>
            <span className="min-w-0 truncate text-slate-700">{node.descripcion}</span>
          </div>
        </td>
        <td className={`${spreadsheet.bodyCell} w-28`}>
          <TipoBadge tipo={node.tipo} />
        </td>
        <td className={`${spreadsheet.bodyCell} w-32 text-right tabular-nums text-slate-600`}>
          {formatCurrency(node.saldo_inicial)}
        </td>
        <td className={`${spreadsheet.bodyCell} w-32 text-right tabular-nums text-amber-600`}>
          {formatCurrency(node.saldo_afectado)}
        </td>
        <td className={`${spreadsheet.bodyCell} w-32 text-right font-medium tabular-nums text-emerald-700`}>
          {formatCurrency(node.saldo_disponible)}
        </td>
        <td className={`${spreadsheet.bodyCell} w-24`}>
          <StatusBadge
            label={ESTADO_CUENTA_LABELS[node.estado]}
            variant={node.estado === 'ACTIVA' ? 'success' : 'danger'}
          />
        </td>
        {canWrite && (
          <td className={`${spreadsheet.bodyCell} w-28 text-right`}>
            <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => onDelete(node)}
                className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
              >
                Eliminar
              </button>
            </div>
          </td>
        )}
      </tr>

      {expanded &&
        node.hijos.map((hijo) => (
          <TreeNode
            key={hijo.id}
            node={hijo}
            depth={depth + 1}
            canWrite={canWrite}
            onOpen={onOpen}
            onDelete={onDelete}
          />
        ))}
    </>
  );
}

export function CuentaTreeView({ nodes, canWrite, onOpen, onDelete }: CuentaTreeViewProps) {
  if (nodes.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-sm text-slate-500">
        No hay cuentas para mostrar en el árbol
      </div>
    );
  }

  return (
    <table className={spreadsheet.table}>
      <thead>
        <tr>
          <th className={spreadsheet.headerCell}>Código / Descripción</th>
          <th className={`${spreadsheet.headerCell} w-28`}>Tipo</th>
          <th className={`${spreadsheet.headerCell} w-32 text-right`}>Inicial</th>
          <th className={`${spreadsheet.headerCell} w-32 text-right`}>Afectado</th>
          <th className={`${spreadsheet.headerCell} w-32 text-right`}>Disponible</th>
          <th className={`${spreadsheet.headerCell} w-24`}>Estado</th>
          {canWrite && <th className={`${spreadsheet.headerCell} w-28 text-right`}>Acciones</th>}
        </tr>
      </thead>
      <tbody>
        {nodes.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            depth={0}
            canWrite={canWrite}
            onOpen={onOpen}
            onDelete={onDelete}
          />
        ))}
      </tbody>
    </table>
  );
}
