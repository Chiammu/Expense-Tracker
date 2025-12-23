
import React from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
// import { MainLayout } from './components/MainLayout';
import { AddExpense } from './components/AddExpense';
import { Summaries } from './components/Summaries';
import { Investments } from './components/Investments';
import { Overview } from './components/Overview';
import { Settings } from './components/Settings';

function App() {
  const {
    state, setState, addExpense, updateExpense, deleteExpense,
    expenseToEdit, setExpenseToEdit, updateSettings, showToast
  } = useExpense();

  const navigate = useNavigate();

  // Helper for Overview component updates
  const updateBudget = (b: number) => setState(p => ({ ...p, monthlyBudget: b }));
  const updateIncome = (p1: number, p2: number) => setState(p => ({ ...p, incomePerson1: p1, incomePerson2: p2 }));
  const addFixedPayment = (n: string, a: number, d: number) =>
    setState(p => ({ ...p, fixedPayments: [...p.fixedPayments, { id: Date.now(), name: n, amount: a, day: d }] }));
  const removeFixedPayment = (id: number) =>
    setState(p => ({ ...p, fixedPayments: p.fixedPayments.filter(fp => fp.id !== id) }));

  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route index element={
          <AddExpense
            state={state}
            addExpense={addExpense}
            updateExpense={updateExpense}
            expenseToEdit={expenseToEdit}
            cancelEdit={() => setExpenseToEdit(null)}
            switchTab={(tab) => navigate(tab === 'add-expense' ? '/' : `/${tab}`)}
            showToast={showToast}
          />
        } />

        <Route path="summaries" element={
          <Summaries
            state={state}
            deleteExpense={deleteExpense}
            editExpense={(exp) => { setExpenseToEdit(exp); navigate('/'); }}
          />
        } />

        <Route path="investments" element={
          <Investments
            state={state}
            updateState={(updates) => setState(prev => ({ ...prev, ...updates }))}
            showToast={showToast}
          />
        } />

        <Route path="overview" element={
          <Overview
            state={state}
            updateBudget={updateBudget}
            updateIncome={updateIncome}
            addFixedPayment={addFixedPayment}
            removeFixedPayment={removeFixedPayment}
            updateState={(updates) => setState(prev => ({ ...prev, ...updates }))}
          />
        } />

        <Route path="settings" element={
          <Settings
            state={state}
            updateSettings={updateSettings}
            resetData={() => { localStorage.clear(); window.location.reload(); }}
            importData={() => { }}
            showToast={showToast}
            installApp={() => { }}
            canInstall={false}
            isIos={false}
            isStandalone={false}
          />
        } />
      </Route>
    </Routes>
  );
}

export default App;
