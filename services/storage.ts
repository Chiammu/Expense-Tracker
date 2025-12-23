
import { AppState, INITIAL_STATE, INITIAL_INVESTMENTS, Expense } from '../types';
import { supabase } from './supabaseClient';
// @ts-ignore
import jsPDF from 'jspdf';
// @ts-ignore
import 'jspdf-autotable';

const STORAGE_KEY = 'coupleExpenseTrackerV4_React';

// Debounce timer for cloud saves
let saveTimeout: any = null;

const triggerCloudSave = async (state: AppState) => {
  if (!state.settings.syncId || !supabase) return;
  
  const { error } = await supabase
    .from('app_state')
    .upsert({ 
      id: state.settings.syncId, 
      data: state, 
      updated_at: new Date().toISOString() 
    });
    
  if (error) console.error("Cloud sync failed:", error);
};

export const forceCloudSync = (state: AppState) => {
  if (saveTimeout) clearTimeout(saveTimeout);
  triggerCloudSave(state);
};

export const saveToStorage = (state: AppState, origin: 'local' | 'remote' = 'local') => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (origin === 'local' && state.settings.syncId && supabase) {
      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        triggerCloudSave(state);
      }, 500); 
    }
  } catch (e) {
    console.error("Failed to save state", e);
  }
};

export const loadFromStorage = (): AppState => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return mergeState(parsed);
    }
  } catch (e) {
    console.error("Failed to load state", e);
  }
  return INITIAL_STATE;
};

const mergeState = (parsed: any): AppState => {
  return {
    ...INITIAL_STATE,
    ...parsed,
    settings: {
      ...INITIAL_STATE.settings,
      ...(parsed.settings || {}),
    },
    savingsGoals: parsed.savingsGoals || [],
    categoryBudgets: parsed.categoryBudgets || {},
    chatMessages: parsed.chatMessages || [],
    investments: {
      ...INITIAL_INVESTMENTS,
      ...(parsed.investments || {})
    },
    loans: parsed.loans || [],
  };
};

export const mergeAppState = (local: AppState, remote: AppState): AppState => {
  const mergeArrays = <T extends { id: number | string }>(localArr: T[], remoteArr: T[]): T[] => {
    const map = new Map<number | string, T>();
    localArr.forEach(item => map.set(item.id, item));
    remoteArr.forEach(item => map.set(item.id, item));
    return Array.from(map.values());
  };

  return {
    ...remote, 
    expenses: mergeArrays(local.expenses, remote.expenses),
    fixedPayments: mergeArrays(local.fixedPayments, remote.fixedPayments),
    otherIncome: mergeArrays(local.otherIncome, remote.otherIncome),
    savingsGoals: mergeArrays(local.savingsGoals, remote.savingsGoals),
    loans: mergeArrays(local.loans, remote.loans),
    investments: {
        ...remote.investments,
        bankBalance: { ...local.investments.bankBalance, ...remote.investments.bankBalance },
        mutualFunds: { ...local.investments.mutualFunds, ...remote.investments.mutualFunds },
        stocks: { ...local.investments.stocks, ...remote.investments.stocks },
        gold: { ...local.investments.gold, ...remote.investments.gold },
        silver: { ...local.investments.silver, ...remote.investments.silver },
    },
    settings: {
        ...remote.settings,
        syncId: local.settings.syncId || remote.settings.syncId, 
    }
  };
};

export const fetchCloudState = async (syncId: string): Promise<AppState | null> => {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('app_state')
    .select('data')
    .eq('id', syncId)
    .single();
  if (error || !data) return null;
  return mergeState(data.data);
};

export const exportData = (state: AppState) => {
  try {
    const data = JSON.stringify(state, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `couple-expense-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }, 100);
  } catch(e) {
      console.error("Export failed:", e);
  }
};

export const shareBackup = async (state: AppState): Promise<boolean> => {
  const data = JSON.stringify(state, null, 2);
  const fileName = `couple-expense-backup-${new Date().toISOString().split('T')[0]}.json`;
  const file = new File([data], fileName, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: 'Couple Expense Backup',
        text: 'Here is our latest expense data.',
        files: [file],
      });
      return true;
    } catch (err) {
      exportData(state);
      return false; 
    }
  } else {
    exportData(state);
    return false;
  }
};

export const exportToCSV = (expenses: AppState['expenses'], filenameSuffix: string = '') => {
  try {
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
      a.style.display = 'none';
      a.href = url;
      a.download = `expenses-${filenameSuffix || new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
      }, 100);
  } catch(e) {
      console.error("CSV Export failed", e);
  }
};

export const exportMonthlyReportPDF = (state: AppState, digest: string) => {
  const doc = new jsPDF();
  const now = new Date();
  const monthLabel = now.toLocaleString('default', { month: 'long', year: 'numeric' });
  
  // Header
  doc.setFillColor(233, 30, 99); // Primary color
  doc.rect(0, 0, 210, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.text("MONTHLY FINANCIAL DIGEST", 14, 25);
  doc.setFontSize(12);
  doc.text(monthLabel, 14, 34);

  // AI Advisor Content
  doc.setTextColor(33, 33, 33);
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text("Personal Financial Advisor Insights", 14, 55);
  doc.setFont(undefined, 'normal');
  doc.setFontSize(10);
  
  const splitDigest = doc.splitTextToSize(digest, 180);
  doc.text(splitDigest, 14, 65);
  
  const digestHeight = splitDigest.length * 5;
  let currentY = 75 + digestHeight;

  // Transaction Summary Header
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text("Transaction Breakdown", 14, currentY);
  currentY += 10;

  const monthExpenses = state.expenses.filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const rows = monthExpenses.map(e => [
    e.date,
    e.person === 'Both' ? 'Shared' : (e.person === 'Person1' ? state.settings.person1Name : state.settings.person2Name),
    e.category,
    `Rs. ${e.amount.toFixed(2)}`,
    e.note || '-'
  ]);

  (doc as any).autoTable({
    startY: currentY,
    head: [['Date', 'Person', 'Category', 'Amount', 'Note']],
    body: rows,
    headStyles: { fillColor: [233, 30, 99] },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  });

  doc.save(`Financial-Advisor-Report-${monthLabel.replace(' ', '-')}.pdf`);
};

export const exportToPDF = (state: AppState) => {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text(`${state.settings.headerTitle} Report`, 14, 22);
  doc.setFontSize(11);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30);
  const totalExp = state.expenses.reduce((s, e) => s + e.amount, 0);
  (doc as any).autoTable({
    startY: 40,
    head: [['Metric', 'Value']],
    body: [['Total Expenses', `Rs. ${totalExp.toFixed(2)}`]],
  });
  const rows = state.expenses.map(e => [e.date, e.person, e.category, e.amount.toFixed(2), e.note]);
  (doc as any).autoTable({
    startY: (doc as any).lastAutoTable.finalY + 10,
    head: [['Date', 'Person', 'Category', 'Amount', 'Note']],
    body: rows,
  });
  doc.save(`expense-report-${new Date().toISOString().split('T')[0]}.pdf`);
};
