# Full-Stack Review Findings

**Date:** December 31, 2025
**Scope:** Frontend Codebase, Architecture, Security, config
**Version Checked:** Reverted State (Dec 25 Commit)

## 1. 🚨 Critical Issues (Immediate Action Required)

### A. Environment Variable Handling (The "Blank Screen" Cause)
- **Current State**: The code uses `process.env.SUPABASE_URL` in `services/supabaseClient.ts`. React/Vite applications do not support `process.env` natively in the browser.
- **The "Fix"**: The `vite.config.ts` attempts to polyfill this using `define`, but this is fragile and often fails in CI/CD environments (like Vercel) if the build process doesn't explicitly have access to those system variables at the exact moment of compilation.
- **Impact**: Application crashes immediately on load if variables are missing, leading to a White Screen of Death (WSOD).
- **Recommendation**: Migrate fully to `import.meta.env.VITE_*` standard.

### B. Monolithic State Management
- **Current State**: `App.tsx` holds a massive `AppState` object containing expenses, settings, investments, chat, etc. a single `useState`.
- **Impact**: 
  - **Performance**: Every single character typed in a chat message or expense note triggers a re-render of the *entire application tree*.
  - **Maintainability**: `App.tsx` is over 200 lines of "prop drilling" (passing callbacks down 3-4 levels).
- **Recommendation**: Split state into context providers or a lightweight store (Zustand).

### C. Missing Routing
- **Current State**: `const [activeSection, setActiveSection] = useState('add-expense')`.
- **Impact**: 
  - Users cannot share links to specific pages.
  - The browser "Back" button leaves the website instead of going to the previous screen.
- **Recommendation**: Implement `react-router-dom`.

## 2. Code Quality & Architecture

- **Unused/Dead Code**: 
  - `services/auth.ts`, `services/webAuthn.ts`, `services/crypto.ts` exist but need verification of usage.
  - `App.tsx` lines 112-115 contain complex logic for Card updates nested inside a state setter.
- **Type Safety**:
  - `App.tsx`: `const [session, setSession] = useState<any>(null);` (Line 23). Avoid `any`.
  - Huge `AppState` interface makes it hard to decouple features.

## 3. Security Analysis

- **LocalStorage**: Sensitive financial data is stored in `localStorage` in plain text.
  - *Risk*: Malicious scripts or extensions could read this.
- **Supabase**: 
  - `supabaseClient.ts` warns on console if keys are missing but doesn't prevent the app from trying to function, possibly leading to confusing errors later.
  - No evidence of RLS (Row Level Security) - assumed handled on backend, but client should handle auth errors gracefully.

## 4. UX & Design

- **Interaction**: Uses native `window.confirm()` and `window.alert()` which blocks the UI and looks "cheap"/"dated".
- **Feedback**: No loading states for async actions (like adding an expense) other than a toast *after* completion.
- **Mobile Experience**: Navigation logic is good, but PWA capabilities need verification (`manifest.json` exists).

## 5. Deployment

- **Vercel**: `vite.config.ts` manual chunks strategy is largely unnecessary for an app this size and might cause caching issues if not tuned.
- **Tests**: Zero automated tests found.
