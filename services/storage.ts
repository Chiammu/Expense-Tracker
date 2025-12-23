
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
  if (!supabase) return;
  
  // Get current session to find user ID
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;

  const { error } = await supabase
    .from('app_state')
    .upsert({ 
      user_id: session.user.id, // Primary Key in DB
      data: state, 
      updated_at: new Date().toISOString() 
    }, { onConflict: 'user_id' });
    
  if (error) console.error("Cloud sync failed:", error);
};

export const forceCloudSync = (state: AppState) => {
  if (saveTimeout) clearTimeout(saveTimeout);
  triggerCloudSave(state);
};

export const saveToStorage = (state: AppState, origin: 'local' | 'remote' = 'local') => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (origin === 'local' && supabase) {
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
    }
  };
};

export const fetchCloudState = async (userId: string): Promise<AppState | null> => {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('app_state')
    .select('data')
    .eq('user_id', userId)
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

// Fix: Added missing exportToPDF function
/**
 * Generates a PDF report of all expenses.
 */
export const exportToPDF = (state: AppState) => {
  const doc = new jsPDF();
  doc.setFontSize(20);
  doc.text(state.settings.headerTitle, 14, 22);
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Financial Report - Generated on ${new Date().toLocaleDateString()}`, 14, 30);

  const tableData = state.expenses.map(exp => [
    exp.date,
    exp.person === 'Both' ? 'Shared' : (exp.person === 'Person1' ? state.settings.person1Name : state.settings.person2Name),
    exp.category,
    `Rs. ${exp.amount}`,
    exp.note || '-'
  ]);

  (doc as any).autoTable({
    startY: 40,
    head: [['Date', 'Person', 'Category', 'Amount', 'Note']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [233, 30, 99] }
  });

  doc.save(`finances-${new Date().toISOString().split('T')[0]}.pdf`);
};

// Fix: Added missing exportMonthlyReportPDF function
/**
 * Generates a PDF report containing the AI advisor's monthly digest.
 */
export const exportMonthlyReportPDF = (state: AppState, digest: string) => {
  const doc = new jsPDF();
  const now = new Date();
  const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });

  doc.setFontSize(22);
  doc.setTextColor(233, 30, 99);
  doc.text(`Monthly Digest: ${monthName}`, 14, 25);

  doc.setFontSize(12);
  doc.setTextColor(50);
  doc.text(`Prepared for ${state.settings.person1Name} & ${state.settings.person2Name}`, 14, 35);

  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text("AI ADVISOR INSIGHTS", 14, 50);

  doc.setFontSize(10);
  const splitDigest = doc.splitTextToSize(digest, 180);
  doc.text(splitDigest, 14, 60);

  doc.save(`monthly-report-${monthName.replace(' ', '-')}.pdf`);
};
