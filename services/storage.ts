import { AppState, INITIAL_STATE, INITIAL_INVESTMENTS } from '../types';
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
  
  // console.log("Pushing to cloud...");
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
    // 1. Save Local (Always Instant)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

    // 2. Save Cloud (Debounced) ONLY if origin is local
    if (origin === 'local' && state.settings.syncId && supabase) {
      if (saveTimeout) clearTimeout(saveTimeout);
      
      // Debounce to prevent flooding DB on text inputs
      // 500ms is a good balance
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

// Helper to ensure structure matches AppState even if loading old data
// This is for structural integrity (schema migration), not content merging
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

// --- DATA MERGING LOGIC ---

/**
 * Smartly merges two AppStates.
 * Prioritizes preserving data from both sources using ID unions for arrays.
 * For scalars/objects, remote typically wins in this context as it's the "latest" sync,
 * but specific merge logic can be applied if needed.
 */
export const mergeAppState = (local: AppState, remote: AppState): AppState => {
  // Helper to merge arrays of objects with 'id' property
  const mergeArrays = <T extends { id: number | string }>(localArr: T[], remoteArr: T[]): T[] => {
    const map = new Map<number | string, T>();
    // Add local first
    localArr.forEach(item => map.set(item.id, item));
    // Add remote second (overwrites local if ID matches, effectively "latest wins" if we assume remote is newer)
    // However, for a true union where we just want to ensure nothing is lost:
    remoteArr.forEach(item => map.set(item.id, item));
    return Array.from(map.values());
  };

  return {
    ...remote, // Base on remote to catch setting changes/budget updates
    
    // Arrays: Union Logic
    expenses: mergeArrays(local.expenses, remote.expenses),
    fixedPayments: mergeArrays(local.fixedPayments, remote.fixedPayments),
    otherIncome: mergeArrays(local.otherIncome, remote.otherIncome),
    savingsGoals: mergeArrays(local.savingsGoals, remote.savingsGoals),
    loans: mergeArrays(local.loans, remote.loans),
    
    // Investments: Shallow merge of sub-objects to prevent overwriting one person's bank update with another's stale data
    // (This assumes bankBalance keys p1/p2 are updated atomistically, which isn't always true but better than replacing the whole object)
    investments: {
        ...remote.investments,
        bankBalance: { ...local.investments.bankBalance, ...remote.investments.bankBalance },
        mutualFunds: { ...local.investments.mutualFunds, ...remote.investments.mutualFunds },
        stocks: { ...local.investments.stocks, ...remote.investments.stocks },
        gold: { ...local.investments.gold, ...remote.investments.gold },
        silver: { ...local.investments.silver, ...remote.investments.silver },
    },

    // Settings: Usually prefer remote, but keep local device specific stuff if we had any (we don't really)
    settings: {
        ...remote.settings,
        // syncId is critical
        syncId: local.settings.syncId || remote.settings.syncId, 
    }
  };
};

// --- Sync Functions ---

export const fetchCloudState = async (syncId: string): Promise<AppState | null> => {
  if (!supabase) return null;
  
  const { data, error } = await supabase
    .from('app_state')
    .select('data')
    .eq('id', syncId)
    .single();

  if (error || !data) {
    // console.log("No cloud data found or error", error);
    return null;
  }
  
  return mergeState(data.data);
};

export const subscribeToChanges = (syncId: string, onUpdate: (newState: AppState) => void) => {
  if (!supabase) return () => {};

  console.log("Subscribing to channel for:", syncId);

  const channel = supabase
    .channel('room-' + syncId)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'app_state', filter: `id=eq.${syncId}` },
      (payload) => {
        console.log("Received cloud update event:", payload.eventType);
        if (payload.new && (payload.new as any).data) {
          // Directly use the payload data
          onUpdate(mergeState((payload.new as any).data));
        }
      }
    )
    .subscribe((status) => {
       if (status === 'SUBSCRIBED') {
         console.log("Realtime connection established");
       }
    });

  return () => {
    supabase.removeChannel(channel);
  };
};

// --- Exports ---

export const exportData = (state: AppState) => {
  try {
    const data = JSON.stringify(state, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `couple-expense-backup-${new Date().toISOString().split('T')[0]}.json`;
    
    // Crucial: Append to body to ensure click works in all browsers
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }, 100);
  } catch(e) {
      console.error("Export failed:", e);
      alert("Failed to export data.");
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
        text: 'Here is our latest expense data. Import this in Settings.',
        files: [file],
      });
      return true;
    } catch (err) {
      console.error('Error sharing, falling back to download:', err);
      // Fallback to download if sharing fails/is cancelled
      exportData(state);
      return false; 
    }
  } else {
    // Fallback to standard download if sharing isn't supported
    exportData(state);
    return false;
  }
};

export const exportToCSV = (expenses: AppState['expenses']) => {
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
      a.download = `expenses-${new Date().toISOString().split('T')[0]}.csv`;
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
