
import React, { useState, useEffect, useRef } from 'react';
import { loadFromStorage, saveToStorage, fetchCloudState, subscribeToChanges, forceCloudSync, mergeAppState } from './services/storage';
import { AppState, INITIAL_STATE, Section, Expense, FixedPayment, DEFAULT_CATEGORIES, CreditCard } from './types';
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

const generateMockData = (): AppState => {
  const categories = DEFAULT_CATEGORIES;
  const persons = ['Person1', 'Person2', 'Both'];
  const modes = ['UPI', 'Card', 'Cash', 'Netbanking'];
  const notes = ['Lunch at cafe', 'Weekly groceries', 'Netflix sub', 'Airtel bill', 'Zomato order', 'Petrol refill', 'New shoes', 'Pharmacy', 'Movie night'];
  
  const mockExpenses: Expense[] = Array.from({ length: 15 }).map((_, i) => ({
    id: Date.now() - (i * 86400000),
    amount: Math.floor(Math.random() * 2000) + 100,
    category: categories[Math.floor(Math.random() * categories.length)],
    date: new Date(Date.now() - (Math.floor(Math.random() * 20) * 86400000)).toISOString().split('T')[0],
    note: notes[Math.floor(Math.random() * notes.length)],
    paymentMode: modes[Math.floor(Math.random() * modes.length)],
    person: persons[Math.floor(Math.random() * persons.length)],
    cardId: modes[Math.floor(Math.random() * modes.length)] === 'Card' ? 1 : undefined
  }));

  return {
    ...INITIAL_STATE,
    expenses: mockExpenses,
    incomePerson1: 85000,
    incomePerson2: 72000,
    monthlyBudget: 45000,
    settings: {
      ...INITIAL_STATE.settings,
      person1Name: 'Alex',
      person2Name: 'Jordan',
      headerTitle: 'Demo: Alex & Jordan'
    },
    investments: {
      bankBalance: { p1: 125000, p2: 98000 },
      mutualFunds: { p1: 450000, p2: 320000, shared: 100000 },
      stocks: { p1: 85000, p2: 42000, shared: 0 },
      gold: { p1Grams: 10, p2Grams: 5, sharedGrams: 20 },
      silver: { p1Grams: 100, p2Grams: 50, sharedGrams: 500 },
      goldRate: 7300,
      silverRate: 90,
    },
    fixedPayments: [
      { id: 1, name: 'Rent', amount: 25000, day: 1 },
      { id: 2, name: 'Internet', amount: 1200, day: 10 },
      { id: 3, name: 'Gym', amount: 3500, day: 5 }
    ],
    creditCards: [
      { id: 1, name: 'HDFC Regalia', limit: 500000, billingDay: 15, currentBalance: 12500 }
    ]
  };
};

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
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  
  const prevSyncIdRef = useRef<string | null>(null);
  const lastUpdateWasRemote = useRef(false);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
  };

  // 0. Auth Session Management
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!authInitialized) setAuthInitialized(true);
    }, 5000);

    if (!supabase) {
      setAuthInitialized(true);
      clearTimeout(timeout);
      return;
    }
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthInitialized(true);
      clearTimeout(timeout);
    }).catch(() => {
      setAuthInitialized(true);
      clearTimeout(timeout);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session && !isGuest) {
        setState(INITIAL_STATE);
        prevSyncIdRef.current = null;
        setLoaded(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [isGuest]);

  // 1. Initial Data Load & Recurring Check
  useEffect(() => {
    if ((!session && !isGuest) || !authInitialized) return;

    const init = async () => {
      if (isGuest) {
        setState(generateMockData());
        setLoaded(true);
        return;
      }

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
  }, [session, isGuest, authInitialized]);

  // Sync effect only for logged in users
  useEffect(() => {
    if (!loaded || isGuest) return;
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
  }, [state.settings.syncId, loaded, isGuest]);

  useEffect(() => {
    if (loaded && !state.settings.syncId || isGuest) return;
    const unsubscribe = subscribeToChanges(state.settings.syncId!, (incomingState) => {
      lastUpdateWasRemote.current = true;
      setState(current => mergeAppState(current, incomingState));
    });
    return () => unsubscribe();
  }, [loaded, state.settings.syncId, isGuest]);

  useEffect(() => {
    if (loaded && !isGuest) {
      if (lastUpdateWasRemote.current) {
        saveToStorage(state, 'remote');
        lastUpdateWasRemote.current = false;
      } else {
        saveToStorage(state, 'local');
      }
    }
  }, [state, loaded, isGuest]);

  const addExpense = (expense: Omit<Expense, 'id'>) => {
    const newExpense: Expense = { ...expense, id: Date.now() };
    setState(prev => {
        let updatedCards = prev.creditCards;
        if (newExpense.paymentMode === 'Card' && newExpense.cardId) {
          updatedCards = prev.creditCards.map(c => 
            c.id === newExpense.cardId ? { ...c, currentBalance: c.currentBalance + newExpense.amount } : c
          );
        }
        const next = { ...prev, expenses: [...prev.expenses, newExpense], creditCards: updatedCards };
        if (!isGuest) forceCloudSync(next);
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
      // Revert old card balance if it was a card expense
      const oldExpense = prev.expenses.find(e => e.id === updatedExpense.id);
      let updatedCards = prev.creditCards;
      
      if (oldExpense && oldExpense.paymentMode === 'Card' && oldExpense.cardId) {
        updatedCards = updatedCards.map(c => 
          c.id === oldExpense.cardId ? { ...c, currentBalance: c.currentBalance - oldExpense.amount } : c
        );
      }
      
      // Apply new card balance if new is a card expense
      if (updatedExpense.paymentMode === 'Card' && updatedExpense.cardId) {
        updatedCards = updatedCards.map(c => 
          c.id === updatedExpense.cardId ? { ...c, currentBalance: c.currentBalance + updatedExpense.amount } : c
        );
      }

      const next = {
        ...prev,
        expenses: prev.expenses.map(e => e.id === updatedExpense.id ? updatedExpense : e),
        creditCards: updatedCards
      };
      if (!isGuest) forceCloudSync(next);
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
          const oldExpense = prev.expenses.find(e => e.id === id);
          let updatedCards = prev.creditCards;
          if (oldExpense && oldExpense.paymentMode === 'Card' && oldExpense.cardId) {
            updatedCards = prev.creditCards.map(c => 
              c.id === oldExpense.cardId ? { ...c, currentBalance: c.currentBalance - oldExpense.amount } : c
            );
          }
          const next = { ...prev, expenses: prev.expenses.filter(e => e.id !== id), creditCards: updatedCards };
          if (!isGuest) forceCloudSync(next);
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
        if (!isGuest) forceCloudSync(next);
        return next;
    });
    showToast("Fixed payment added", 'success');
  };

  const removeFixedPayment = (id: number) => {
    setState(prev => {
        const next = { ...prev, fixedPayments: prev.fixedPayments.filter(p => p.id !== id) };
        if (!isGuest) forceCloudSync(next);
        return next;
    });
    showToast("Payment removed", 'info');
  };

  const resetData = () => {
    if (isGuest) {
      window.location.reload();
      return;
    }
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
        };
        setState(newState);
        if (!isGuest) forceCloudSync(newState);
        showToast("Data imported successfully!", 'success');
      } catch (err) {
        showToast("Invalid backup file.", 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleRecurringConfirm = (selectedIds: number[]) => {
    const selectedPayments = duePayments.filter(p => selectedIds.includes(p.id));
    const newExpenses: Expense[] = selectedPayments.map(p => ({
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
      if (!isGuest) forceCloudSync(next);
      return next;
    });
    
    setShowRecurringModal(false);
    showToast(`Added ${newExpenses.length} recurring expenses`, 'success');
  };

  const handleRecurringCancel = () => {
    setState(prev => ({
      ...prev,
      settings: { ...prev.settings, lastFixedPaymentCheck: new Date().toISOString() }
    }));
    setShowRecurringModal(false);
  };

  if (!authInitialized) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <div className="text-primary font-medium animate-pulse">Checking Session...</div>
        </div>
      </div>
    );
  }

  if (!session && !isGuest) {
    return (
      <>
        <Auth onAuthSuccess={() => {}} onGuestLogin={() => setIsGuest(true)} showToast={showToast} />
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </>
    );
  }

  if (!loaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <div className="text-primary font-medium animate-pulse">Loading Finances...</div>
        </div>
      </div>
    );
  }

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
          {isGuest && (
            <div className="bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 px-4 py-3 rounded-xl text-xs font-bold mb-4 flex justify-between items-center shadow-sm animate-fade-in">
              <span className="flex items-center gap-2">
                <span className="text-lg">🚀</span> 
                Guest Mode Active (Sample Data)
              </span>
              <button onClick={() => window.location.reload()} className="bg-amber-200 dark:bg-amber-800 px-3 py-1 rounded-lg hover:scale-105 transition-transform uppercase">Login</button>
            </div>
          )}
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
                  installApp={() => {}} 
                  canInstall={false}
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
        </div>
      </div>
    </>
  );
}

export default App;
