
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

const generateCategoryChartImage = (categories: Record<string, number>): string => {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 400;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const entries = Object.entries(categories).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const total = entries.reduce((s, d) => s + d[1], 0);
  const colors = ['#e91e63', '#2196f3', '#ff6f00', '#4caf50', '#9c27b0', '#00bcd4', '#ffc107', '#607d8b'];
  
  let currentAngle = -0.5 * Math.PI;
  const centerX = 200, centerY = 200, radius = 150;

  entries.forEach((d, i) => {
    const sliceAngle = (d[1] / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();
    
    ctx.fillRect(400, 50 + i * 40, 20, 20);
    ctx.fillStyle = '#333';
    ctx.font = 'bold 20px Helvetica';
    ctx.fillText(`${d[0]} (₹${d[1].toLocaleString()})`, 430, 67 + i * 40);

    currentAngle += sliceAngle;
  });

  return canvas.toDataURL('image/png');
};

export const exportMonthlyReportPDF = (state: AppState, digest: string) => {
  const doc = new jsPDF();
  const now = new Date();
  const monthLabel = now.toLocaleString('default', { month: 'long', year: 'numeric' });
  const primaryColor: [number, number, number] = [233, 30, 99];
  const grayColor: [number, number, number] = [100, 100, 100];

  const monthExpenses = state.expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const totalSpent = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const budget = state.monthlyBudget || 0;
  const savings = budget - totalSpent;
  
  const categories = monthExpenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {} as Record<string, number>);

  // Header Block
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 210, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text("MONTHLY FINANCIAL DIGEST", 15, 20);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`${monthLabel} | ${state.settings.person1Name} & ${state.settings.person2Name}`, 15, 30);

  // Summary Grid
  let y = 50;
  doc.setFillColor(248, 249, 250);
  doc.roundedRect(15, y, 180, 25, 2, 2, 'F');
  
  doc.setTextColor(...primaryColor);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text("TOTAL SPENT", 25, y + 8);
  doc.setFontSize(14);
  doc.text(`₹${totalSpent.toLocaleString()}`, 25, y + 18);

  doc.setTextColor(33, 150, 243);
  doc.setFontSize(9);
  doc.text("BUDGET", 85, y + 8);
  doc.setFontSize(14);
  doc.text(`₹${budget.toLocaleString()}`, 85, y + 18);

  doc.setTextColor(savings >= 0 ? 76 : 244, savings >= 0 ? 175 : 67, 80);
  doc.setFontSize(9);
  doc.text("SAVINGS", 145, y + 8);
  doc.setFontSize(14);
  doc.text(`₹${savings.toLocaleString()}`, 145, y + 18);

  // Chart
  y += 35;
  doc.setTextColor(33, 33, 33);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text("Spending Distribution", 15, y);
  
  const chartImg = generateCategoryChartImage(categories);
  if (chartImg) {
    doc.addImage(chartImg, 'PNG', 15, y + 5, 180, 75);
  }

  // Insights Section
  y += 90;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text("AI Financial Advisor Insights", 15, y);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);
  
  const cleanDigest = digest.replace(/[^\x00-\x7F]/g, "").trim();
  const lines = doc.splitTextToSize(cleanDigest, 180);
  doc.text(lines, 15, y + 10);

  // Table Page
  doc.addPage();
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 210, 15, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text(`Transaction Breakdown - ${monthLabel}`, 15, 10);

  const tableRows = monthExpenses.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(e => [
    e.date,
    e.person === 'Both' ? 'Both' : (e.person === 'Person1' ? state.settings.person1Name : state.settings.person2Name),
    e.category,
    `Rs. ${e.amount.toLocaleString()}`,
    e.note || '-'
  ]);

  (doc as any).autoTable({
    startY: 25,
    head: [['Date', 'Who', 'Category', 'Amount', 'Note']],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: primaryColor, font: 'helvetica', fontSize: 10 },
    bodyStyles: { fontSize: 9, font: 'helvetica' },
    margin: { left: 15, right: 15 }
  });

  const totalPages = doc.internal.getNumberOfPages();
  for(let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${i} of ${totalPages} | Powered by Gemini AI`, 105, 290, { align: 'center' });
  }

  doc.save(`Monthly-Report-${monthLabel.replace(' ', '-')}.pdf`);
};

export const exportToPDF = (state: AppState) => {
  const doc = new jsPDF();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(`${state.settings.headerTitle} - Full Export`, 14, 22);
  const rows = state.expenses.map(e => [e.date, e.person, e.category, e.amount.toFixed(2), e.note]);
  (doc as any).autoTable({
    startY: 30,
    head: [['Date', 'Person', 'Category', 'Amount', 'Note']],
    body: rows,
    headStyles: { fillColor: [233, 30, 99] }
  });
  doc.save(`expenses-full-export.pdf`);
};
