
import React, { useState, useEffect, useRef } from 'react';
import { loadFromStorage, saveToStorage, fetchCloudState, forceCloudSync, mergeAppState, exportMonthlyReportPDF, exportToCSV } from './services/storage';
import { AppState, INITIAL_STATE, Section, Expense, FixedPayment, DEFAULT_CATEGORIES } from './types';
import { generateMonthlyDigest } from './services/geminiService';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { AddExpense } from './components/AddExpense';
import { Summaries } from './components/Summaries';
import { Overview } from './components/Overview';
import { Investments } from './components/Investments';
import { Settings } from './components/Settings';
import { LockScreen } from './components/LockScreen';
import { ChatAssistant } from './components/ChatAssistant';
import { Toast } from './components/Toast';
import { RecurringModal } from './components/RecurringModal';
import { Auth } from './components/Auth';
import { supabase } from './services/supabaseClient';

function App() {
  const [session, setSession] = useState<any>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [activeSection, setActiveSection] = useState<Section>('add-expense');
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [loaded, setLoaded] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [showChat, setShowChat] = useState(false);
  
  const [duePayments, setDuePayments] = useState<FixedPayment[]>([]);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  
  const prevSyncIdRef = useRef<string | null>(null);
  const lastUpdateWasRemote = useRef(false);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (!supabase) { setAuthInitialized(true); return; }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthInitialized(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if ((!session && !isGuest) || !authInitialized) return;

    const init = async () => {
      const localData = loadFromStorage();
      let currentState = localData;
      
      if (localData.settings.syncId && !isGuest) {
        try {
          const cloudData = await fetchCloudState(localData.settings.syncId);
          if (cloudData) currentState = mergeAppState(localData, cloudData);
        } catch (e) {}
      }

      setState(currentState);
      setLoaded(true);
      if (currentState.settings.pin) setIsLocked(true);

      if (currentState.fixedPayments.length > 0) {
        const lastCheck = currentState.settings.lastFixedPaymentCheck ? new Date(currentState.settings.lastFixedPaymentCheck) : new Date();
        const now = new Date();
        if (now.getMonth() !== lastCheck.getMonth() || now.getFullYear() !== lastCheck.getFullYear()) {
           setDuePayments(currentState.fixedPayments.filter(p => p.day <= now.getDate()));
           setShowRecurringModal(true);
        }
      }

      const now = new Date();
      const currentMonthStr = `${now.getFullYear()}-${now.getMonth()}`;
      if (now.getDate() === 1 && currentState.settings.emailReportsEnabled && currentState.settings.lastReportSentMonth !== currentMonthStr) {
          setTimeout(() => {
            if(confirm("It's the 1st of the month! Generate your Monthly AI Advisor Report (PDF & Excel)?")) {
               generateMonthlyDigest(currentState).then(digest => {
                  // Export PDF
                  exportMonthlyReportPDF(currentState, digest);
                  
                  // Export Excel (Month Data)
                  const monthExpenses = currentState.expenses.filter(e => {
                    const d = new Date(e.date);
                    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                  });
                  exportToCSV(monthExpenses, `Monthly-Data-${currentMonthStr}`);

                  // Also prompt for email
                  if (currentState.settings.reportEmail) {
                    const subject = `Monthly Financial Digest - ${now.toLocaleString('default', { month: 'long', year: 'numeric' })}`;
                    const mailtoUrl = `mailto:${currentState.settings.reportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(digest)}`;
                    window.location.href = mailtoUrl;
                  }

                  setState(prev => ({ 
                    ...prev, 
                    settings: { ...prev.settings, lastReportSentMonth: currentMonthStr } 
                  }));
                  showToast("Monthly Reports Exported Successfully!", "success");
               });
            }
          }, 3000);
      }
    };
    init();
  }, [session, isGuest, authInitialized]);

  useEffect(() => {
    if (loaded && !isGuest) {
      saveToStorage(state, lastUpdateWasRemote.current ? 'remote' : 'local');
      lastUpdateWasRemote.current = false;
    }
  }, [state, loaded, isGuest]);

  const addExpense = (expense: Omit<Expense, 'id'>) => {
    const newExpense: Expense = { ...expense, id: Date.now() };
    setState(prev => {
        let updatedCards = prev.creditCards;
        if (newExpense.paymentMode === 'Card' && newExpense.cardId) {
          updatedCards = prev.creditCards.map(c => c.id === newExpense.cardId ? { ...c, currentBalance: c.currentBalance + newExpense.amount } : c);
        }
        const next = { ...prev, expenses: [...prev.expenses, newExpense], creditCards: updatedCards };
        if (!isGuest) forceCloudSync(next);
        return next;
    });
    showToast("Expense added", 'success');
  };

  const updateExpense = (updatedExpense: Expense) => {
    setState(prev => {
      const next = { ...prev, expenses: prev.expenses.map(e => e.id === updatedExpense.id ? updatedExpense : e) };
      if (!isGuest) forceCloudSync(next);
      return next;
    });
    setExpenseToEdit(null);
    showToast("Updated", 'success');
    setActiveSection('summaries'); 
  };

  const deleteExpense = (id: number) => {
    if (window.confirm("Delete this?")) {
      setState(prev => {
          const next = { ...prev, expenses: prev.expenses.filter(e => e.id !== id) };
          if (!isGuest) forceCloudSync(next);
          return next;
      });
    }
  };

  const updateSettings = (newSettings: Partial<AppState['settings']>) => {
    setState(prev => ({ ...prev, settings: { ...prev.settings, ...newSettings } }));
  };

  return (
    <>
      {isLocked && state.settings.pin && <LockScreen pin={state.settings.pin} onUnlock={() => setIsLocked(false)} />}
      {showRecurringModal && <RecurringModal payments={duePayments} onConfirm={() => setShowRecurringModal(false)} onCancel={() => setShowRecurringModal(false)} />}
      {showChat && <ChatAssistant state={state} onClose={() => setShowChat(false)} />}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {!authInitialized ? (
        <div className="flex h-screen items-center justify-center bg-background"><div className="animate-spin text-4xl">🌀</div></div>
      ) : !session && !isGuest ? (
        <Auth onAuthSuccess={() => {}} onGuestLogin={() => setIsGuest(true)} showToast={showToast} />
      ) : (
        <div className="min-h-screen bg-background text-text">
          <div className="max-w-3xl mx-auto px-2 pt-4">
            <Header settings={state.settings} />
            <main className="relative pb-24">
              {activeSection === 'add-expense' && <AddExpense state={state} addExpense={addExpense} updateExpense={updateExpense} expenseToEdit={expenseToEdit} cancelEdit={() => setExpenseToEdit(null)} switchTab={setActiveSection} showToast={showToast} />}
              {activeSection === 'summaries' && <Summaries state={state} deleteExpense={deleteExpense} editExpense={exp => { setExpenseToEdit(exp); setActiveSection('add-expense'); }} />}
              {activeSection === 'investments' && <Investments state={state} updateState={updates => setState(prev => ({ ...prev, ...updates }))} showToast={showToast} />}
              {activeSection === 'overview' && <Overview state={state} updateBudget={b => setState(p => ({...p, monthlyBudget: b}))} updateIncome={(p1, p2) => setState(p => ({...p, incomePerson1: p1, incomePerson2: p2}))} addFixedPayment={(n, a, d) => setState(p => ({...p, fixedPayments: [...p.fixedPayments, {id: Date.now(), name: n, amount: a, day: d}]}))} removeFixedPayment={id => setState(p => ({...p, fixedPayments: p.fixedPayments.filter(fp => fp.id !== id)}))} updateState={updates => setState(prev => ({ ...prev, ...updates }))} />}
              {activeSection === 'settings' && <Settings state={state} updateSettings={updateSettings} resetData={() => {localStorage.clear(); window.location.reload();}} importData={() => {}} showToast={showToast} installApp={() => {}} canInstall={false} isIos={false} isStandalone={false} />}
            </main>
            <BottomNav activeSection={activeSection} setSection={setActiveSection} />
            <button onClick={() => setShowChat(true)} className="fixed bottom-24 right-4 w-12 h-12 bg-gradient-to-tr from-primary to-purple-600 text-white rounded-full shadow-lg flex items-center justify-center text-xl z-40">🤖</button>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
