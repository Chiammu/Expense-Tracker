
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

/**
 * Creates a pie chart representation for the PDF using Canvas API.
 */
const generateCategoryChartImage = (categories: Record<string, number>): string => {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 400;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const data = Object.entries(categories).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const total = data.reduce((s, d) => s + d[1], 0);
  const colors = ['#e91e63', '#2196f3', '#ff6f00', '#4caf50', '#9c27b0', '#00bcd4', '#ffc107', '#607d8b'];
  
  let currentAngle = -0.5 * Math.PI;
  const centerX = 200, centerY = 200, radius = 150;

  data.forEach((d, i) => {
    const sliceAngle = (d[1] / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();
    
    // Legend
    ctx.fillRect(400, 50 + i * 40, 20, 20);
    ctx.fillStyle = '#333';
    ctx.font = 'bold 20px Helvetica';
    ctx.fillText(`${d[0]} (₹${d[1].toLocaleString()})`, 430, 67 + i * 40);

    currentAngle += sliceAngle;
  });

  return canvas.toDataURL('image/png');
};

/**
 * Beautiful Monthly Financial Advisor PDF Report
 */
export const exportMonthlyReportPDF = (state: AppState, digest: string) => {
  const doc = new jsPDF();
  const now = new Date();
  const monthLabel = now.toLocaleString('default', { month: 'long', year: 'numeric' });
  // Fix: Explicitly define as number tuples to allow spreading into doc functions.
  const primaryColor: [number, number, number] = [233, 30, 99]; // App Pink
  const grayColor: [number, number, number] = [117, 117, 117];

  // Calculations for Summary
  const monthExpenses = state.expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const totalSpent = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const budget = state.monthlyBudget || 0;
  const savings = budget > 0 ? budget - totalSpent : 0;
  
  const categories = monthExpenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {} as Record<string, number>);

  // --- PAGE 1 ---
  
  // 1. Modern Header
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 210, 45, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.text("MONTHLY FINANCIAL DIGEST", 15, 25);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(14);
  doc.text(monthLabel, 15, 35);
  doc.text(`${state.settings.person1Name} & ${state.settings.person2Name}`, 210 - 15, 35, { align: 'right' });

  // 2. Summary Stats Cards
  let cardY = 55;
  const cardWidth = 60;
  const gutter = 5;
  const startX = 15;

  // Total Spent Card
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(startX, cardY, cardWidth, 30, 3, 3, 'F');
  doc.setTextColor(...primaryColor);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text("TOTAL SPENT", startX + 5, cardY + 10);
  doc.setFontSize(16);
  doc.text(`₹${totalSpent.toLocaleString()}`, startX + 5, cardY + 22);

  // Budget Card
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(startX + cardWidth + gutter, cardY, cardWidth, 30, 3, 3, 'F');
  doc.setTextColor(33, 150, 243); // blue
  doc.setFontSize(10);
  doc.text("MONTHLY BUDGET", startX + cardWidth + gutter + 5, cardY + 10);
  doc.setFontSize(16);
  doc.text(`₹${budget.toLocaleString()}`, startX + cardWidth + gutter + 5, cardY + 22);

  // Net Savings Card
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(startX + (cardWidth + gutter) * 2, cardY, cardWidth, 30, 3, 3, 'F');
  doc.setTextColor(savings >= 0 ? 76 : 244, savings >= 0 ? 175 : 67, savings >= 0 ? 80 : 54); // green or red
  doc.setFontSize(10);
  doc.text("NET SAVINGS", startX + (cardWidth + gutter) * 2 + 5, cardY + 10);
  doc.setFontSize(16);
  doc.text(`₹${savings.toLocaleString()}`, startX + (cardWidth + gutter) * 2 + 5, cardY + 22);

  // 3. Category Spending Chart
  doc.setTextColor(33, 33, 33);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text("Spending Distribution", 15, cardY + 45);
  
  const chartImg = generateCategoryChartImage(categories);
  if (chartImg) {
    doc.addImage(chartImg, 'PNG', 15, cardY + 50, 180, 70);
  }

  // 4. AI Advisor Insights
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text("Personal Financial Advisor Insights", 15, cardY + 130);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  
  // Clean digest text from weird encoding
  const cleanDigest = digest.replace(/[^\x00-\x7F]/g, "").trim();
  const splitDigest = doc.splitTextToSize(cleanDigest, 180);
  doc.text(splitDigest, 15, cardY + 140);

  // --- PAGE 2 ---
  doc.addPage();
  
  // Re-draw Mini Header for Page 2
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 210, 20, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.text(`Transaction Breakdown - ${monthLabel}`, 15, 13);

  const rows = monthExpenses.map(e => [
    e.date,
    e.person === 'Both' ? 'Shared' : (e.person === 'Person1' ? state.settings.person1Name : state.settings.person2Name),
    e.category,
    `Rs. ${e.amount.toFixed(2)}`,
    e.note || '-'
  ]);

  (doc as any).autoTable({
    startY: 30,
    head: [['Date', 'Person', 'Category', 'Amount', 'Note']],
    body: rows,
    theme: 'striped',
    headStyles: { 
      fillColor: primaryColor, 
      font: 'helvetica', 
      fontStyle: 'bold',
      halign: 'center'
    },
    bodyStyles: { 
      font: 'helvetica',
      fontSize: 9
    },
    columnStyles: {
      3: { halign: 'right', fontStyle: 'bold' }
    },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    margin: { left: 15, right: 15 }
  });

  // Footer on all pages
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    // Fix: Explicitly spread the tuple grayColor.
    doc.setTextColor(...grayColor);
    doc.text(`Financial Advisor Report | Powered by Gemini AI | Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
  }

  doc.save(`Financial-Digest-${monthLabel.replace(' ', '-')}.pdf`);
};

export const exportToPDF = (state: AppState) => {
  const doc = new jsPDF();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(`${state.settings.headerTitle} Report`, 14, 22);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30);
  const totalExp = state.expenses.reduce((s, e) => s + e.amount, 0);
  (doc as any).autoTable({
    startY: 40,
    head: [['Metric', 'Value']],
    body: [['Total Expenses', `Rs. ${totalExp.toFixed(2)}`]],
    theme: 'plain',
    headStyles: { fontStyle: 'bold' }
  });
  const rows = state.expenses.map(e => [e.date, e.person, e.category, e.amount.toFixed(2), e.note]);
  (doc as any).autoTable({
    startY: (doc as any).lastAutoTable.finalY + 10,
    head: [['Date', 'Person', 'Category', 'Amount', 'Note']],
    body: rows,
    headStyles: { fillColor: [233, 30, 99] }
  });
  doc.save(`expense-report-${new Date().toISOString().split('T')[0]}.pdf`);
};
