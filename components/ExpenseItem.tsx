import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { Expense, AppState } from '../types';

// ============================================================================
// Fix #4: Memoize expense item component to prevent re-renders
// Only re-renders when the specific expense data changes
// ============================================================================

interface ExpenseItemProps {
  expense: Expense;
  settings: AppState['settings'];
  categoryIcons?: AppState['settings']['categoryIcons'];
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
}

// Using React.memo to prevent unnecessary re-renders
export const ExpenseItem = memo(({ 
  expense, 
  settings, 
  categoryIcons, 
  onEdit, 
  onDelete 
}: ExpenseItemProps) => {
  return (
    <motion.div 
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      key={expense.id} 
      className="p-4 flex justify-between items-center group hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg shadow-sm border border-black/5 dark:border-white/5 ${expense.person === settings.person1Name ? 'bg-blue-50 dark:bg-blue-500/10' : 'bg-purple-50 dark:bg-purple-500/10'}`}>
          {categoryIcons?.[expense.category] || '📦'}
        </div>
        <div className="cursor-pointer" onClick={() => onEdit(expense)}>
          <div className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-0.5">{expense.note || 'Uncategorized'}</div>
          <div className="flex items-center gap-2 text-[10px] text-gray-400 font-medium tracking-wide">
            <span className="uppercase">{expense.category}</span>
            <span>•</span>
            <span>{new Date(expense.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
          </div>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <span className="text-sm font-mono font-medium text-gray-900 dark:text-gray-100">₹{expense.amount.toLocaleString()}</span>
        <div className="flex gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onDelete(expense.id)} className="text-[10px] text-red-500 font-bold tracking-wider hover:text-red-600 transition-colors">DEL</button>
        </div>
      </div>
    </motion.div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if these specific properties change
  return (
    prevProps.expense.id === nextProps.expense.id &&
    prevProps.expense.note === nextProps.expense.note &&
    prevProps.expense.amount === nextProps.expense.amount &&
    prevProps.expense.category === nextProps.expense.category &&
    prevProps.expense.date === nextProps.expense.date &&
    prevProps.settings.person1Name === nextProps.settings.person1Name
  );
});

ExpenseItem.displayName = 'ExpenseItem';
