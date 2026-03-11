import React from 'react';
import { motion } from 'framer-motion';
import { fadeUpVariant } from '../utils/motion';

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
    <motion.div variants={fadeUpVariant} initial="initial" animate="animate" exit="exit" className="flex flex-col items-center justify-center py-20 px-6 text-center text-balance">
      <div className="w-24 h-24 bg-gradient-to-tr from-gray-50 to-gray-100 dark:from-white/[0.03] dark:to-white/[0.08] rounded-[32px] flex items-center justify-center mb-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.2)] border border-white dark:border-white/[0.05]">
        <span className="text-5xl filter grayscale-[0.2]">{icon}</span>
      </div>
      <h3 className="text-xl font-black text-text mb-2 tracking-tight">{title}</h3>
      <p className="text-[15px] font-medium text-text-light max-w-[280px] leading-relaxed mb-8">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="bg-primary hover:bg-primary-dark text-white px-8 py-3.5 rounded-[18px] font-bold text-sm shadow-[0_8px_24px_rgba(233,30,99,0.3)] hover:shadow-[0_12px_30px_rgba(233,30,99,0.4)] transition-all active:scale-95 flex items-center gap-2"
        >
          <span>✨</span> {actionLabel}
        </button>
      )}
    </motion.div>
  );
};

/**
 * Specific empty states for different sections
 */
export const NoExpensesState = ({ onAction }: { onAction: () => void }) => (
  <EmptyState
    icon="💸"
    title="No Expenses Yet"
    description="Start tracking your spending to see AI-powered insights here."
    actionLabel="Add First Expense"
    onAction={onAction}
  />
);

export const NoCreditCardsState = ({ onAction }: { onAction: () => void }) => (
  <EmptyState
    icon="💳"
    title="No Cards Added"
    description="Add your credit cards to track utilization and billing cycles."
    actionLabel="Add Credit Card"
    onAction={onAction}
  />
);

export const NoInvestmentsState = () => (
  <EmptyState
    icon="📈"
    title="Portfolio Empty"
    description="Track your investments to get a complete view of your net worth."
  />
);

export const NoPatternsState = () => (
  <EmptyState
    icon="🔍"
    title="Not Enough Data"
    description="Keep tracking expenses. AI patterns will appear here after a few days."
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
