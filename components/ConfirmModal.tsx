import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { modalVariant, overlayVariant } from '../utils/motion';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Reusable confirmation modal for destructive actions
 */
export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
  onConfirm,
  onCancel,
}) => {
  return (
    <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center portrait:items-end">
        {/* Backdrop */}
        <motion.div
          variants={overlayVariant}
          initial="initial"
          animate="animate"
          exit="exit"
          className="absolute inset-0 bg-black/60 backdrop-blur-md"
          onClick={onCancel}
        />

        {/* Modal - Bottom Sheet on Mobile, Dialog on Desktop */}
        <motion.div 
          variants={modalVariant}
          initial="initial"
          animate="animate"
          exit="exit"
          className="relative w-full sm:w-[400px] bg-white dark:bg-[#1a1a1a] rounded-t-[32px] sm:rounded-[28px] p-6 pb-10 sm:pb-6 shadow-[0_-8px_40px_rgba(0,0,0,0.2)] dark:shadow-[0_-8px_40px_rgba(0,0,0,0.5)] border-t border-white/20 dark:border-white/5 m-2 mb-0 sm:mb-2 portrait:mb-0"
        >
          <div className="w-12 h-1.5 bg-gray-200 dark:bg-white/10 rounded-full mx-auto mb-6 sm:hidden pointer-events-none" />

          <div className="text-center mb-8">
            <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${isDestructive ? 'bg-red-50 dark:bg-red-900/20 text-red-500' : 'bg-primary/10 text-primary'}`}>
              <span className="text-2xl">{isDestructive ? '🗑️' : '⚠️'}</span>
            </div>
            <h3 className="text-xl font-black text-text mb-2 tracking-tight">{title}</h3>
            <p className="text-sm text-text-light font-medium leading-relaxed">{message}</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 py-3.5 rounded-[16px] bg-gray-100 dark:bg-white/5 text-text font-bold text-sm hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 py-3.5 rounded-[16px] text-white font-bold text-sm shadow-lg active:scale-95 transition-all ${isDestructive
                  ? 'bg-red-500 hover:bg-red-600 shadow-red-500/30'
                  : 'bg-primary hover:bg-primary-dark shadow-primary/30'
                }`}
            >
              {confirmLabel}
            </button>
          </div>
        </motion.div>
      </div>
    )}
    </AnimatePresence>
  );
};

export function useConfirmModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    confirmLabel?: string;
    isDestructive?: boolean;
  }>({
    title: '',
    message: '',
    onConfirm: () => { },
  });

  const confirm = useCallback((
    title: string,
    message: string,
    onConfirm: () => void,
    confirmLabel = 'Confirm',
    isDestructive = false
  ) => {
    setConfig({ title, message, onConfirm, confirmLabel, isDestructive });
    setIsOpen(true);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  const ConfirmModalComponent = () => (
    <ConfirmModal
      isOpen={isOpen}
      title={config.title}
      message={config.message}
      onConfirm={() => {
        config.onConfirm();
        close();
      }}
      onCancel={close}
      confirmLabel={config.confirmLabel}
      isDestructive={config.isDestructive}
    />
  );

  return { confirm, ConfirmModal: ConfirmModalComponent };
}
