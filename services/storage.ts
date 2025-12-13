import { AppState, INITIAL_STATE } from '../types';
// @ts-ignore
import jsPDF from 'jspdf';
// @ts-ignore
import 'jspdf-autotable';

const STORAGE_KEY = 'coupleExpenseTrackerV4_React';

export const saveToStorage = (state: AppState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Failed to save state", e);
  }
};

export const loadFromStorage = (): AppState => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Merge with initial state to ensure new fields exist
      return {
        ...INITIAL_STATE,
        ...parsed,
        settings: {
          ...INITIAL_STATE.settings,
          ...(parsed.settings || {}),
        },
        // Ensure arrays are initialized
        savingsGoals: parsed.savingsGoals || [],
        categoryBudgets: parsed.categoryBudgets || {},
      };
    }
  } catch (e) {
    console.error("Failed to load state", e);
  }
  return INITIAL_STATE;
};

export const exportData = (state: AppState) => {
  const data = JSON.stringify(state, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `couple-expense-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  window.URL.revokeObjectURL(url);
};

export const shareBackup = async (state: AppState): Promise<boolean> => {
  const data = JSON.stringify(state, null, 2);
  const fileName = `couple-expense-backup-${new Date().toISOString().split('T')[0]}.json`;
  const file = new File([data], fileName, { type: 'application/json' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: 'Couple Expense Backup',
        text: 'Here is our latest expense data. Import this in Settings.',
        files: [file],
      });
      return true;
    } catch (err) {
      console.error('Error sharing:', err);
      return false; // User likely cancelled or error occurred
    }
  } else {
    // Fallback to standard download if sharing isn't supported
    exportData(state);
    return false;
  }
};

export const exportToCSV = (expenses: AppState['expenses']) => {
  let csv = 'Date,Person,Category,Amount,Payment Mode,Note\n';
  expenses.forEach(exp => {
      const row = [
          exp.date,
          exp.person,
          exp.category,
          exp.amount,
          exp.paymentMode,
          `"${(exp.note || '').replace(/"/g, '""')}"`
      ].join(',');
      csv += row + '\n';
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `expenses-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
};

export const exportToPDF = (state: AppState) => {
  const doc = new jsPDF();
  
  // Title
  doc.setFontSize(18);
  doc.text(`${state.settings.headerTitle} Report`, 14, 22);
  doc.setFontSize(11);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30);

  // Summary Table
  const totalExp = state.expenses.reduce((s, e) => s + e.amount, 0);
  const p1Exp = state.expenses.filter(e => e.person === 'Person1').reduce((s, e) => s + e.amount, 0);
  const p2Exp = state.expenses.filter(e => e.person === 'Person2').reduce((s, e) => s + e.amount, 0);
  
  (doc as any).autoTable({
    startY: 40,
    head: [['Metric', 'Value']],
    body: [
      ['Total Expenses', `Rs. ${totalExp.toFixed(2)}`],
      [`${state.settings.person1Name} Spent`, `Rs. ${p1Exp.toFixed(2)}`],
      [`${state.settings.person2Name} Spent`, `Rs. ${p2Exp.toFixed(2)}`],
    ],
  });

  // Expenses Table
  const rows = state.expenses.map(e => [
    e.date,
    e.person === 'Both' ? 'Shared' : (e.person === 'Person1' ? state.settings.person1Name : state.settings.person2Name),
    e.category,
    e.amount.toFixed(2),
    e.note
  ]);

  (doc as any).autoTable({
    startY: (doc as any).lastAutoTable.finalY + 10,
    head: [['Date', 'Person', 'Category', 'Amount', 'Note']],
    body: rows,
  });

  doc.save(`expense-report-${new Date().toISOString().split('T')[0]}.pdf`);
};