
import React, { useState, useEffect, useRef } from 'react';
import { loadFromStorage, saveToStorage, fetchCloudState, forceCloudSync, mergeAppState, logAuditEvent, mergeState } from './services/storage';
import { AppState, INITIAL_STATE, Section, Expense, FixedPayment } from './types';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { AddExpense } from './components/AddExpense';
import { Summaries } from './components/Summaries';
import { Overview } from './components/Overview';
import { Investments } from './components/Investments';
import { Settings } from './components/Settings';
import { LockScreen } from './components/LockScreen';
import { Toast } from './components/Toast';
import { RecurringModal } from './components/RecurringModal';
import { Auth } from './components/Auth';
import { supabase } from './services/supabaseClient';
import { SkeletonLoader } from './components/SkeletonLoader';
import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
  const [session, setSession] = useState<any>(null);
  const [isGuest, setIsGuest] = useState(() => localStorage.getItem('guestMode') === 'true');
  const [authInitialized, setAuthInitialized] = useState(false);
  const [activeSection, setActiveSection] = useState<Section>('add-expense');
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [loaded, setLoaded] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  
  const [duePayments, setDuePayments] = useState<FixedPayment[]>([]);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  
  const lastUpdateWasRemote = useRef(false);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => {
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true);

    const initAuth = async () => {
      if (!supabase) {
        setAuthInitialized(true);
        return;
      }
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        setSession(currentSession);
      } catch (e) {
        console.error("Auth session error:", e);
      }
      setAuthInitialized(true);
    };
    initAuth();

    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
        setSession(newSession);
        if (event === 'SIGNED_OUT') {
          localStorage.removeItem('guestMode');
          setIsGuest(false);
          setState(INITIAL_STATE);
          setLoaded(false);
        }
      });
      return () => subscription.unsubscribe();
    }
  }, []);

  useEffect(() => {
    if (!authInitialized) return;
    if (!session && !isGuest) {
      setLoaded(true); // Stop loader if not logged in
      return;
    }

    const initData = async () => {
      setLoaded(false); // Show loader while fetching cloud data
      
      let currentState = INITIAL_STATE;
      const localData = loadFromStorage();
      
      if (session?.user?.id && supabase) {
        try {
          // Fetch Cloud state FIRST as absolute source of truth upon login
          // We pass localData.settings.syncId to check for partner records
          const cloudData = await fetchCloudState(session.user.id, localData.settings.syncId);
          if (cloudData) {
            // Merging local into cloud, with remote as priority
            currentState = mergeAppState(localData, cloudData);
            lastUpdateWasRemote.current = true;
          } else {
            // No cloud data yet, initialize with local
            currentState = localData;
            forceCloudSync(localData);
          }
        } catch (e) {
          console.error("Cloud fetch failed, using local fallback:", e);
          currentState = localData;
        }
      } else {
        // Not logged in (Guest Mode)
        currentState = localData;
      }

      setState(currentState);
      setLoaded(true);
      
      if (currentState.settings.pin) {
        setIsLocked(true);
      }

      if (currentState.fixedPayments.length > 0) {
        const lastCheck = currentState.settings.lastFixedPaymentCheck ? new Date(currentState.settings.lastFixedPaymentCheck) : new Date(0);
        const now = new Date();
        if (now.getMonth() !== lastCheck.getMonth() || now.getFullYear() !== lastCheck.getFullYear()) {
           setDuePayments(currentState.fixedPayments.filter(p => p.day <= now.getDate()));
           setShowRecurringModal(true);
        }
      }
    };
    initData();
  }, [session, isGuest, authInitialized]);

  // Cloud Sync Listener (Real-time)
  useEffect(() => {
    if (!supabase || !session?.user?.id || !loaded) return;

    // Filter by sync_id if available, otherwise fallback to own user_id
    const filter = state.settings.syncId 
      ? `sync_id=eq.${state.settings.syncId}` 
      : `user_id=eq.${session.user.id}`;

    const channel = supabase
      .channel('app-state-realtime')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'app_state',
          filter: filter
        },
        (payload: any) => {
          if (payload.new && payload.new.data) {
            const remoteState = mergeState(payload.new.data);
            
            // Only update if the remote state has newer content
            setState(current => {
              const merged = mergeAppState(current, remoteState);
              // Use JSON string comparison for simple check
              if (JSON.stringify(current) === JSON.stringify(merged)) return current;
              
              lastUpdateWasRemote.current = true;
              return merged;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, state.settings.syncId, loaded]);

  useEffect(() => {
    if (loaded && (session || isGuest)) {
      const origin = lastUpdateWasRemote.current ? 'remote' : 'local';
      saveToStorage(state, origin);
      lastUpdateWasRemote.current = false;
    }
  }, [state, loaded]);

  const addExpense = (expense: Omit<Expense, 'id' | 'updatedAt'>) => {
    const timestamp = Date.now();
    const newExpense: Expense = { ...expense, id: timestamp, updatedAt: timestamp };
    setState(prev => {
        let updatedCards = prev.creditCards;
        if (newExpense.paymentMode === 'Card' && newExpense.cardId) {
          updatedCards = prev.creditCards.map(c => c.id === newExpense.cardId ? { ...c, currentBalance: c.currentBalance + newExpense.amount, updatedAt: timestamp } : c);
        }
        const next = { ...prev, expenses: [...prev.expenses, newExpense], creditCards: updatedCards };
        if (!isGuest && session) forceCloudSync(next);
        return next;
    });
    logAuditEvent('EXPENSE_ADDED', { amount: expense.amount, category: expense.category });
    showToast("Expense added", 'success');
  };

  const updateExpense = (updatedExpense: Expense) => {
    const timestamp = Date.now();
    const withTimestamp = { ...updatedExpense, updatedAt: timestamp };
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
    const timestamp = Date.now();
    setState(prev => {
      const next = { ...prev, settings: { ...prev.settings, ...newSettings, updatedAt: timestamp } };
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
    if (!window.confirm("Permanently delete cloud data?")) return;
    try {
      if (session?.user?.id && supabase) {
        await supabase.from('app_state').delete().eq('user_id', session.user.id);
        await supabase.auth.signOut();
      }
      localStorage.clear();
      window.location.reload();
    } catch (e) {
      showToast("Error during deletion", 'error');
    }
  };

  const handleGuestLogin = () => {
    localStorage.setItem('guestMode', 'true');
    setIsGuest(true);
  };

  if (!authInitialized || !loaded) return <SkeletonLoader />;

  return (
    <>
      {isLocked && state.settings.pin && (
        <LockScreen 
          pin={state.settings.pin} 
          onUnlock={() => setIsLocked(false)} 
        />
      )}
      {showRecurringModal && <RecurringModal payments={duePayments} onConfirm={() => {
        setShowRecurringModal(false);
        updateSettings({ lastFixedPaymentCheck: new Date().toISOString() });
      }} onCancel={() => setShowRecurringModal(false)} />}
      
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {!session && !isGuest ? (
        <Auth onAuthSuccess={() => {}} onGuestLogin={handleGuestLogin} showToast={showToast} />
      ) : (
        <div className={`min-h-screen bg-background text-text ${state.settings.privacyMode ? 'privacy-active' : ''} ${isStandalone ? 'standalone-mode' : ''}`}>
          <div className="max-w-3xl mx-auto px-2 pt-4 h-full flex flex-col">
            <Header settings={state.settings} onTogglePrivacy={togglePrivacy} />
            <main className="flex-1 overflow-y-auto pb-28 px-2 scrollbar-hide">
              <ErrorBoundary fallbackTitle="Section Error">
                {activeSection === 'add-expense' && <AddExpense state={state} addExpense={addExpense} updateExpense={updateExpense} expenseToEdit={expenseToEdit} cancelEdit={() => setExpenseToEdit(null)} switchTab={setActiveSection} showToast={showToast} />}
                {activeSection === 'summaries' && <Summaries state={state} deleteExpense={deleteExpense} editExpense={exp => { setExpenseToEdit(exp); setActiveSection('add-expense'); }} />}
                {activeSection === 'investments' && <Investments state={state} updateState={updates => setState(prev => ({ ...prev, ...updates }))} showToast={showToast} />}
                {activeSection === 'overview' && <Overview state={state} updateBudget={b => setState(p => ({...p, monthlyBudget: b}))} updateIncome={(p1, p2) => setState(p => ({...p, incomePerson1: p1, incomePerson2: p2}))} addFixedPayment={(n, a, d) => setState(p => ({...p, fixedPayments: [...p.fixedPayments, {id: Date.now(), name: n, amount: a, day: d, updatedAt: Date.now()}]}))} removeFixedPayment={id => setState(p => ({...p, fixedPayments: p.fixedPayments.filter(fp => fp.id !== id)}))} updateState={updates => setState(prev => ({ ...prev, ...updates }))} />}
                {activeSection === 'settings' && <Settings state={state} updateSettings={updateSettings} onImportState={(ns) => { setState(ns); if(!isGuest && session) forceCloudSync(ns); }} resetData={() => {localStorage.clear(); window.location.reload();}} deleteAccount={deleteAccount} showToast={showToast} />}
              </ErrorBoundary>
            </main>
            <BottomNav activeSection={activeSection} setSection={setActiveSection} />
          </div>
        </div>
      )}
    </>
  );
}

export default App;
