import React, { useMemo, useRef } from 'react';

interface CustomDatePickerProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
}

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
  label,
  value,
  onChange,
  min,
  max,
  disabled = false,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const formatted = useMemo(() => {
    if (!value) return 'Select date';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }, [value]);

  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-light">{label}</label>}
      <div className="relative">
        <input
          ref={inputRef}
          type="date"
          value={value}
          min={min}
          max={max}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 pointer-events-none"
          tabIndex={-1}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (disabled) return;
            const el = inputRef.current;
            if (!el) return;
            if (typeof (el as any).showPicker === 'function') {
              (el as any).showPicker();
            } else {
              el.focus();
              el.click();
            }
          }}
          className={`w-full h-12 px-4 rounded-[14px] border text-left flex items-center justify-between transition-all ${
            disabled
              ? 'opacity-50 cursor-not-allowed bg-[var(--control-bg)]'
              : 'bg-[var(--control-bg)] hover:bg-[var(--control-bg-hover)] border-[var(--control-border)] focus-visible:ring-2 focus-visible:ring-primary/20'
          }`}
          style={{
            color: 'var(--control-text)',
            boxShadow: 'var(--control-shadow)'
          }}
        >
          <span className={`text-sm ${value ? 'text-[var(--control-text)]' : 'text-[var(--control-placeholder)]'}`}>
            {formatted}
          </span>
          <svg className="w-4 h-4 text-[var(--text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M16 3v4M8 3v4" />
            <path d="M3 11h18" />
          </svg>
        </button>
      </div>
    </div>
  );
};
