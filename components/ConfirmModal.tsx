import React from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'danger' | 'primary' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
  icon?: string;
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
  confirmVariant = 'danger',
  onConfirm,
  onCancel,
  icon = '⚠️',
}) => {
  if (!isOpen) return null;

  const variantStyles = {
    danger: 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/30',
    primary: 'bg-primary hover:bg-pink-700 text-white shadow-primary/30',
    warning: 'bg-orange-600 hover:bg-orange-700 text-white shadow-orange-500/30',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div
        className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-gray-100 dark:border-gray-800 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center">
          <div className="text-5xl mb-4">{icon}</div>
          <h3 id="confirm-modal-title" className="text-xl font-bold mb-2 text-text">
            {title}
          </h3>
          <p className="text-sm text-text-light mb-6">{message}</p>

          <div className="flex gap-3 w-full">
            <button
              onClick={onCancel}
              className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-text rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              autoFocus
            >
              {cancelLabel}
            </button>
            <button
              onClick={() => {
                onConfirm();
                onCancel();
              }}
              className={`flex-1 py-3 rounded-xl font-bold transition-colors shadow-lg ${variantStyles[confirmVariant]}`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Hook for managing confirm modal state
 */
export function useConfirmModal() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [config, setConfig] = React.useState<Omit<ConfirmModalProps, 'isOpen' | 'onCancel' | 'onConfirm'>>({
    title: '',
    message: '',
  });
  const resolveRef = React.useRef<((value: boolean) => void) | null>(null);

  const confirm = (modalConfig: Omit<ConfirmModalProps, 'isOpen' | 'onCancel' | 'onConfirm'>): Promise<boolean> => {
    setConfig(modalConfig);
    setIsOpen(true);
    return new Promise((resolve) => {
      resolveRef.current = resolve;
    });
  };

  const handleConfirm = () => {
    resolveRef.current?.(true);
    setIsOpen(false);
  };

  const handleCancel = () => {
    resolveRef.current?.(false);
    setIsOpen(false);
  };

  const ConfirmModalComponent = () => (
    <ConfirmModal
      {...config}
      isOpen={isOpen}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );

  return { confirm, ConfirmModal: ConfirmModalComponent };
}
