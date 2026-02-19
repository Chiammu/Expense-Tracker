import React, { useEffect, useRef, Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
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
    </>
  );
}

export default App;
