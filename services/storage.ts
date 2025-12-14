import { AppState, INITIAL_STATE } from '../types';
import { supabase } from './supabaseClient';
// @ts-ignore
import jsPDF from 'jspdf';
// @ts-ignore
import 'jspdf-autotable';

const STORAGE_KEY = 'coupleExpenseTrackerV4_React';

// Debounce timer for cloud saves
let saveTimeout: any = null;
let isRemoteUpdate = false;

export const saveToStorage = (state: AppState) => {
  try {
    // 1. Save Local (Instant)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

    // 2. Save Cloud (Debounced) if Sync ID exists
    // We check !isRemoteUpdate to prevent loops where receiving a cloud update triggers a cloud save
    if (state.settings.syncId && supabase && !isRemoteUpdate) {
      if (saveTimeout) clearTimeout(saveTimeout);
      
      // Reduced debounce to 500ms for snappier chat experience
      saveTimeout = setTimeout(async () => {
        const { error } = await supabase
          .from('app_state')
          .upsert({ 
            id: state.settings.syncId, 
            data: state, 
            updated_at: new Date().toISOString() 
          });
          
        if (error) console.error("Cloud sync failed:", error);
        // else console.log("Cloud sync saved");
      }, 500); 
    }
    
    // Reset flag
    isRemoteUpdate = false;
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
      { event: 'UPDATE', schema: 'public', table: 'app_state', filter: `id=eq.${syncId}` },
      (payload) => {
        console.log("Received cloud update");
        if (payload.new && payload.new.data) {
          isRemoteUpdate = true; // Set flag to prevent echo-save
          // Directly use the payload data if available for instant update
          onUpdate(mergeState(payload.new.data));
        }
      }
    )
    .subscribe((status) => {
       if (status === 'SUBSCRIBED') {
         // console.log("Realtime connection established");
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