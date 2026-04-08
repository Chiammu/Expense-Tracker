# Implementation Migration Plan

> **Note (current codebase):** `utils/security.ts` has been removed. Security snippets in this document that import it are historical planning notes and are not part of shipped runtime behavior.

## Overview
This document provides a step-by-step plan to implement the expert recommendations while maintaining app stability.

---

## ✅ Phase 1: Critical Bug Fixes (COMPLETED)

### Fixed Issues:
1. ✅ **INITIAL_STATE import bug** - Added import to App.tsx
2. ✅ **Broken className** - Fixed spacing in App.tsx:200
3. ✅ **Duplicate code** - Removed duplicate file reader in Settings.tsx

### Verification:
```bash
npm run build
# Should build without errors
```

---

## 🔄 Phase 2: Security Hardening (Week 1-2)

### 2.1 Implement PIN Hashing

**Files to modify:**
- `components/Settings.tsx`
- `components/LockScreen.tsx`
- `store/useStore.ts`
- `types.ts`

**Steps:**

1. Update `AppSettings` type to use hashed PIN:
```typescript
// types.ts
export interface AppSettings {
  // ... other fields
  pinHash: string | null; // Changed from 'pin'
  // ...
}
```

2. Update Settings to hash PIN before saving:
```typescript
// components/Settings.tsx
import { hashPIN } from '../utils/security';

const handleSetPin = async () => {
  if (pinInput.length === 4) {
    const hashedPin = await hashPIN(pinInput);
    updateSettings({ pinHash: hashedPin });
    setPinInput('');
    showToast("PIN Set");
  }
};
```

3. Update LockScreen to verify hashed PIN:
```typescript
// components/LockScreen.tsx
import { verifyPIN } from '../utils/security';

const handleUnlock = async () => {
  if (props.pinHash && enteredPin.length === 4) {
    const isValid = await verifyPIN(enteredPin, props.pinHash);
    if (isValid) {
      props.onUnlock();
    } else {
      setError(true);
    }
  }
};
```

**Migration for existing users:**
```typescript
// App.tsx - Add migration on load
useEffect(() => {
  if (store.settings.pin && !store.settings.pinHash) {
    // Migrate old plain PIN to hash
    hashPIN(store.settings.pin).then(hash => {
      store.setState({
        settings: {
          ...store.settings,
          pinHash: hash,
          pin: null, // Remove old plain PIN
        }
      });
    });
  }
}, []);
```

### 2.2 Proxy Gemini API through Supabase Edge Function

**Create Supabase Edge Function:**

```bash
# In your Supabase project
supabase functions new gemini-proxy
```

```typescript
// supabase/functions/gemini-proxy/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { GoogleGenAI } from '@google/genai'

serve(async (req) => {
  const { action, data } = await req.json()
  
  // Get API key from Supabase secrets (not exposed to client)
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  const ai = new GoogleGenAI({ apiKey })
  
  try {
    let result
    switch (action) {
      case 'parseReceipt':
        result = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: { parts: [
            { inlineData: { mimeType: 'image/jpeg', data: data.image } },
            { text: "Extract expense details. Return JSON." }
          ]}
        })
        break
      // ... other cases
    }
    
    return new Response(JSON.stringify({ data: result.text }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500
    })
  }
})
```

**Update client to use proxy:**

```typescript
// services/geminiService.ts
const GEMINI_PROXY_URL = 'https://YOUR_PROJECT.supabase.co/functions/v1/gemini-proxy'

export const parseReceiptImage = async (base64Image: string) => {
  const response = await fetch(GEMINI_PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabase.auth.session()?.access_token}`
    },
    body: JSON.stringify({
      action: 'parseReceipt',
      data: { image: base64Image }
    })
  })
  
  const { data } = await response.json()
  return JSON.parse(data)
}
```

### 2.3 Implement Rate Limiting

```typescript
// services/geminiService.ts
import { RateLimiter } from '../utils/security';

const aiRateLimiter = new RateLimiter(5, 60000); // 5 calls per minute

export const parseReceiptImage = async (base64Image: string) => {
  if (!aiRateLimiter.isAllowed()) {
    const waitTime = Math.ceil(aiRateLimiter.getTimeUntilAllowed() / 1000);
    throw new Error(`Rate limited. Try again in ${waitTime} seconds.`);
  }
  
  // ... existing code
};
```

### 2.4 Improve Content Security Policy

```html
<!-- index.html -->
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'nonce-RANDOM_NONCE' https://cdn.tailwindcss.com;
  style-src 'self' 'nonce-RANDOM_NONCE' https://cdn.tailwindcss.com;
  img-src 'self' https: data: blob:;
  font-src 'self' https: data:;
  connect-src 'self' https://*.supabase.co wss://*.supabase.co;
  worker-src 'self' blob:;
