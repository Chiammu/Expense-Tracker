
import { AppState, INITIAL_STATE, INITIAL_INVESTMENTS, Expense, DEFAULT_ICONS } from '../types';
import { supabase } from './supabaseClient';
// @ts-ignore
import jsPDF from 'jspdf';
// @ts-ignore
import 'jspdf-autotable';

const STORAGE_KEY = 'coupleExpenseTrackerV4_React';

// Debounce timer for cloud saves
let saveTimeout: any = null;

/**
 * Logs a sensitive event to the Supabase history table.
 */
export const logAuditEvent = async (event: string, details: any = {}) => {
  if (!supabase) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;

  const { error } = await supabase
    .from('history')
    .insert({
      user_id: session.user.id,
      event,
      details,
      created_at: new Date().toISOString()
    });
  
  if (error) console.error("Audit log failed:", error);
};

const triggerCloudSave = async (state: AppState) => {
  if (!supabase) return;
  
  // Get current session to find user ID
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;

  const payload: any = { 
    user_id: session.user.id, 
    data: state, 
    updated_at: new Date().toISOString() 
  };
  
  // If we have a syncId, include it so partners can find/subscribe to this record
  if (state.settings.syncId) {
    payload.sync_id = state.settings.syncId;
  }

  const { error } = await supabase
    .from('app_state')
    .upsert(payload, { onConflict: 'user_id' });
    
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

/**
 * Normalizes incoming data (from local or file) to ensure it matches current schema.
 */
export const mergeState = (parsed: any): AppState => {
  // Normalize expenses: ensure IDs are numbers and missing fields exist
  const normalizedExpenses = (parsed.expenses || []).map((exp: any, index: number) => {
    let id = exp.id;
    // If ID is string (common in some external formats), try to convert
    if (typeof id === 'string') {
      const numeric = parseInt(id.replace(/\D/g, ''));
      id = isNaN(numeric) ? Date.now() + index : numeric;
    } else if (typeof id !== 'number') {
      id = Date.now() + index;
    }

    return {
      id: id,
      person: exp.person || 'Both',
      date: exp.date || new Date().toISOString().split('T')[0],
      amount: parseFloat(exp.amount) || 0,
      category: exp.category || 'Others',
      paymentMode: exp.paymentMode || 'UPI',
      note: exp.note || '',
      updatedAt: exp.updatedAt || Date.now() + index,
      cardId: exp.cardId
    };
  });

  // Automatically detect missing categories from expenses
  const expenseCategories = Array.from(new Set(normalizedExpenses.map((e: any) => e.category)));
  const currentCategories = parsed.settings?.customCategories || INITIAL_STATE.settings.customCategories;
  const mergedCategories = Array.from(new Set([...currentCategories, ...expenseCategories]));
  
  // Ensure we have icons for any new categories
  const mergedIcons = { ...DEFAULT_ICONS, ...(parsed.settings?.categoryIcons || {}) };
  expenseCategories.forEach((cat: any) => {
    if (!mergedIcons[cat]) {
      mergedIcons[cat] = '📦'; // Default icon for unknown categories
    }
  });

  return {
    ...INITIAL_STATE,
    ...parsed,
    expenses: normalizedExpenses,
    settings: {
      ...INITIAL_STATE.settings,
      ...(parsed.settings || {}),
      customCategories: mergedCategories,
      categoryIcons: mergedIcons
    },
    savingsGoals: parsed.savingsGoals || [],
    categoryBudgets: parsed.categoryBudgets || {},
    investments: {
      ...INITIAL_INVESTMENTS,
      ...(parsed.investments || {})
    },
    loans: parsed.loans || [],
    creditCards: parsed.creditCards || [],
    fixedPayments: parsed.fixedPayments || [],
    otherIncome: parsed.otherIncome || [],
  };
};

/**
 * Reads a file and returns an AppState if valid.
 */
export const importDataFromJSON = (file: File): Promise<AppState> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        
        // Validation: must at least have expenses or settings
        if (typeof parsed !== 'object' || (!parsed.expenses && !parsed.settings)) {
          throw new Error("Invalid backup file. Structure missing required fields.");
        }

        resolve(mergeState(parsed));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsText(file);
  });
};

/**
 * Robust conflict resolution using Last-Write-Wins (LWW).
 */
export const mergeAppState = (local: AppState, remote: AppState): AppState => {
  const lwwMergeArray = <T extends { id: number | string; updatedAt?: number }>(localArr: T[], remoteArr: T[]): T[] => {
    const map = new Map<number | string, T>();
    // First seed with local
    localArr.forEach(item => map.set(item.id, item));
    // Overwrite with remote if remote is NEWER
    remoteArr.forEach(remoteItem => {
      const localItem = map.get(remoteItem.id);
      if (!localItem || (remoteItem.updatedAt || 0) >= (localItem.updatedAt || 0)) {
        map.set(remoteItem.id, remoteItem);
      }
    });
    return Array.from(map.values());
  };

  const lwwMergeObject = <T extends { updatedAt?: number }>(localObj: T, remoteObj: T): T => {
    if ((remoteObj.updatedAt || 0) >= (localObj.updatedAt || 0)) {
      return remoteObj;
    }
    return localObj;
  };

  return {
    ...remote, 
    settings: lwwMergeObject(local.settings, remote.settings),
    expenses: lwwMergeArray(local.expenses, remote.expenses),
    fixedPayments: lwwMergeArray(local.fixedPayments, remote.fixedPayments),
    otherIncome: lwwMergeArray(local.otherIncome, remote.otherIncome),
    savingsGoals: lwwMergeArray(local.savingsGoals, remote.savingsGoals),
    loans: lwwMergeArray(local.loans, remote.loans),
    creditCards: lwwMergeArray(local.creditCards, remote.creditCards),
    investments: lwwMergeObject(local.investments, remote.investments),
  };
};

export const fetchCloudState = async (userId: string, syncId?: string | null): Promise<AppState | null> => {
  if (!supabase) return null;
  
  // If syncId is provided, try to find the most recently updated record with that sync ID
  if (syncId) {
    const { data } = await supabase
      .from('app_state')
      .select('data')
      .eq('sync_id', syncId)
      .order('updated_at', { ascending: false })
      .limit(1);
    
    if (data && data.length > 0) return mergeState(data[0].data);
  }

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
