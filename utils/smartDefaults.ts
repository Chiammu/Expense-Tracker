import { Expense } from '../types';

export const getMostUsedPersonByCategory = (expenses: Expense[], category: string, fallback: string): string => {
  if (!category) return fallback;
  const filtered = expenses.filter(e => e.category === category);
  if (filtered.length === 0) return fallback;

  const counts: Record<string, number> = {};
  filtered.forEach(e => {
    counts[e.person] = (counts[e.person] || 0) + 1;
  });

  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
};

export const getMostUsedPaymentModeByCategory = (expenses: Expense[], category: string, fallback: string): string => {
  if (!category) return fallback;
  const filtered = expenses.filter(e => e.category === category);
  if (filtered.length === 0) return fallback;

  const counts: Record<string, number> = {};
  filtered.forEach(e => {
    counts[e.paymentMode] = (counts[e.paymentMode] || 0) + 1;
  });

  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
};

export const getMostUsedCardByCategory = (expenses: Expense[], category: string): string => {
  if (!category) return '';
  const filtered = expenses.filter(e => e.category === category && e.paymentMode === 'Card' && e.cardId);
  if (filtered.length === 0) return '';

  const counts: Record<string, number> = {};
  filtered.forEach(e => {
    if (e.cardId) counts[e.cardId] = (counts[e.cardId] || 0) + 1;
  });

  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
};
