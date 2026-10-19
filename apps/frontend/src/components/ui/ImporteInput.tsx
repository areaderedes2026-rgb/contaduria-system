import {
  useRef,
  type ChangeEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
} from 'react';
import {
  finalizeImporteInput,
  formatImporteInput,
  getImporteCaretIndex,
} from '@/utils/format';

type NativeInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange' | 'inputMode'
>;

interface ImporteInputProps extends NativeInputProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Input de importe argentino: miles con punto y siempre decimales con coma
 * (ej. 1.234.567,89). Mantiene el cursor al escribir.
 */
export function ImporteInput({
  value,
  onChange,
  onBlur,
  onKeyDown,
  className = '',
  placeholder = '0,00',
  ...props
}: ImporteInputProps) {
  const ref = useRef<HTMLInputElement>(null);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const raw = input.value;
    const rawCursor = input.selectionStart ?? raw.length;
    const next = formatImporteInput(raw);
    onChange(next);

    const caret = getImporteCaretIndex(raw, rawCursor, next);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.setSelectionRange(caret, caret);
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;

    const el = event.currentTarget;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    if (event.key !== 'Backspace' || start !== end || !value) return;

    const comma = value.indexOf(',');
    if (comma === -1) return;

    // Si el cursor está en los decimales ",00", borrar dígito entero (evita quedar trabado)
    if (start > comma) {
      const decimals = value.slice(comma + 1);
      const onlyZeros = /^0*$/.test(decimals);
      if (onlyZeros || (start === value.length && decimals.endsWith('0') && decimals.length === 2)) {
        event.preventDefault();
        const intDigits = value.slice(0, comma).replace(/\D/g, '');
        const nextInt = intDigits.slice(0, -1);
        const next = nextInt ? formatImporteInput(nextInt) : '';
        onChange(next);
        requestAnimationFrame(() => {
          const node = ref.current;
          if (!node || !next) return;
          const pos = next.indexOf(',');
          node.setSelectionRange(pos, pos);
        });
      }
    }
  };

  const handleBlur: InputHTMLAttributes<HTMLInputElement>['onBlur'] = (event) => {
    if (value) {
      const finalized = finalizeImporteInput(value);
      if (finalized !== value) onChange(finalized);
    }
    onBlur?.(event);
  };

  return (
    <input
      {...props}
      ref={ref}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      spellCheck={false}
      value={value}
      placeholder={placeholder}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      className={`tabular-nums ${className}`}
    />
  );
}
