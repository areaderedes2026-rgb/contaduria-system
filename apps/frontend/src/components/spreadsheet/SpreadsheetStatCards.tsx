import { spreadsheet } from './spreadsheet.styles';

export interface SpreadsheetStatCardItem {
  id: string;
  label: string;
  value: number | string;
  displayValue?: string;
  valueClassName?: string;
}

interface SpreadsheetStatCardsProps {
  cards: SpreadsheetStatCardItem[];
  activeId?: string;
  onSelect?: (id: string) => void;
}

/** Columnas según cantidad de tarjetas: evita anchos de 1/6 cuando hay 4 items. */
function gridClassForCount(count: number): string {
  switch (count) {
    case 0:
    case 1:
      return 'grid-cols-1';
    case 2:
      return 'grid-cols-1 sm:grid-cols-2';
    case 3:
      return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
    case 4:
      return 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4';
    case 5:
      return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5';
    default:
      return 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-6';
  }
}

export function SpreadsheetStatCards({ cards, activeId, onSelect }: SpreadsheetStatCardsProps) {
  return (
    <div className={`grid gap-3 ${gridClassForCount(cards.length)}`}>
      {cards.map((card) => {
        const isActive = activeId !== undefined && activeId === card.id;
        const display = String(card.displayValue ?? card.value);
        const content = (
          <>
            <span className={spreadsheet.statCardLabel}>{card.label}</span>
            <span
              className={`${spreadsheet.statCardValue} ${card.valueClassName ?? 'text-slate-800'}`}
              title={display}
            >
              {display}
            </span>
          </>
        );

        if (!onSelect) {
          return (
            <div
              key={card.id}
              className={`${spreadsheet.statCard} ${spreadsheet.statCardInactive} cursor-default`}
            >
              {content}
            </div>
          );
        }

        return (
          <button
            key={card.id}
            type="button"
            onClick={() => onSelect(card.id)}
            className={`${spreadsheet.statCard} ${
              isActive ? spreadsheet.statCardActive : spreadsheet.statCardInactive
            }`}
            aria-pressed={isActive}
            title={`Filtrar por ${card.label.toLowerCase()}`}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
