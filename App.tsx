import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Challenges } from './components/Challenges';
import { Confetti } from './components/Confetti';
import { evaluateChallenges } from './utils/challenges';
import { SplitBillView } from './components/SplitBillView';
import { useAppStore } from './store/useStore';
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
import { loadFromStorage, saveToStorage, fetchCloudState, forceCloudSync, mergeAppState, logAuditEvent, setupRealtimeSubscription } from './services/storage';
import { checkBudgetAlerts, sendLocalNotification, requestNotificationPermission, Alert } from './services/alertService';
import { DebugView } from './components/DebugView';
import { INITIAL_STATE } from './types';

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const store = useAppStore();

  // Local state for UI that doesn't need to be global/persisted
  const [session, setSession] = React.useState<any>(null);
  const [authInitialized, setAuthInitialized] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const [isLocked, setIsLocked] = React.useState(false);
  const [toast, setToast] = React.useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
  const [showRecurringModal, setShowRecurringModal] = React.useState(false);
  const [duePayments, setDuePayments] = React.useState<any[]>([]);
  const [alerts, setAlerts] = React.useState<Alert[]>([]);
  const [dismissedAlerts, setDismissedAlerts] = React.useState<string[]>([]);
  const [celebrationReward, setCelebrationReward] = React.useState<string | null>(null);

  // Check Alerts
  useEffect(() => {
    if (!loaded) return;
    const currentAlerts = checkBudgetAlerts(store);
    setAlerts(currentAlerts);

    // Filter for dangerous alerts to notify
    if (store.settings.notificationsEnabled && document.hidden) {
      currentAlerts.forEach(alert => {
        if (alert.type === 'danger' && !dismissedAlerts.includes(alert.id)) {
          sendLocalNotification(alert.title, alert.message);
        }
      });
    }
  }, [store.expenses, store.monthlyBudget, store.categoryBudgets, store.fixedPayments, store.savingsGoals, loaded, store.settings.notificationsEnabled]);

  const activeAlerts = alerts.filter(a => !dismissedAlerts.includes(a.id));


  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
  };

  // Sync active section with URL
  useEffect(() => {
    const path = location.pathname.substring(1) || 'add-expense';
    if (store.activeSection !== path) {
      store.setSection(path as any);
    }
  }, [location.pathname]);

  // Auth & Init Logic
  useEffect(() => {
    const checkSession = async () => {
      if (!supabase) { setAuthInitialized(true); return; }
      const { data: { session: existingSession } } = await supabase.auth.getSession();
      if (existingSession) setSession(existingSession);
      setAuthInitialized(true);
    };
    checkSession();

    const authListener = supabase?.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === 'SIGNED_OUT') {
        // Critical: Clear local storage to prevent data leakage to next user
        localStorage.removeItem('coupleExpenseTrackerV4_React');
        store.reset();
        setLoaded(false);
      }
    });

    return () => authListener?.data.subscription.unsubscribe();
  }, []);

  // Data Loading Logic
  useEffect(() => {
    if ((!session && !store.isGuest) || !authInitialized) return;

    const init = async () => {
      // Start with clean state (loadFromStorage returns INITIAL_STATE now)
      let localData = loadFromStorage();
      let currentState = localData;

      if (session?.user?.id) {
        // --- DATA LEAKAGE PREVENTION ---
        const lastUserId = localStorage.getItem('last_user_id');
        if (lastUserId && lastUserId !== session.user.id) {
          console.warn("User mismatch detected. Clearing local storage to prevent leakage.");
          localStorage.removeItem('coupleExpenseTrackerV4_React');
          localStorage.removeItem('MANUAL_RESTORE_V1');
          localData = { ...INITIAL_STATE }; // Reset local reference
        }
        localStorage.setItem('last_user_id', session.user.id);
        // -------------------------------

        try {
          console.log("Fetching cloud state for user:", session.user.id);
          const cloudData = await fetchCloudState(session.user.id);
          if (cloudData) {
            console.log("Cloud data found. Loading...");
            // Use cloud data as source of truth
            currentState = cloudData;
          } else {
            console.log("No cloud data found. Starting fresh.");
            // SAFETY: If logged in but no cloud data, assume fresh user.
            // Do NOT fall back to localData unless it's confirmed guest data, which we can't easily do.
            // To be safe against leaks, we reset to INITIAL_STATE.
            currentState = { ...INITIAL_STATE, settings: { ...INITIAL_STATE.settings, reportEmail: session.user.email || '' } };
          }
        } catch (e) {
          console.error("Cloud fetch failed:", e);
          // If offline, we might fall back to localData, but only if we didn't just mistakenly load another user's data.
          // Since we cleared it on mismatch above, this is safe-ish.
        }
      }

      store.setState(currentState);
      setLoaded(true);

      if (currentState.settings.pin || currentState.settings.webAuthnCredentialId) {
        setIsLocked(true);
      }

      // Check recurring payments
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
  }, [session, store.isGuest, authInitialized]);

  // Realtime Subscription
  useEffect(() => {
    if (!session?.user?.id) return;

    const channel = setupRealtimeSubscription(session.user.id, (remoteState) => {
      // Merge incoming remote state with current to avoid overwriting pending local edits if any
      // But typically we trust remote. Let's merge using current store state.
      const current = (store as any).getState ? (store as any).getState() : store;
      // Since 'store' is the hook result, getting current state inside useEffect might be stale if we don't depend on it.
      // Actually, we can just setState(remoteState). If we want LWW, we use mergeAppState.

      console.log("Applying Realtime Update...");
      store.setState(remoteState);
      showToast("Sync Received ☁️", "info");
    });

    return () => {
      if (channel) supabase?.removeChannel(channel);
    };
  }, [session?.user?.id]); // Only re-sub if user changes

  // Save on Change
  useEffect(() => {
    if (loaded && !store.isGuest && session) {
      // Trigger debounced cloud save
      saveToStorage(store, 'remote');
    }
  }, [store.expenses, store.settings, store.investments, store.challenges, loaded]);

  // Challenge Evaluation Loop
  useEffect(() => {
    if (!loaded || !store.challenges) return;

    const activeChallenges = store.challenges.filter(c => c.status === 'active');
    if (activeChallenges.length === 0) return;

    const updatedChallenges = evaluateChallenges(store.challenges, store.expenses);

    // Check for status changes to trigger celebrations
    let hasChanges = false;
    let newReward: string | null = null;

    const newChallenges = updatedChallenges.map(updated => {
      const original = store.challenges.find(c => c.id === updated.id);
      if (original && original.status === 'active' && updated.status === 'completed') {
        hasChanges = true;
        newReward = updated.reward;
      }
      if (original && original.progress !== updated.progress) {
        hasChanges = true;
      }
      if (original && original.status !== updated.status) {
        hasChanges = true;
      }
      return updated;
    });

    if (hasChanges) {
      store.setState({ challenges: newChallenges });
      if (newReward) {
        setCelebrationReward(newReward);
        showToast(`🎉 Challenge Completed! You earned: ${newReward}`, 'success');
        setTimeout(() => setCelebrationReward(null), 4000);
      }
    }
  }, [store.expenses, loaded]); // Evaluate when expenses change

  const handleTogglePrivacy = () => {
    store.setState({
      settings: { ...store.settings, privacyMode: !store.settings.privacyMode }
    });
    showToast(!store.settings.privacyMode ? "Privacy Mode Enabled" : "Disabled", "info");
  };

  if (!authInitialized) return <SkeletonLoader />;

  if (location.pathname.startsWith('/split/')) {
    return <SplitBillView />;
  }

  if (!session && !store.isGuest) {
    return <Auth onAuthSuccess={() => { }} onGuestLogin={() => store.setGuest(true)} showToast={showToast} />;
  }

  return (
    <>
      <AnimatePresence>
        {celebrationReward && <Confetti reward={celebrationReward} />}
      </AnimatePresence>

      {isLocked && (
        <LockScreen
          pin={store.settings.pin}
          webAuthnId={store.settings.webAuthnCredentialId}
          onUnlock={() => setIsLocked(false)}
        />
      )}

      {showRecurringModal && (
        <RecurringModal
          payments={duePayments}
          onConfirm={() => {
            store.setState({ settings: { ...store.settings, lastFixedPaymentCheck: new Date().toISOString() } });
            setShowRecurringModal(false);
          }}
          onCancel={() => {
            store.setState({ settings: { ...store.settings, lastFixedPaymentCheck: new Date().toISOString() } });
            setShowRecurringModal(false);
          }}
        />
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div className={`relative w-full overflow-x-hidden min-h-screen bg-background text-text ${store.settings.privacyMode ? 'privacy-active' : ''}`}>
        <div className="max-w-3xl mx-auto px-2 pt-4">
          <Header settings={store.settings} onTogglePrivacy={handleTogglePrivacy} />

          {/* Smart Alerts Banner */}
          <div className="space-y-2 mb-4">
            {activeAlerts.map((alert: Alert) => (
              <div
                key={alert.id}
                className={`p-3 rounded-xl flex items-center justify-between text-sm font-bold shadow-sm animate-fade-in ${alert.type === 'danger' ? 'bg-red-100 text-red-700 border border-red-200' :
                  alert.type === 'warning' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                    'bg-blue-50 text-blue-700 border border-blue-100'
                  }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">
                    {alert.type === 'danger' ? '🚨' : alert.type === 'warning' ? '⚠️' : 'ℹ️'}
                  </span>
                  <div>
                    <div className="text-xs uppercase opacity-70 tracking-wider">{alert.title}</div>
                    <div>{alert.message}</div>
                  </div>
                </div>
                <button
                  onClick={() => setDismissedAlerts((prev: string[]) => [...prev, alert.id])}
                  className="p-1 px-2 hover:bg-black/5 rounded"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <main className="relative pb-24">
            <ErrorBoundary fallbackTitle="Section Error">
              <Routes>
                <Route path="/" element={<Navigate to="/add-expense" replace />} />
                <Route path="/add-expense" element={
                  <AddExpense
                    state={store}
                    addExpense={store.addExpense}
                    updateExpense={(updatedExpense: any) => store.updateExpense(updatedExpense)}
                    expenseToEdit={store.expenseToEdit}
                    cancelEdit={() => store.setExpenseToEdit(null)}
                    switchTab={(tab) => navigate(`/${tab}`)}
                    showToast={showToast}
                  />
                } />
                <Route path="/summaries" element={
                  <Summaries
                    state={store}
                    deleteExpense={store.deleteExpense}
                    editExpense={(exp) => {
                      store.setExpenseToEdit(exp);
                      navigate('/add-expense');
                    }}
                  />
                } />
                <Route path="/investments" element={
                  <Investments
                    state={store}
                    updateState={store.setState}
                    showToast={showToast}
                  />
                } />
                <Route path="/overview" element={
                  <Overview />
                } />
                <Route path="/challenges" element={
                  <Challenges
                    state={store}
                    updateState={store.setState}
                    showToast={showToast}
                  />
                } />
                <Route path="/settings" element={
                  <Settings
                    state={store}
                    updateSettings={(s) => store.setState({ settings: { ...store.settings, ...s } })}
                    updateState={store.setState}
                    resetData={store.reset}
                    deleteAccount={store.reset}
                    showToast={showToast}
                    installApp={() => { }}
                    canInstall={false}
                    isIos={false}
                    isStandalone={false}
                    userEmail={session?.user?.email}
                  />
                } />
              </Routes>
            </ErrorBoundary>
          </main>

          <BottomNav
            activeSection={store.activeSection}
            setSection={(s) => navigate(`/${s}`)}
          />
        </div>
      </div>
    </>
  );
}

export default App;
