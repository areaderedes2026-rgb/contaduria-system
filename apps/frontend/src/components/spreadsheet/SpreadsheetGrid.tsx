import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { spreadsheet } from './spreadsheet.styles';

export interface SpreadsheetColumn<T> {
  key: string;
  header: string;
  width?: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  className?: string;
  render: (row: T, rowIndex: number) => React.ReactNode;
}

interface SpreadsheetGridProps<T> {
  columns: SpreadsheetColumn<T>[];
  data: T[];
  rowKey: (row: T) => string | number;
  loading?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  showRowNumbers?: boolean;
  rowNumberOffset?: number;
  selectedKey?: string | number;
}

export function SpreadsheetGrid<T>({
  columns,
  data,
  rowKey,
  loading,
  sortBy,
  sortOrder,
  onSort,
  onRowClick,
  emptyMessage = 'Sin registros',
  showRowNumbers = true,
  rowNumberOffset = 0,
  selectedKey,
}: SpreadsheetGridProps<T>) {
  const colSpan = columns.length + (showRowNumbers ? 1 : 0);

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortBy !== columnKey) return <ArrowUpDown size={14} className="text-slate-400" />;
    return sortOrder === 'asc' ? (
      <ArrowUp size={14} className="text-primary-700" />
    ) : (
      <ArrowDown size={14} className="text-primary-700" />
    );
  };

  return (
    <table className={spreadsheet.table}>
      <thead>
        <tr>
          {showRowNumbers && (
            <th className={`${spreadsheet.headerCell} w-10 text-center`}>#</th>
          )}
          {columns.map((col) => (
            <th
              key={col.key}
              className={`${spreadsheet.headerCell} ${col.width ?? ''} ${
                col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''
              }`}
            >
              {col.sortable && onSort ? (
                <button
                  type="button"
                  onClick={() => onSort(col.key)}
                  className={`${spreadsheet.headerBtn} ${
                    col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : ''
                  }`}
                >
                  {col.header}
                  <SortIcon columnKey={col.key} />
                </button>
              ) : (
                col.header
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <tr>
            <td colSpan={colSpan} className={`${spreadsheet.bodyCell} py-10 text-center text-slate-500`}>
              Cargando registros...
            </td>
          </tr>
        ) : data.length === 0 ? (
          <tr>
            <td colSpan={colSpan} className={`${spreadsheet.bodyCell} py-10 text-center text-slate-500`}>
              {emptyMessage}
            </td>
          </tr>
        ) : (
          data.map((row, index) => {
            const key = rowKey(row);
            const isSelected = selectedKey !== undefined && selectedKey === key;
            return (
              <tr
                key={key}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`${spreadsheet.row} ${onRowClick ? 'cursor-pointer' : ''} ${index % 2 === 1 ? spreadsheet.rowAlt : ''} ${
                  isSelected ? spreadsheet.rowSelected : ''
                }`}
              >
                {showRowNumbers && (
                  <td className={spreadsheet.rowNumCell}>{rowNumberOffset + index + 1}</td>
                )}
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`${spreadsheet.bodyCell} ${col.className ?? ''} ${
                      col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''
                    }`}
                  >
                    {col.render(row, index)}
                  </td>
                ))}
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}
