import React, { useEffect, useMemo, useRef, useState } from 'react';

export interface SelectOption {
  label: string;
  value: string;
}

interface CustomSelectProps {
  label?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select',
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(() => options.find(o => o.value === value), [options, value]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <div className="flex flex-col gap-1" ref={rootRef}>
      {label && <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-light">{label}</label>}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
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
        <span className={`text-sm ${selected ? 'text-[var(--control-text)]' : 'text-[var(--control-placeholder)]'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <svg className="w-4 h-4 text-[var(--text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div
          className="mt-2 w-full rounded-[16px] border overflow-hidden z-50"
          style={{
            background: 'var(--popover-bg)',
            borderColor: 'var(--popover-border)',
            boxShadow: 'var(--popover-shadow)'
          }}
        >
          <div className="max-h-64 overflow-auto">
            {options.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`w-full text-left px-4 py-2 text-sm transition-colors ${opt.value === value ? 'text-[var(--text-primary)] bg-[var(--surface-2)]' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-1)]'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