">
```

**Generate nonces dynamically:**
```typescript
// vite.config.ts - Add plugin to inject nonces
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    {
      name: 'csp-nonce',
      transformIndexHtml(html) {
        const nonce = crypto.randomUUID();
        return html
          .replace(/RANDOM_NONCE/g, nonce)
          .replace(/<script/g, `<script nonce="${nonce}"`);
      }
    }
  ]
});
```

---

## ⚡ Phase 3: Performance Optimization (Week 2-3)

### 3.1 Add React.memo to Components

```typescript
// components/Summaries.tsx
import React, { memo } from 'react';

export const Summaries = memo<SummariesProps>(({ state, deleteExpense, editExpense }) => {
  // ... existing code
});

// Add custom comparison for deep props
export const Summaries = memo<SummariesProps>(
  ({ state, deleteExpense, editExpense }) => {
    // ...
  },
  (prevProps, nextProps) => {
    // Only re-render if expenses changed
    return prevProps.state.expenses === nextProps.state.expenses;
  }
);
```

### 3.2 Implement Code Splitting

```typescript
// App.tsx
import React, { lazy, Suspense } from 'react';

const Summaries = lazy(() => import('./components/Summaries').then(m => ({ default: m.Summaries })));
const Investments = lazy(() => import('./components/Investments').then(m => ({ default: m.Investments })));
const Settings = lazy(() => import('./components/Settings').then(m => ({ default: m.Settings })));

// Use with Suspense
<Suspense fallback={<LoadingSpinner />}>
  <Route path="/summaries" element={<Summaries ... />} />
</Suspense>
```

### 3.3 Optimize Bundle Size

```bash
# Analyze bundle
npm install -D rollup-plugin-visualizer

# Add to vite.config.ts
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    visualizer({ open: true })
  ]
});

# Build and check bundle
npm run build
```

**Consider replacing large libraries:**
- Recharts (200KB) → Chart.js (60KB) or lightweight alternatives
- Keep jsPDF but lazy load it

```typescript
// Lazy load PDF export
const exportToPDF = async (state: AppState) => {
  const { default: jsPDF } = await import('jspdf');
  await import('jspdf-autotable');
  // ... existing PDF code
};
```

### 3.4 Add Service Worker for Caching

```bash
# Register service worker in index.tsx
```

```typescript
// index.tsx
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('SW registered:', registration);
      })
      .catch((error) => {
        console.log('SW registration failed:', error);
      });
  });
}
```

---

## 🎨 Phase 4: UX Improvements (Week 3-4)

### 4.1 Add Loading States

```typescript
// components/AddExpense.tsx
import { LoadingSpinner } from './LoadingSpinner';

// Replace hardcoded spinner
{isProcessing ? <LoadingSpinner size="sm" /> : <span className="text-xl">📷</span>}
```

### 4.2 Implement Empty States

```typescript
// components/Summaries.tsx
import { NoExpensesState } from './EmptyState';

{filteredExpenses.length === 0 ? (
  <NoExpensesState onAddExpense={() => navigate('/add-expense')} />
) : (
  // ... existing list
)}
```

### 4.3 Add Undo Functionality

```typescript
// App.tsx - Add undo stack
const [undoStack, setUndoStack] = useState<Expense[]>([]);

const handleDelete = (id: number) => {
  const expense = store.expenses.find(e => e.id === id);
  if (expense) {
    setUndoStack([...undoStack, expense]);
    store.deleteExpense(id);
    
    showToast(
      <div>
        Deleted. <button onClick={() => handleUndo(expense)}>Undo</button>
      </div>,
      'info'
    );
    
    // Auto-clear undo after 5 seconds
    setTimeout(() => {
      setUndoStack(stack => stack.filter(e => e.id !== expense.id));
    }, 5000);
  }
};
```

### 4.4 Make Calendar Interactive

```typescript
// components/Summaries.tsx
const [selectedDay, setSelectedDay] = useState<string | null>(null);

<div 
  onClick={() => d.day && setSelectedDay(d.dateStr)}
  className="cursor-pointer hover:ring-2 hover:ring-primary"
>
  {/* ... calendar day content */}
</div>

{selectedDay && (
  <DayDetailsModal 
    date={selectedDay}
    expenses={state.expenses.filter(e => e.date === selectedDay)}
    onClose={() => setSelectedDay(null)}
  />
)}
```

### 4.5 Add Keyboard Shortcuts

```typescript
// App.tsx
import { createKeyboardShortcuts } from './utils/accessibility';

