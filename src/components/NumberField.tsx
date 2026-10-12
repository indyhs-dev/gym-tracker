import { useEffect, useRef, useState } from 'react';
import { formatKg, parseDecimal } from '../lib/format';

interface Props {
  value: number | null;
  onChange: (value: number | null) => void;
  /** Allows decimals (weight) and shows the decimal keypad; otherwise whole numbers. */
  decimal?: boolean;
  label: string;
  placeholder?: string;
}

const show = (v: number | null) => (v === null ? '' : formatKg(v));

/**
 * Number input that saves as you type. Keeps your exact text while focused
 * (e.g. "22."), and follows the saved value otherwise (e.g. after +/−).
 */
export default function NumberField({ value, onChange, decimal = false, label, placeholder }: Props) {
  const [text, setText] = useState(show(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(show(value));
  }, [value]);

  const allowed = decimal ? /^\d{0,4}([.,]\d{0,2})?$/ : /^\d{0,4}$/;
  // Unusually long values (e.g. 100 reps, 102.25 kg) get smaller text instead of clipping.
  const long = text.length >= (decimal ? 6 : 3);

  return (
    <input
      className={long ? 'num-input is-long' : 'num-input'}
      inputMode={decimal ? 'decimal' : 'numeric'}
      aria-label={label}
      placeholder={placeholder}
      value={text}
      autoComplete="off"
      enterKeyHint="done"
      onFocus={(e) => {
        focused.current = true;
        e.target.select();
      }}
      onBlur={() => {
        focused.current = false;
        setText(show(value));
      }}
      onChange={(e) => {
        const next = e.target.value.trim();
        if (!allowed.test(next)) return;
        setText(next);
        onChange(parseDecimal(next));
      }}
    />
  );
}
