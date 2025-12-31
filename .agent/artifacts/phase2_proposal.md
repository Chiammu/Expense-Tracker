# Phase 2 Implementation Proposal: Routing & State

**Objective**: Move from monolithic state + conditional rendering to React Router + Zustand.

## 1. Dependencies to Install
```bash
npm install react-router-dom zustand clsx tailwind-merge framer-motion
```

## 2. Store Structure (`store/useAppStore.ts`)
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  expenses: Expense[];
  addExpense: (expense: Expense) => void;
  // ... other actions
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      expenses: [],
      addExpense: (expense) => set((state) => ({ expenses: [...state.expenses, expense] })),
      // ...
    }),
    { name: 'expense-storage' }
  )
);
```

## 3. Router Structure (`App.tsx`)
```tsx
<Routes>
  <Route path="/" element={<Navigate to="/add" />} />
  <Route path="/add" element={<AddExpensePage />} />
  <Route path="/overview" element={<OverviewPage />} />
  <Route path="/investments" element={<InvestmentsPage />} />
  <Route path="/settings" element={<SettingsPage />} />
</Routes>
```

This structural change will:
1.  Eliminate the massive `App.tsx` file.
2.  Stop re-rendering "Settings" when you type in "Add Expense".
3.  Allow users to bookmark/refresh specific pages.
