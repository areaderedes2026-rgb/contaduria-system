import type { ReactNode } from 'react';
import { spreadsheet } from './spreadsheet.styles';

interface SpreadsheetPropertyGridProps {
  rows: { label: string; value: ReactNode }[];
}

export function SpreadsheetPropertyGrid({ rows }: SpreadsheetPropertyGridProps) {
  return (
    <table className={`${spreadsheet.table} overflow-visible`}>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <td
              className={`${spreadsheet.headerCell} !static w-36 bg-[#f1f5f9] font-medium sm:w-52`}
            >
              {row.label}
            </td>
            <td className={spreadsheet.bodyCell}>{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface SpreadsheetSectionProps {
  title: string;
  toolbar?: ReactNode;
  children: ReactNode;
}

export function SpreadsheetSection({ title, toolbar, children }: SpreadsheetSectionProps) {
  return (
    <div className={`${spreadsheet.shell} overflow-visible`}>
      <div className="flex items-center justify-between border-b border-slate-300 bg-[#e2e8f0] px-4 py-2.5">
        <span className="text-sm font-semibold text-slate-700">{title}</span>
        {toolbar}
      </div>
      <div className={spreadsheet.gridWrap}>{children}</div>
    </div>
  );
}
