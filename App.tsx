import React, { useEffect, useRef, Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { useAppStore } from './store/useStore';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { AddExpense } from './components/AddExpense';
import { LockScreen } from './components/LockScreen';
import { Toast } from './components/Toast';
import { RecurringModal } from './components/RecurringModal';
import { Auth } from './components/Auth';
import { StatementImporter } from './components/StatementImporter';
import { supabase } from './services/supabaseClient';
import { SkeletonLoader } from './components/SkeletonLoader';
import { ErrorBoundary } from './components/ErrorBoundary';
import { loadFromStorage, saveToStorage, fetchCloudState, forceCloudSync, mergeAppState, logAuditEvent, setupRealtimeSubscription } from './services/storage';
import { checkBudgetAlerts, sendLocalNotification, Alert } from './services/alertService';
import { DebugView } from './components/DebugView';
import { INITIAL_STATE } from './types';
import { Analytics } from '@vercel/analytics/react';

// Lazy load heavy components
const Summaries = lazy(() => import('./components/Summaries').then(m => ({ default: m.Summaries })));
const Overview = lazy(() => import('./components/Overview').then(m => ({ default: m.Overview })));
const Investments = lazy(() => import('./components/Investments').then(m => ({ default: m.Investments })));
const Settings = lazy(() => import('./components/Settings').then(m => ({ default: m.Settings })));

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const store = useAppStore();

  // Local state for UI that doesn't need to be global/persisted
  const [session, setSession] = React.useState<{ user: { id: string; email?: string } } | null>(null);
  const [authInitialized, setAuthInitialized] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const [isLocked, setIsLocked] = React.useState(false);
  const [toast, setToast] = React.useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
  const [showRecurringModal, setShowRecurringModal] = React.useState(false);
  const [duePayments, setDuePayments] = React.useState<typeof INITIAL_STATE.fixedPayments>([]);
  const [alerts, setAlerts] = React.useState<Alert[]>([]);
  const dismissedAlertsRef = useRef<Set<string>>(new Set());

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

    const { data: { subscription } } = supabase!.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === 'SIGNED_OUT') {
        // Critical: Clear local storage to prevent data leakage to next user
        localStorage.removeItem('coupleExpenseTrackerV4_React');
        store.reset();
        setLoaded(false);
      }
    });

    return () => subscription.unsubscribe();
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

  // Realtime Subscription - use ref to avoid stale closure
  const setStateRef = useRef(store.setState);
  const showToastRef = useRef(showToast);
  
  useEffect(() => {
    setStateRef.current = store.setState;
    showToastRef.current = showToast;
  });

  useEffect(() => {
    if (!session?.user?.id) return;

    const channel = setupRealtimeSubscription(session.user.id, (remoteState) => {
      console.log("Applying Realtime Update...");
      setStateRef.current(remoteState);
      showToastRef.current("Sync Received ☁️", "info");
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
  }, [store.expenses, store.settings, store.investments, loaded]);

  // Check for budget alerts when expenses change
  useEffect(() => {
    if (!loaded) return;
    
    const allAlerts = checkBudgetAlerts(store);
    // Filter out dismissed alerts
    const activeAlerts = allAlerts.filter(a => !dismissedAlertsRef.current.has(a.id));
    setAlerts(activeAlerts);

    // Send notifications for new alerts if app is in background and notifications enabled
    if (store.settings.notificationsEnabled && document.hidden && activeAlerts.length > 0) {
      activeAlerts.forEach(alert => {
        sendLocalNotification(alert.title, alert.message);
      });
    }
  }, [store.expenses, store.monthlyBudget, store.categoryBudgets, store.fixedPayments, store.savingsGoals, loaded]);

  const dismissAlert = (alertId: string) => {
    dismissedAlertsRef.current.add(alertId);
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  };

  const handleTogglePrivacy = () => {
    store.setState({
      settings: { ...store.settings, privacyMode: !store.settings.privacyMode }
    });
    showToast(!store.settings.privacyMode ? "Privacy Mode Enabled" : "Disabled", "info");
  };

  if (!authInitialized) return <SkeletonLoader />;

  if (!session && !store.isGuest) {
    return <Auth onAuthSuccess={() => { }} onGuestLogin={() => store.setGuest(true)} showToast={showToast} />;
  }

  return (
    <>
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
          onConfirm={() => setShowRecurringModal(false)}
          onCancel={() => setShowRecurringModal(false)}
        />
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div className={`min-h-screen bg-background text-text ${store.settings.privacyMode ? 'privacy-active' : ''}`}>
        <div className="max-w-3xl mx-auto px-2 pt-4">
          <Header settings={store.settings} onTogglePrivacy={handleTogglePrivacy} />

          {/* Smart Budget Alerts Banner */}
          {alerts.length > 0 && (
            <div className="mt-3 space-y-2">
              {alerts.map(alert => (
                <div
                  key={alert.id}
                  className={`flex items-start justify-between p-3 rounded-xl border animate-slide-up ${
                    alert.type === 'danger'
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                      : alert.type === 'warning'
                      ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                      : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                  }`}
                >
                  <div className="flex-1 pr-2">
                    <p className={`text-xs font-bold ${
                      alert.type === 'danger'
                        ? 'text-red-700 dark:text-red-300'
                        : alert.type === 'warning'
                        ? 'text-yellow-700 dark:text-yellow-300'
                        : 'text-blue-700 dark:text-blue-300'
                    }`}>
                      {alert.title}
                    </p>
                    <p className={`text-[11px] mt-0.5 ${
                      alert.type === 'danger'
                        ? 'text-red-600 dark:text-red-400'
                        : alert.type === 'warning'
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-blue-600 dark:text-blue-400'
                    }`}>
                      {alert.message}
                    </p>
                  </div>
                  <button
                    onClick={() => dismissAlert(alert.id)}
                    className={`text-lg font-bold leading-none opacity-60 hover:opacity-100 ${
                      alert.type === 'danger'
                        ? 'text-red-500'
                        : alert.type === 'warning'
                        ? 'text-yellow-500'
                        : 'text-blue-500'
                    }`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <main className="relative pb-24">
            <ErrorBoundary fallbackTitle="Section Error">
              <Suspense fallback={<SkeletonLoader />}>
                <Routes>
                  <Route path="/" element={<Navigate to="/add-expense" replace />} />
                  <Route path="/add-expense" element={
                    <AddExpense
                      state={store}
                      addExpense={store.addExpense}
                      updateExpense={store.updateExpense}
                      expenseToEdit={store.expenseToEdit}
                      cancelEdit={() => store.setExpenseToEdit(null)}
                      switchTab={(tab) => navigate(`/${tab}`)}
                      showToast={showToast}
                    />
                  } />
                  <Route path="/import" element={
                    <StatementImporter
                      state={store}
                      addExpense={store.addExpense}
                      showToast={showToast}
                    />
                  } />
                  <Route path="/summaries" element={
                    <Summaries
                      state={store}
                      deleteExpense={store.deleteExpense as any}
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
                    <Overview
                      state={store}
                      updateBudget={(b) => store.setState({ monthlyBudget: b })}
                      updateIncome={(p1, p2) => store.setState({ incomePerson1: p1, incomePerson2: p2 })}
                      addFixedPayment={(n, a, d) => store.setState({ fixedPayments: [...store.fixedPayments, { id: Date.now(), name: n, amount: a, day: d, updatedAt: Date.now() }] })}
                      removeFixedPayment={(id) => store.setState({ fixedPayments: store.fixedPayments.filter(fp => fp.id !== id) })}
                      updateState={store.setState}
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
              </Suspense>
            </ErrorBoundary>
          </main>

          <BottomNav
            activeSection={store.activeSection}
            setSection={(s) => navigate(`/${s}`)}
          />
        </div>
        <Analytics />
      </div>
      <SpeedInsights />
    </>
  );
}

export default App;
