import React, { useEffect, useState } from 'react';
import { formatDateDMY } from '../utils/date';

export { formatDateDMY };

const toIsoDate = (value: string) => {
  const trimmed = value.trim();
  const dmy = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/.exec(trimmed);
  if (!dmy) return null;

  const day = dmy[1].padStart(2, '0');
  const month = dmy[2].padStart(2, '0');
  const year = dmy[3];
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) {
    return null;
  }
  return `${year}-${month}-${day}`;
};

interface DateInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value?: string;
  onChange: (value: string) => void;
}

export const DateInput: React.FC<DateInputProps> = ({ value = '', onChange, onBlur, className = '', ...props }) => {
  const [displayValue, setDisplayValue] = useState(() => formatDateDMY(value));

  useEffect(() => {
    setDisplayValue(formatDateDMY(value));
  }, [value]);

  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      placeholder="DD/MM/YYYY"
      value={displayValue}
      onChange={(event) => {
        const next = event.target.value.replace(/[^0-9/\-]/g, '');
        setDisplayValue(next);
        const iso = toIsoDate(next);
        if (iso) onChange(iso);
      }}
      onBlur={(event) => {
        const iso = toIsoDate(event.target.value);
        if (iso) {
          setDisplayValue(formatDateDMY(iso));
          onChange(iso);
        } else {
          setDisplayValue(formatDateDMY(value));
        }
        onBlur?.(event);
      }}
      className={className}
    />
  );
};
