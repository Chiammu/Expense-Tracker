import React from 'react';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Reusable empty state component for better UX when there's no data
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = '📭',
  title,
  description,
  actionLabel,
  onAction,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="text-6xl mb-4 animate-scale-in">{icon}</div>
      <h3 className="text-xl font-bold text-text mb-2">{title}</h3>
      <p className="text-sm text-text-light max-w-sm mb-6">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-6 py-3 bg-primary text-white rounded-xl font-bold shadow-lg hover:scale-105 transition-transform active:scale-95"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

/**
 * Specific empty states for different sections
 */
export const NoExpensesState: React.FC<{ onAddExpense: () => void }> = ({ onAddExpense }) => (
  <EmptyState
    icon="💸"
    title="No Expenses Yet"
    description="Start tracking your spending by adding your first expense. You can use voice input, scan receipts, or type manually!"
    actionLabel="Add First Expense"
    onAction={onAddExpense}
  />
);

export const NoCreditCardsState: React.FC<{ onAddCard: () => void }> = ({ onAddCard }) => (
  <EmptyState
    icon="💳"
    title="No Credit Cards"
    description="Add your credit cards to track balances and billing cycles automatically."
    actionLabel="Add Credit Card"
    onAction={onAddCard}
  />
);

export const NoInvestmentsState: React.FC = () => (
  <EmptyState
    icon="📈"
    title="Track Your Wealth"
    description="Add your investments, assets, and liabilities to get a complete financial picture."
  />
);

export const NoSearchResults: React.FC<{ searchTerm: string }> = ({ searchTerm }) => (
  <EmptyState
    icon="🔍"
    title="No Results Found"
    description={`No expenses match "${searchTerm}". Try different keywords or filters.`}
  />
);

export const OfflineState: React.FC = () => (
  <EmptyState
    icon="📡"
    title="You're Offline"
    description="Some features are unavailable. Your changes will sync when you're back online."
  />
);