useEffect(() => {
  const cleanup = createKeyboardShortcuts({
    'Ctrl+n': () => navigate('/add-expense'),
    'Ctrl+e': () => exportData(store),
    '/': (e) => {
      e.preventDefault();
      document.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
    },
  });
  
  return cleanup;
}, []);
```

---

## ♿ Phase 5: Accessibility (Week 4-5)

### 5.1 Add ARIA Labels

```typescript
// components/AddExpense.tsx
<button
  onClick={() => fileInputRef.current?.click()}
  aria-label="Upload receipt photo for AI parsing"
  aria-describedby="receipt-help"
>
  📷
</button>
<span id="receipt-help" className="sr-only">
  Upload a receipt image and AI will extract expense details
</span>
```

### 5.2 Implement Keyboard Navigation

```typescript
// components/BottomNav.tsx
<button
  onClick={() => setSection('add-expense')}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      setSection('add-expense');
    }
  }}
  tabIndex={0}
  role="tab"
  aria-selected={activeSection === 'add-expense'}
>
  Add
</button>
```

### 5.3 Add Focus Management

```typescript
// components/LockScreen.tsx
import { useEffect, useRef } from 'react';

const pinInputRef = useRef<HTMLInputElement>(null);

useEffect(() => {
  pinInputRef.current?.focus();
}, []);
```

### 5.4 Screen Reader Announcements

```typescript
// App.tsx
import { announceToScreenReader } from './utils/accessibility';

const handleDelete = (id: number) => {
  store.deleteExpense(id);
  announceToScreenReader('Expense deleted', 'assertive');
};
```

---

## 🧪 Phase 6: Testing (Week 5-6)

### 6.1 Setup Vitest

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
```

### 6.2 Write Critical Tests

Follow the examples in `TESTING_GUIDE.md`

### 6.3 Setup CI/CD

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:coverage
      - run: npm run build
```

---

## 📦 Phase 7: Advanced Features (Week 6+)

### 7.1 Push Notifications

```typescript
// Request permission
const requestNotificationPermission = async () => {
  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    const registration = await navigator.serviceWorker.ready;
    await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: 'YOUR_VAPID_PUBLIC_KEY'
    });
  }
};
```

### 7.2 Background Sync

```typescript
// Register sync when offline
if ('serviceWorker' in navigator && 'sync' in navigator.serviceWorker) {
  navigator.serviceWorker.ready.then(registration => {
    registration.sync.register('sync-expenses');
  });
}
```

### 7.3 Multi-Currency Support

```typescript
// types.ts
export interface AppSettings {
  // ...
  currency: 'INR' | 'USD' | 'EUR' | 'GBP';
  // ...
}

// utils/currency.ts
export const CURRENCY_SYMBOLS = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

// Use in components
{CURRENCY_SYMBOLS[state.settings.currency]}{amount}
```

---

## 🔄 Rollback Plan

If issues arise after deployment:

1. **Revert to previous version:**
```bash
git revert <commit-hash>
git push
```

2. **Feature flags for gradual rollout:**
```typescript
// utils/constants.ts
export const FEATURES = {
  NEW_SECURITY: false, // Toggle features
  PWA_FEATURES: false,
};

// Use in components
{FEATURES.NEW_SECURITY && <BiometricAuth />}
```

3. **Database migration rollback:**
```sql
-- If you made schema changes
ALTER TABLE app_state DROP COLUMN new_field;
```

---

## 📊 Success Metrics

Track these after each phase:

- **Performance**: Lighthouse score > 90
- **Bundle size**: < 500KB gzipped
- **Load time**: < 2s on 3G
- **Test coverage**: > 80%
- **Accessibility**: WCAG AA compliance
- **Error rate**: < 0.1%
- **User satisfaction**: Monitor feedback

---

## 🎯 Quick Reference Checklist

- [ ] Phase 1: Critical bug fixes ✅
- [ ] Phase 2: Security hardening
  - [ ] PIN hashing
  - [ ] API proxy
  - [ ] Rate limiting
  - [ ] CSP improvements
- [ ] Phase 3: Performance
  - [ ] React.memo
  - [ ] Code splitting
  - [ ] Bundle optimization
  - [ ] Service worker
- [ ] Phase 4: UX
  - [ ] Loading states
  - [ ] Empty states
  - [ ] Undo functionality
  - [ ] Keyboard shortcuts
- [ ] Phase 5: Accessibility
  - [ ] ARIA labels
  - [ ] Keyboard navigation
  - [ ] Focus management
  - [ ] Screen reader support
- [ ] Phase 6: Testing
  - [ ] Unit tests
  - [ ] Integration tests
  - [ ] E2E tests
  - [ ] CI/CD
- [ ] Phase 7: Advanced features
  - [ ] Push notifications
  - [ ] Background sync
  - [ ] Multi-currency

---

## 📞 Support & Questions

For questions about this migration plan:
1. Review the `EXPERT_RECOMMENDATIONS.md`
2. Check `TESTING_GUIDE.md` for test examples
3. Consult the codebase documentation

Good luck with the migration! 🚀
