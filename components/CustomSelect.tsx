import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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
        className={`w-full h-12 px-4 rounded-[16px] border text-left flex items-center justify-between transition-all duration-200 ${
          disabled
            ? 'opacity-50 cursor-not-allowed bg-[var(--control-bg)] border-[var(--control-border)]'
            : open 
              ? 'bg-[var(--control-bg-hover)] border-[var(--primary)] shadow-[var(--control-shadow-open)] ring-4 ring-primary/10'
              : 'bg-[var(--control-bg)] hover:bg-[var(--control-bg-hover)] border-[var(--control-border)] active:scale-[0.98]'
        }`}
        style={{
          color: 'var(--control-text)',
        }}
      >
        <span className={`text-sm font-semibold ${selected ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <motion.svg 
          animate={{ rotate: open ? 180 : 0 }}
          className="w-4 h-4 text-[var(--text-tertiary)]" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2.5" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </motion.svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="mt-2 w-full rounded-[20px] border overflow-hidden z-[100] absolute top-full left-0 shadow-[var(--popover-shadow)] backdrop-blur-xl"
            style={{
              background: 'var(--popover-bg)',
              borderColor: 'var(--popover-border)',
            }}
          >
            <div className="max-h-64 overflow-auto py-2 custom-scrollbar">
              {options.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 text-sm font-medium transition-all flex items-center justify-between ${
                    opt.value === value 
                      ? 'text-[var(--primary)] bg-primary/5' 
                      : 'text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {opt.label}
                  {opt.value === value && (
                    <span className="text-primary">✓</span>
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
