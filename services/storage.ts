
import { AppState, INITIAL_STATE, INITIAL_INVESTMENTS, Expense } from '../types';
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

export const triggerCloudSave = async (state: AppState) => {
  if (!supabase) return;

  // Get current session to find user ID
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;

  try {
    // Check if row exists for this user
    const { data: existingRows } = await supabase
      .from('app_state')
      .select('id')
      .eq('user_id', session.user.id)
      .limit(1);

    if (existingRows && existingRows.length > 0) {
      // Update existing row
      const { error } = await supabase
        .from('app_state')
        .update({
          data: state,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingRows[0].id);

      if (error) console.error("Cloud update failed:", error);
    } else {
      // Insert new row
      const { error } = await supabase
        .from('app_state')
        .insert({
          user_id: session.user.id,
          data: state,
          updated_at: new Date().toISOString()
        });

      if (error) console.error("Cloud insert failed:", error);
    }
  } catch (err) {
    console.error("Cloud sync exception:", err);
  }
};

export const forceCloudSync = (state: AppState) => {
  if (saveTimeout) clearTimeout(saveTimeout);
  triggerCloudSave(state);
};

export const saveToStorage = (state: AppState, origin: 'local' | 'remote' = 'local') => {
  // Cloud-only mode: Only save to Supabase via debounce
  if (supabase) {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      triggerCloudSave(state);
    }, 500); // Faster sync for "instant" feel
  }
};

export const setupRealtimeSubscription = (userId: string, onUpdate: (newState: AppState) => void) => {
  if (!supabase) return null;

  console.log("Setting up Realtime subscription for user:", userId);
  const channel = supabase
    .channel('app_state_changes')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'app_state',
        filter: `user_id=eq.${userId}`
      },
      (payload) => {
        console.log("Realtime update received:", payload);
        if (payload.new && payload.new.data) {
          const remoteState = mergeState(payload.new.data);
          onUpdate(remoteState);
        }
      }
    )
    .subscribe();

  return channel;
};

export const loadFromStorage = (): AppState => {
  // Local storage disabled for privacy. Always return empty state initially.
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

/**
 * Robust conflict resolution using Last-Write-Wins (LWW).
 */
export const mergeAppState = (local: AppState, remote: AppState): AppState => {
  const lwwMergeArray = <T extends { id: number | string; updatedAt?: number }>(localArr: T[], remoteArr: T[]): T[] => {
    const map = new Map<number | string, T>();
    localArr.forEach(item => map.set(item.id, item));
    remoteArr.forEach(remoteItem => {
      const localItem = map.get(remoteItem.id);
      if (!localItem || (remoteItem.updatedAt || 0) > (localItem.updatedAt || 0)) {
        map.set(remoteItem.id, remoteItem);
      }
    });
    return Array.from(map.values());
  };

  const lwwMergeObject = <T extends { updatedAt?: number }>(localObj: T, remoteObj: T): T => {
    if ((remoteObj.updatedAt || 0) > (localObj.updatedAt || 0)) {
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

export const deleteCloudData = async (): Promise<boolean> => {
  if (!supabase) return false;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return false;

  const { error } = await supabase
    .from('app_state')
    .delete()
    .eq('user_id', session.user.id);

  if (error) {
    console.error("Failed to delete cloud data:", error);
    return false;
  }
  return true;
};

export const checkSupabaseConnection = async (): Promise<{ success: boolean; message: string }> => {
  if (!supabase) return { success: false, message: "Supabase client not initialized (missing credentials)." };

  try {
    const { count: appStateCount, error: appStateError } = await supabase
      .from('app_state')
      .select('*', { count: 'exact', head: true });

    if (appStateError) throw new Error("Could not access 'app_state': " + appStateError.message);

    const { count: historyCount, error: historyError } = await supabase
      .from('history')
      .select('*', { count: 'exact', head: true });

    // History might be optional or restricted, so we don't fail hard if it errors, but good to know.
    if (historyError) console.warn("Could not access 'history': " + historyError.message);

    return {
      success: true,
      message: `Connected! app_state rows: ${appStateCount ?? 'N/A'}, history rows: ${historyCount ?? 'N/A'}`
    };
  } catch (e: any) {
    return { success: false, message: e.message || "Unknown connection error" };
  }
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
  } catch (e) {
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
  } catch (e) {
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
