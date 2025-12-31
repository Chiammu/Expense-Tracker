
import React, { useState, useEffect, useRef } from 'react';
import { loadFromStorage, saveToStorage, fetchCloudState, forceCloudSync, mergeAppState, logAuditEvent } from './services/storage';
import { AppState, INITIAL_STATE, Section, Expense, FixedPayment } from './types';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { AddExpense } from './components/AddExpense';
import { Summaries } from './components/Summaries';
import { Overview } from './components/Overview';
import { Investments } from './components/Investments';
import { Settings } from './components/Settings';
import { LockScreen } from './components/LockScreen';
import { ChatAssistant } from './components/ChatAssistant';
import { PartnerChat } from './components/PartnerChat';
import { Toast } from './components/Toast';
import { RecurringModal } from './components/RecurringModal';
import { Auth } from './components/Auth';
import { supabase } from './services/supabaseClient';
import { SkeletonLoader } from './components/SkeletonLoader';
import { ErrorBoundary } from './components/ErrorBoundary';

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
  
  const lastUpdateWasRemote = useRef(false);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => {
    const checkSession = async () => {
      if (!supabase) { setAuthInitialized(true); return; }
      const { data: { session: existingSession } } = await supabase.auth.getSession();
      if (existingSession) setSession(existingSession);
      setAuthInitialized(true);
    };
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === 'SIGNED_OUT') {
        localStorage.removeItem('deviceUserIdentity');
        setState(INITIAL_STATE);
        setLoaded(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if ((!session && !isGuest) || !authInitialized) return;

    const init = async () => {
      const localData = loadFromStorage();
      let currentState = localData;
      
      if (session?.user?.id) {
        try {
          const cloudData = await fetchCloudState(session.user.id);
          if (cloudData) {
            currentState = mergeAppState(localData, cloudData);
            lastUpdateWasRemote.current = true;
          } else {
            forceCloudSync(localData);
          }
        } catch (e) {
          console.error("Cloud fetch failed:", e);
        }
      }

      setState(currentState);
      setLoaded(true);
      if (currentState.settings.pin || currentState.settings.webAuthnCredentialId) setIsLocked(true);

      if (currentState.fixedPayments.length > 0) {
        const lastCheck = currentState.settings.lastFixedPaymentCheck ? new Date(currentState.settings.lastFixedPaymentCheck) : new Date();
        const now = new Date();
        if (now.getMonth() !== lastCheck.getMonth() || now.getFullYear() !== lastCheck.getFullYear()) {
           setDuePayments(currentState.fixedPayments.filter(p => p.day <= now.getDate()));
           setShowRecurringModal(true);
        }
      }
    };
    init();
  }, [session, isGuest, authInitialized]);

  useEffect(() => {
    if (loaded) {
      const origin = lastUpdateWasRemote.current ? 'remote' : 'local';
      saveToStorage(state, origin);
      lastUpdateWasRemote.current = false;
    }
  }, [state, loaded]);

  const addExpense = (expense: Omit<Expense, 'id' | 'updatedAt'>) => {
    const newExpense: Expense = { ...expense, id: Date.now(), updatedAt: Date.now() };
    setState(prev => {
        let updatedCards = prev.creditCards;
        if (newExpense.paymentMode === 'Card' && newExpense.cardId) {
          updatedCards = prev.creditCards.map(c => c.id === newExpense.cardId ? { ...c, currentBalance: c.currentBalance + newExpense.amount, updatedAt: Date.now() } : c);
        }
        const next = { ...prev, expenses: [...prev.expenses, newExpense], creditCards: updatedCards };
        if (!isGuest && session) forceCloudSync(next);
        return next;
    });
    logAuditEvent('EXPENSE_ADDED', { amount: expense.amount, category: expense.category });
    showToast("Expense added", 'success');
  };

  const updateExpense = (updatedExpense: Expense) => {
    const withTimestamp = { ...updatedExpense, updatedAt: Date.now() };
    setState(prev => {
      const next = { ...prev, expenses: prev.expenses.map(e => e.id === withTimestamp.id ? withTimestamp : e) };
      if (!isGuest && session) forceCloudSync(next);
      return next;
    });
    logAuditEvent('EXPENSE_UPDATED', { id: updatedExpense.id });
    setExpenseToEdit(null);
    showToast("Updated", 'success');
    setActiveSection('summaries'); 
  };

  const deleteExpense = (id: number) => {
    const exp = state.expenses.find(e => e.id === id);
    if (window.confirm("Delete this?")) {
      setState(prev => {
          const next = { ...prev, expenses: prev.expenses.filter(e => e.id !== id) };
          if (!isGuest && session) forceCloudSync(next);
          return next;
      });
      logAuditEvent('EXPENSE_DELETED', { id, amount: exp?.amount });
    }
  };

  const updateSettings = (newSettings: Partial<AppState['settings']>) => {
    setState(prev => {
      const next = { ...prev, settings: { ...prev.settings, ...newSettings, updatedAt: Date.now() } };
      if (!isGuest && session) forceCloudSync(next);
      return next;
    });
    logAuditEvent('SETTINGS_CHANGED', Object.keys(newSettings));
  };

  const togglePrivacy = () => {
    const newVal = !state.settings.privacyMode;
    updateSettings({ privacyMode: newVal });
    logAuditEvent('PRIVACY_TOGGLED', { active: newVal });
    showToast(newVal ? "Privacy Mode Enabled" : "Privacy Mode Disabled", "info");
  };

  const deleteAccount = async () => {
    if (!window.confirm("CRITICAL: This will permanently delete your cloud data. Proceed?")) return;
    try {
      if (session?.user?.id && supabase) {
        logAuditEvent('ACCOUNT_DELETION_REQUESTED');
        await supabase.from('app_state').delete().eq('user_id', session.user.id);
        await supabase.auth.signOut();
      }
      localStorage.clear();
      window.location.reload();
    } catch (e) {
      showToast("Error during deletion", 'error');
    }
  };

  return (
    <>
      {isLocked && (state.settings.pin || state.settings.webAuthnCredentialId) && (
        <LockScreen 
          pin={state.settings.pin} 
          webAuthnId={state.settings.webAuthnCredentialId} 
          onUnlock={() => setIsLocked(false)} 
        />
      )}
      {showRecurringModal && <RecurringModal payments={duePayments} onConfirm={() => setShowRecurringModal(false)} onCancel={() => setShowRecurringModal(false)} />}
      {showChat && <ChatAssistant state={state} addExpense={addExpense} onClose={() => setShowChat(false)} />}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {!authInitialized ? (
        <SkeletonLoader />
      ) : !session && !isGuest ? (
        <Auth onAuthSuccess={() => {}} onGuestLogin={() => setIsGuest(true)} showToast={showToast} />
      ) : (
        <div className={`min-h-screen bg-background text-text ${state.settings.privacyMode ? 'privacy-active' : ''}`}>
          <div className="max-w-3xl mx-auto px-2 pt-4">
            <Header settings={state.settings} onTogglePrivacy={togglePrivacy} />
            <main className="relative pb-24">
              <ErrorBoundary fallbackTitle="Section Error">
                {activeSection === 'add-expense' && <AddExpense state={state} addExpense={addExpense} updateExpense={updateExpense} expenseToEdit={expenseToEdit} cancelEdit={() => setExpenseToEdit(null)} switchTab={setActiveSection} showToast={showToast} />}
                {activeSection === 'summaries' && <Summaries state={state} deleteExpense={deleteExpense} editExpense={exp => { setExpenseToEdit(exp); setActiveSection('add-expense'); }} />}
                {activeSection === 'investments' && <Investments state={state} updateState={updates => setState(prev => ({ ...prev, ...updates }))} showToast={showToast} />}
                {activeSection === 'overview' && <Overview state={state} updateBudget={b => setState(p => ({...p, monthlyBudget: b}))} updateIncome={(p1, p2) => setState(p => ({...p, incomePerson1: p1, incomePerson2: p2}))} addFixedPayment={(n, a, d) => setState(p => ({...p, fixedPayments: [...p.fixedPayments, {id: Date.now(), name: n, amount: a, day: d, updatedAt: Date.now()}]}))} removeFixedPayment={id => setState(p => ({...p, fixedPayments: p.fixedPayments.filter(fp => fp.id !== id)}))} updateState={updates => setState(prev => ({ ...prev, ...updates }))} />}
                {activeSection === 'chat' && <PartnerChat state={state} />}
                {activeSection === 'settings' && <Settings state={state} updateSettings={updateSettings} resetData={() => {localStorage.clear(); window.location.reload();}} deleteAccount={deleteAccount} showToast={showToast} installApp={() => {}} canInstall={false} isIos={false} isStandalone={false} />}
              </ErrorBoundary>
            </main>
            <BottomNav activeSection={activeSection} setSection={setActiveSection} />
            <button onClick={() => setShowChat(true)} className="fixed bottom-24 right-4 w-12 h-12 bg-gradient-to-tr from-primary to-purple-600 text-white rounded-full shadow-lg flex items-center justify-center text-xl z-40 hover:scale-110 active:scale-90 transition-transform">🤖</button>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
