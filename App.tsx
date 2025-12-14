import React, { useState, useEffect, useRef } from 'react';
import { loadFromStorage, saveToStorage, fetchCloudState, subscribeToChanges } from './services/storage';
import { AppState, INITIAL_STATE, Section, Expense, FixedPayment } from './types';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { AddExpense } from './components/AddExpense';
import { Summaries } from './components/Summaries';
import { Overview } from './components/Overview';
import { Settings } from './components/Settings';
import { LockScreen } from './components/LockScreen';
import { ChatAssistant } from './components/ChatAssistant';
import { PartnerChat } from './components/PartnerChat';
import { Toast } from './components/Toast';
import { RecurringModal } from './components/RecurringModal';

function App() {
  const [activeSection, setActiveSection] = useState<Section>('add-expense');
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [loaded, setLoaded] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [showChat, setShowChat] = useState(false);
  
  // Recurring Payment Modal State
  const [duePayments, setDuePayments] = useState<FixedPayment[]>([]);
  const [showRecurringModal, setShowRecurringModal] = useState(false);

  // Edit State
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null);

  // Track previous sync ID to detect changes
  const prevSyncIdRef = useRef<string | null>(null);
  
  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  // Toast State
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
  };

  // 1. Initial Load & Recurring Check
  useEffect(() => {
    const init = async () => {
      const localData = loadFromStorage();
      let currentState = localData;
      
      // If we have a Sync ID on startup, fetch latest cloud data
      if (localData.settings.syncId) {
        try {
          const cloudData = await fetchCloudState(localData.settings.syncId);
          if (cloudData) {
            currentState = cloudData;
            console.log("Loaded cloud data on mount");
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

      // CHECK RECURRING PAYMENTS
      if (currentState.fixedPayments.length > 0) {
        const lastCheck = currentState.settings.lastFixedPaymentCheck 
          ? new Date(currentState.settings.lastFixedPaymentCheck) 
          : new Date();
        
        const now = new Date();
        const due: FixedPayment[] = [];

        // Check each day from last check until today
        // Simple logic: if payment day falls in the range (lastCheck < day <= now)
        // We only care about day-of-month for simplicity as requested
        const todayDay = now.getDate();
        const lastDay = lastCheck.getDate();
        
        // Handle Month Wrap: If month changed, check from lastDay to end of month, then 1 to today
        const monthDiff = (now.getFullYear() - lastCheck.getFullYear()) * 12 + (now.getMonth() - lastCheck.getMonth());

        if (monthDiff === 0) {
           // Same month
           currentState.fixedPayments.forEach(p => {
             if (p.day > lastDay && p.day <= todayDay) due.push(p);
           });
        } else {
           // Different month - check all payments that are <= today OR > lastDay
           // This is a simplified logic. Properly we'd add all if a whole month passed.
           // Let's just catch payments <= today to be safe and simple.
           currentState.fixedPayments.forEach(p => {
             if (p.day <= todayDay) due.push(p);
           });
        }

        if (due.length > 0) {
           setDuePayments(due);
           setShowRecurringModal(true);
        } else {
           // Update check time even if nothing found
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

  // Handle Recurring Confirmation
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

      setState(prev => ({
        ...prev,
        expenses: [...prev.expenses, ...newExpenses],
        settings: { ...prev.settings, lastFixedPaymentCheck: new Date().toISOString() }
      }));
      showToast(`${toAdd.length} payments added`, 'success');
    } else {
      // Just update the check time
      setState(prev => ({
        ...prev,
        settings: { ...prev.settings, lastFixedPaymentCheck: new Date().toISOString() }
      }));
    }
    setShowRecurringModal(false);
  };

  const handleRecurringCancel = () => {
    // Update check time so we don't ask again immediately
    setState(prev => ({
      ...prev,
      settings: { ...prev.settings, lastFixedPaymentCheck: new Date().toISOString() }
    }));
    setShowRecurringModal(false);
  };

  // 2. Handle "Join Session" (Sync ID changes after load)
  useEffect(() => {
    if (!loaded) return;

    const currentSyncId = state.settings.syncId;
    const prevSyncId = prevSyncIdRef.current;

    // If Sync ID changed (and isn't null), fetch data immediately
    if (currentSyncId && currentSyncId !== prevSyncId) {
      const performSync = async () => {
        showToast("Syncing with partner...", 'info');
        try {
          const cloudData = await fetchCloudState(currentSyncId);
          if (cloudData) {
            setState(cloudData);
            showToast("Connected! Data synced.", 'success');
          } else {
            // New session, data will be uploaded by the saveToStorage effect
            showToast("Connected to new session.", 'success');
          }
        } catch (e) {
          showToast("Could not sync data", 'error');
        }
      };
      performSync();
    }

    prevSyncIdRef.current = currentSyncId;
  }, [state.settings.syncId, loaded]);

  // 3. Subscribe to Realtime Changes (Stable Subscription)
  useEffect(() => {
    if (!loaded || !state.settings.syncId) return;

    const unsubscribe = subscribeToChanges(state.settings.syncId, (newState) => {
      setState(newState);
    });

    return () => {
      unsubscribe();
    };
  }, [loaded, state.settings.syncId]);

  // 4. Adaptive Polling Fallback
  useEffect(() => {
    if (!loaded || !state.settings.syncId) return;

    // We no longer need aggressive polling for chat since chat has its own socket
    // Standard polling for expenses sync can remain slow (8s)
    const intervalMs = 8000;

    const pollInterval = setInterval(async () => {
      if (document.hidden) return; // Pause when app is backgrounded
      
      try {
        if(state.settings.syncId) {
           const cloudData = await fetchCloudState(state.settings.syncId);
           if (cloudData) {
             setState(prev => ({...prev, ...cloudData})); 
           }
        }
      } catch(e) {
        // Silent fail, retrying next tick
      }
    }, intervalMs);

    return () => clearInterval(pollInterval);
  }, [loaded, state.settings.syncId]);

  // 5. Save to Storage (Local + Cloud)
  useEffect(() => {
    if (loaded) {
      saveToStorage(state);
    }
  }, [state, loaded]);

  // Theme & Styles
  useEffect(() => {
    const root = document.documentElement;
    const { primaryColor, secondaryColor, accentColor, theme, fontStyle, fontSize } = state.settings;

    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');

    root.style.setProperty('--primary', primaryColor);
    root.style.setProperty('--secondary', secondaryColor);
    root.style.setProperty('--accent', accentColor);

    let fontFamily = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
    if (fontStyle === 'playful') fontFamily = "'Comic Sans MS', 'Trebuchet MS', cursive";
    else if (fontStyle === 'serif') fontFamily = "'Georgia', 'Times New Roman', serif";
    root.style.setProperty('--font-family', fontFamily);

    if (fontSize === 'small') root.style.fontSize = '14px';
    else if (fontSize === 'large') root.style.fontSize = '18px';
    else root.style.fontSize = '16px';
  }, [state.settings]);

  // Actions
  const addExpense = (expense: Omit<Expense, 'id'>) => {
    const newExpense: Expense = { ...expense, id: Date.now() };
    setState(prev => ({ ...prev, expenses: [...prev.expenses, newExpense] }));
    showToast("Expense added successfully!", 'success');
  };

  const editExpense = (expense: Expense) => {
    setExpenseToEdit(expense);
    setActiveSection('add-expense');
  };

  const updateExpense = (updatedExpense: Expense) => {
    setState(prev => ({
      ...prev,
      expenses: prev.expenses.map(e => e.id === updatedExpense.id ? updatedExpense : e)
    }));
    setExpenseToEdit(null);
    showToast("Expense updated!", 'success');
    setActiveSection('summaries'); // Redirect back to see change
  };

  const cancelEdit = () => {
    setExpenseToEdit(null);
  };

  const deleteExpense = (id: number) => {
    if (window.confirm("Delete this expense?")) {
      setState(prev => ({ ...prev, expenses: prev.expenses.filter(e => e.id !== id) }));
      showToast("Expense deleted", 'info');
    }
  };

  const updateSettings = (newSettings: Partial<AppState['settings']>) => {
    setState(prev => ({ ...prev, settings: { ...prev.settings, ...newSettings } }));
  };

  const updateBudget = (budget: number) => {
    setState(prev => ({ ...prev, monthlyBudget: budget }));
  };

  const updateIncome = (p1: number, p2: number) => {
    setState(prev => ({ ...prev, incomePerson1: p1, incomePerson2: p2 }));
  };

  const addFixedPayment = (name: string, amount: number, day: number) => {
    setState(prev => ({
      ...prev,
      fixedPayments: [...prev.fixedPayments, { id: Date.now(), name, amount, day }]
    }));
    showToast("Fixed payment added", 'success');
  };

  const removeFixedPayment = (id: number) => {
    setState(prev => ({ ...prev, fixedPayments: prev.fixedPayments.filter(p => p.id !== id) }));
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
        setState({
            ...INITIAL_STATE,
            ...imported,
            settings: { ...INITIAL_STATE.settings, ...(imported.settings || {}) },
            savingsGoals: imported.savingsGoals || [],
            categoryBudgets: imported.categoryBudgets || {},
            chatMessages: imported.chatMessages || [],
        });
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

      {showChat && (
        <ChatAssistant state={state} onClose={() => setShowChat(false)} />
      )}
      
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}

      <div className="min-h-screen bg-background text-text transition-colors duration-300">
        <div className="max-w-3xl mx-auto px-3 sm:px-6 lg:px-8 pt-2 sm:pt-4">
          
          <Header settings={state.settings} />
          
          <div className="hidden sm:flex justify-center gap-4 mb-8">
             {[
               {id: 'add-expense', label: 'Add Expense'},
               {id: 'summaries', label: 'Summaries'},
               {id: 'partner-chat', label: 'Chat'},
               {id: 'overview', label: 'Overview'},
               {id: 'settings', label: 'Settings'},
             ].map(item => (
               <button
                 key={item.id}
                 onClick={() => setActiveSection(item.id as Section)}
                 className={`px-6 py-2 rounded-full font-medium transition-all duration-300 transform active:scale-95 ${
                   activeSection === item.id 
                     ? 'bg-white text-primary shadow-lg scale-105 dark:bg-gray-800 dark:text-primary' 
                     : 'text-text-light hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-primary hover:shadow-sm'
                 }`}
               >
                 {item.label}
               </button>
             ))}
          </div>

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
                <Summaries 
                  state={state} 
                  deleteExpense={deleteExpense} 
                  editExpense={editExpense}
                />
              )}
              {activeSection === 'partner-chat' && (
                <PartnerChat state={state} />
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
          
          {/* Ask AI Button - Hidden when in Partner Chat */}
          {activeSection !== 'partner-chat' && (
            <button 
              onClick={() => setShowChat(true)}
              className="fixed bottom-24 right-4 w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-tr from-primary to-purple-600 text-white rounded-full shadow-lg shadow-primary/30 flex items-center justify-center text-xl sm:text-2xl z-40 hover:scale-110 active:scale-90 transition-all duration-300 animate-scale-in"
              title="Ask AI"
            >
              🤖
            </button>
          )}
          
          {/* Add Expense Button - Hidden in Add Expense AND Partner Chat */}
          {activeSection !== 'add-expense' && activeSection !== 'partner-chat' && (
            <button 
              onClick={() => setActiveSection('add-expense')}
              className="fixed bottom-24 left-4 w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-tr from-secondary to-cyan-500 text-white rounded-full shadow-lg shadow-secondary/30 flex items-center justify-center text-xl sm:text-2xl z-40 sm:hidden hover:scale-110 active:scale-90 transition-all duration-300 animate-scale-in"
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