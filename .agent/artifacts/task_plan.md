# Implementation Task Plan

This plan outlines the steps to modernize the Expense Tracker, fixing critical bugs and improving architecture.

## Phase 1: Critical Fixes & Standardization (High Priority)
*Goal: Ensure the app runs reliably on Vercel and local dev without "hacks".*

- [ ] **1.1. Migrate Env Vars**:
    - Rename `SUPABASE_URL` -> `VITE_SUPABASE_URL` in `.env` (user action).
    - Update `services/supabaseClient.ts` to use `import.meta.env.VITE_SUPABASE_URL`.
    - Cleanup `vite.config.ts` `define` block.
- [ ] **1.2. Strict Typing in App.tsx**:
    - Replace `useState<any>(null)` with `useState<Session | null>(null)`.
    - Fix explicit `any` usages.

## Phase 2: Architecture & Navigation (High Impact)
*Goal: Make the app feel like a real web app with URLs and better performance.*

- [ ] **2.1. Install Router**:
    - `npm install react-router-dom`
- [ ] **2.2. Implement Routing**:
    - Wrap `App` in `BrowserRouter`.
    - Replace Conditional Rendering (`activeSection`) with `<Routes>` and `<Route>`.
    - Update `BottomNav` to use `Link` or `useNavigate`.
- [ ] **2.3. Refactor State (Zustand)**:
    - Create `useStore.ts`.
    - Move `expenses`, `settings`, `investments` into the store.
    - Remove prop-drilling from `App.tsx`.

## Phase 3: UX & Premium Polish
*Goal: "Wow" the user.*

- [ ] **3.1. Replace Alerts**:
    - Build a custom `<ConfirmDialog />` (or re-introduce the one that was reverted, properly).
    - Replace `window.confirm` with this modal.
- [ ] **3.2. Transitions**:
    - Add `framer-motion` for smooth page transitions between tabs.
- [ ] **3.3. Loading States**:
    - Add skeleton loaders for data fetching.

## Phase 4: Testing & Hardening
*Goal: Prevent future regressions.*

- [ ] **4.1. Setup Vitest**:
    - Install `vitest` and `testing-library/react`.
    - Add `test` script.
- [ ] **4.2. Write Unit Tests**:
    - Test `services/storage.ts` logic.
    - Test `AddExpense` validation logic.

## Phase 5: Audit & Cleanup
- [ ] Remove unused services/files.
- [ ] Optimize unused dependencies.
