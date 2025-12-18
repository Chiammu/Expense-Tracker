
import React, { useState, useEffect, useRef } from 'react';
import { loadFromStorage, saveToStorage, fetchCloudState, subscribeToChanges, forceCloudSync, mergeAppState } from './services/storage';
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
import { Toast } from './components/Toast';
import { RecurringModal } from './components/RecurringModal';
import { Auth } from './components/Auth';
import { supabase } from './services/supabaseClient';

function App() {
  const [session, setSession] = useState<any>(null);
  const [activeSection, setActiveSection] = useState<Section>('add-expense');
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [loaded, setLoaded] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [showChat, setShowChat] = useState(false);
  
  const [duePayments, setDuePayments] = useState<FixedPayment[]>([]);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null);
  const prevSyncIdRef = useRef<string | null>(null);
  const lastUpdateWasRemote = useRef(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
  };

  // 0. Auth Session Management
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 1. Initial Load & Recurring Check
  useEffect(() => {
    const init = async () => {
      const localData = loadFromStorage();
      let currentState = localData;
      
      if (localData.settings.syncId) {
        try {
          const cloudData = await fetchCloudState(localData.settings.syncId);
          if (cloudData) {
            currentState = mergeAppState(localData, cloudData);
          }
        } catch (e) {
          console.error("Cloud fetch failed on mount", e);
        }
      }

      setState(currentState);
      prevSyncIdRef.current = currentState.settings.syncId;
      setLoaded(true);
      
      if (currentState.settings.pin) {
        setIsLocked(true);
      }

      // Check recurring
      if (currentState.fixedPayments.length > 0) {
        const lastCheck = currentState.settings.lastFixedPaymentCheck 
          ? new Date(currentState.settings.lastFixedPaymentCheck) 
          : new Date();
        const now = new Date();
        const due: FixedPayment[] = [];
        const todayDay = now.getDate();
        const lastDay = lastCheck.getDate();
        const monthDiff = (now.getFullYear() - lastCheck.getFullYear()) * 12 + (now.getMonth() - lastCheck.getMonth());

        if (monthDiff === 0) {
           currentState.fixedPayments.forEach(p => {
             if (p.day > lastDay && p.day <= todayDay) due.push(p);
           });
        } else {
           currentState.fixedPayments.forEach(p => {
             if (p.day <= todayDay) due.push(p);
           });
        }

        if (due.length > 0) {
           setDuePayments(due);
           setShowRecurringModal(true);
        } else {
           setState(prev => ({ 
             ...prev, 
             settings: { ...prev.settings, lastFixedPaymentCheck: new Date().toISOString() } 
           }));
        }
      }
    };

    init();

    // PWA Check
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIos(ios);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    setIsStandalone(standalone);

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  // 2. Theme & Colors
  useEffect(() => {
    if (!loaded) return;
    if (state.settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    if (state.settings.primaryColor) {
      document.documentElement.style.setProperty('--primary', state.settings.primaryColor);
    }
  }, [state.settings.theme, state.settings.primaryColor, loaded]);

  // Handlers
  const handleRecurringConfirm = (selectedIds: number[]) => {
    const toAdd = duePayments.filter(p => selectedIds.includes(p.id));
    if (toAdd.length > 0) {
      const newExpenses = toAdd.map(p => ({
        id: Date.now() + Math.random(),
        date: new Date().toISOString().split('T')[0],
        amount: p.amount,
        category: 'Bills',
        person: 'Both',
        paymentMode: 'Netbanking',
        note: `Fixed: ${p.name}`
      }));

      setState(prev => {
        const next = {
          ...prev,
          expenses: [...prev.expenses, ...newExpenses],
          settings: { ...prev.settings, lastFixedPaymentCheck: new Date().toISOString() }
        };
        forceCloudSync(next);
        return next;
      });
      showToast(`${toAdd.length} payments added`, 'success');
    } else {
      setState(prev => ({
        ...prev,
        settings: { ...prev.settings, lastFixedPaymentCheck: new Date().toISOString() }
      }));
    }
    setShowRecurringModal(false);
  };

  const handleRecurringCancel = () => {
    setState(prev => ({
      ...prev,
      settings: { ...prev.settings, lastFixedPaymentCheck: new Date().toISOString() }
    }));
    setShowRecurringModal(false);
  };

  useEffect(() => {
    if (!loaded) return;
    const currentSyncId = state.settings.syncId;
    const prevSyncId = prevSyncIdRef.current;
    if (currentSyncId && currentSyncId !== prevSyncId) {
      const performSync = async () => {
        showToast("Syncing with partner...", 'info');
        try {
          const cloudData = await fetchCloudState(currentSyncId);
          if (cloudData) {
            lastUpdateWasRemote.current = true;
            setState(prev => mergeAppState(prev, cloudData));
            showToast("Connected! Data synced.", 'success');
          }
        } catch (e) {
          showToast("Could not sync data", 'error');
        }
      };
      performSync();
    }
    prevSyncIdRef.current = currentSyncId;
  }, [state.settings.syncId, loaded]);

  useEffect(() => {
    if (!loaded || !state.settings.syncId) return;
    const unsubscribe = subscribeToChanges(state.settings.syncId, (incomingState) => {
      lastUpdateWasRemote.current = true;
      setState(current => mergeAppState(current, incomingState));
    });
    return () => unsubscribe();
  }, [loaded, state.settings.syncId]);

  useEffect(() => {
    if (loaded) {
      if (lastUpdateWasRemote.current) {
        saveToStorage(state, 'remote');
        lastUpdateWasRemote.current = false;
      } else {
        saveToStorage(state, 'local');
      }
    }
  }, [state, loaded]);

  const addExpense = (expense: Omit<Expense, 'id'>) => {
    const newExpense: Expense = { ...expense, id: Date.now() };
    setState(prev => {
        const next = { ...prev, expenses: [...prev.expenses, newExpense] };
        forceCloudSync(next);
        return next;
    });
    showToast("Expense added successfully!", 'success');
  };

  const editExpense = (expense: Expense) => {
    setExpenseToEdit(expense);
    setActiveSection('add-expense');
  };

  const updateExpense = (updatedExpense: Expense) => {
    setState(prev => {
      const next = {
        ...prev,
        expenses: prev.expenses.map(e => e.id === updatedExpense.id ? updatedExpense : e)
      };
      forceCloudSync(next);
      return next;
    });
    setExpenseToEdit(null);
    showToast("Expense updated!", 'success');
    setActiveSection('summaries'); 
  };

  const cancelEdit = () => setExpenseToEdit(null);

  const deleteExpense = (id: number) => {
    if (window.confirm("Delete this expense?")) {
      setState(prev => {
          const next = { ...prev, expenses: prev.expenses.filter(e => e.id !== id) };
          forceCloudSync(next);
          return next;
      });
      showToast("Expense deleted", 'info');
    }
  };

  const updateSettings = (newSettings: Partial<AppState['settings']>) => {
    setState(prev => ({ ...prev, settings: { ...prev.settings, ...newSettings } }));
  };

  const updateBudget = (budget: number) => setState(prev => ({ ...prev, monthlyBudget: budget }));
  const updateIncome = (p1: number, p2: number) => setState(prev => ({ ...prev, incomePerson1: p1, incomePerson2: p2 }));
  
  const addFixedPayment = (name: string, amount: number, day: number) => {
    setState(prev => {
        const next = {
            ...prev,
            fixedPayments: [...prev.fixedPayments, { id: Date.now(), name, amount, day }]
        };
        forceCloudSync(next);
        return next;
    });
    showToast("Fixed payment added", 'success');
  };

  const removeFixedPayment = (id: number) => {
    setState(prev => {
        const next = { ...prev, fixedPayments: prev.fixedPayments.filter(p => p.id !== id) };
        forceCloudSync(next);
        return next;
    });
    showToast("Payment removed", 'info');
  };

  const resetData = () => {
    if (window.confirm("Are you sure you want to clear ALL data? This cannot be undone.")) {
      setState(INITIAL_STATE);
      localStorage.clear();
      window.location.reload();
    }
  };

  const importData = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        const newState = {
            ...INITIAL_STATE,
            ...imported,
            settings: { ...INITIAL_STATE.settings, ...(imported.settings || {}) },
            savingsGoals: imported.savingsGoals || [],
            categoryBudgets: imported.categoryBudgets || {},
            chatMessages: imported.chatMessages || [],
        };
        setState(newState);
        forceCloudSync(newState);
        showToast("Data imported successfully!", 'success');
      } catch (err) {
        showToast("Invalid backup file.", 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleInstallClick = () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult: any) => {
      if (choiceResult.outcome === 'accepted') {
        setDeferredPrompt(null);
        showToast("Installing app...", 'success');
      }
    });
  };

  if (!loaded) return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <div className="text-primary font-medium animate-pulse">Loading Finances...</div>
      </div>
    </div>
  );

  // AUTH GUARD
  if (!session) {
    return (
      <>
        <Auth onAuthSuccess={() => {}} showToast={showToast} />
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </>
    );
  }

  // PIN GUARD
  if (isLocked && state.settings.pin) {
    return <LockScreen pin={state.settings.pin} onUnlock={() => setIsLocked(false)} />;
  }

  return (
    <>
      {showRecurringModal && (
        <RecurringModal 
          payments={duePayments} 
          onConfirm={handleRecurringConfirm} 
          onCancel={handleRecurringCancel} 
        />
      )}
      {showChat && <ChatAssistant state={state} onClose={() => setShowChat(false)} />}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="min-h-screen bg-background text-text transition-colors duration-300">
        <div className="max-w-3xl mx-auto px-3 sm:px-6 lg:px-8 pt-2 sm:pt-4">
          <Header settings={state.settings} />
          <main className="relative pb-24">
            <div key={activeSection} className="animate-slide-up">
              {activeSection === 'add-expense' && (
                <AddExpense 
                  state={state} 
                  addExpense={addExpense} 
                  updateExpense={updateExpense}
                  expenseToEdit={expenseToEdit}
                  cancelEdit={cancelEdit}
                  switchTab={setActiveSection}
                  showToast={showToast}
                />
              )}
              {activeSection === 'summaries' && (
                <Summaries state={state} deleteExpense={deleteExpense} editExpense={editExpense} />
              )}
              {activeSection === 'investments' && (
                <Investments 
                  state={state} 
                  updateState={updates => setState(prev => ({ ...prev, ...updates }))}
                  showToast={showToast}
                />
              )}
              {activeSection === 'overview' && (
                <Overview 
                  state={state} 
                  updateBudget={updateBudget} 
                  updateIncome={updateIncome}
                  addFixedPayment={addFixedPayment}
                  removeFixedPayment={removeFixedPayment}
                  updateState={updates => setState(prev => ({ ...prev, ...updates }))}
                />
              )}
              {activeSection === 'settings' && (
                <Settings 
                  state={state} 
                  updateSettings={updateSettings} 
                  resetData={resetData}
                  importData={importData}
                  showToast={showToast}
                  installApp={handleInstallClick}
                  canInstall={!!deferredPrompt}
                  isIos={isIos}
                  isStandalone={isStandalone}
                />
              )}
            </div>
          </main>
          <BottomNav activeSection={activeSection} setSection={setActiveSection} />
          <button 
            onClick={() => setShowChat(true)}
            className="fixed bottom-24 right-4 w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-tr from-primary to-purple-600 text-white rounded-full shadow-lg flex items-center justify-center text-xl z-40 hover:scale-110 transition-all"
          >
            🤖
          </button>
          {activeSection !== 'add-expense' && (
            <button 
              onClick={() => setActiveSection('add-expense')}
              className="fixed bottom-24 left-4 w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-tr from-secondary to-cyan-500 text-white rounded-full shadow-lg flex items-center justify-center text-xl z-40 sm:hidden hover:scale-110 transition-all"
            >
              ➕
            </button>
          )}
        </div>
      </div>
    </>
  );
}

export default App;
