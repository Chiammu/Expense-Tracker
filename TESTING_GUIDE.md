# Testing Guide for Couple Expense Tracker

## Overview
This guide outlines the testing strategy and setup for comprehensive test coverage.

---

## Testing Stack (Recommended)

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event
npm install -D @vitest/ui jsdom
npm install -D @playwright/test  # For E2E tests
```

---

## Test Structure

```
/tests
  /unit
    /components
      AddExpense.test.tsx
      Summaries.test.tsx
      Settings.test.tsx
    /services
      storage.test.ts
      geminiService.test.ts
    /store
      useStore.test.ts
  /integration
    expense-workflow.test.tsx
    auth-flow.test.tsx
  /e2e
    critical-path.spec.ts
```

---

## Unit Tests

### Example: Store Test (`useStore.test.ts`)

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAppStore } from '../store/useStore';

describe('useAppStore', () => {
  beforeEach(() => {
    const { result } = renderHook(() => useAppStore());
    act(() => {
      result.current.reset();
    });
  });

  it('should add expense correctly', () => {
    const { result } = renderHook(() => useAppStore());
    
    act(() => {
      result.current.addExpense({
        person: 'Person1',
        date: '2024-01-25',
        amount: 500,
        category: 'Food',
        paymentMode: 'UPI',
        note: 'Dinner',
      });
    });

    expect(result.current.expenses).toHaveLength(1);
    expect(result.current.expenses[0].amount).toBe(500);
    expect(result.current.expenses[0].person).toBe('Person1');
  });

  it('should delete expense correctly', () => {
    const { result } = renderHook(() => useAppStore());
    
    let expenseId: number;
    
    act(() => {
      result.current.addExpense({
        person: 'Person1',
        date: '2024-01-25',
        amount: 500,
        category: 'Food',
        paymentMode: 'UPI',
        note: 'Dinner',
      });
      expenseId = result.current.expenses[0].id;
    });

    act(() => {
      result.current.deleteExpense(expenseId);
    });

    expect(result.current.expenses).toHaveLength(0);
  });

  it('should update credit card balance when adding card expense', () => {
    const { result } = renderHook(() => useAppStore());
    
    // First add a credit card
    act(() => {
      result.current.setState({
        creditCards: [{
          id: 1,
          name: 'HDFC',
          limit: 50000,
          billingDay: 5,
          currentBalance: 0,
          updatedAt: Date.now(),
        }],
      });
    });

    // Add expense using card
    act(() => {
      result.current.addExpense({
        person: 'Person1',
        date: '2024-01-25',
        amount: 1000,
        category: 'Shopping',
        paymentMode: 'Card',
        cardId: 1,
        note: 'Clothes',
      });
    });

    expect(result.current.creditCards[0].currentBalance).toBe(1000);
  });
});
```

### Example: Component Test (`AddExpense.test.tsx`)

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddExpense } from '../components/AddExpense';
import { INITIAL_STATE } from '../types';

describe('AddExpense Component', () => {
  const mockAddExpense = vi.fn();
  const mockShowToast = vi.fn();

  const defaultProps = {
    state: INITIAL_STATE,
    addExpense: mockAddExpense,
    switchTab: vi.fn(),
    showToast: mockShowToast,
  };

  it('should render form fields correctly', () => {
    render(<AddExpense {...defaultProps} />);
    
    expect(screen.getByLabelText(/person/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
  });

  it('should submit expense when all fields are filled', async () => {
    const user = userEvent.setup();
    render(<AddExpense {...defaultProps} />);

    await user.selectOptions(screen.getByLabelText(/person/i), 'Person1');
    await user.type(screen.getByLabelText(/amount/i), '500');
    await user.selectOptions(screen.getByLabelText(/category/i), 'Food');
    await user.click(screen.getByText('UPI'));
    await user.click(screen.getByText(/add expense/i));

    await waitFor(() => {
      expect(mockAddExpense).toHaveBeenCalledWith({
        person: 'Person1',
        date: expect.any(String),
        amount: 500,
        category: 'Food',
        paymentMode: 'UPI',
        note: '',
      });
    });
  });

  it('should show error toast when required fields are missing', async () => {
    const user = userEvent.setup();
    render(<AddExpense {...defaultProps} />);

    await user.click(screen.getByText(/add expense/i));

    expect(mockShowToast).toHaveBeenCalledWith(
      'Please fill all required fields',
      'error'
    );
  });
});
```

---

## Integration Tests

### Example: Expense Workflow (`expense-workflow.test.tsx`)

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import App from '../App';

describe('Expense Workflow', () => {
  it('should allow adding and viewing expense', async () => {
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );

    // Should start on Add Expense page
    expect(screen.getByText(/add new expense/i)).toBeInTheDocument();

    // Fill form
    await user.selectOptions(screen.getByLabelText(/person/i), 'Person1');
    await user.type(screen.getByLabelText(/amount/i), '500');
    await user.selectOptions(screen.getByLabelText(/category/i), 'Food');
    await user.click(screen.getByText('UPI'));
    await user.type(screen.getByLabelText(/description/i), 'Dinner');
    await user.click(screen.getByText(/add expense/i));

    // Navigate to Summaries
    await user.click(screen.getByRole('link', { name: /summaries/i }));

    // Verify expense appears
    await waitFor(() => {
      expect(screen.getByText('Dinner')).toBeInTheDocument();
      expect(screen.getByText('₹500')).toBeInTheDocument();
    });
  });
});
```

---

## E2E Tests (Playwright)

### Setup (`playwright.config.ts`)

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: !process.env.CI,
  },
});
```

### Example: Critical Path (`critical-path.spec.ts`)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Critical User Journey', () => {
  test('should complete full expense tracking flow', async ({ page }) => {
    // 1. Visit app
    await page.goto('/');

    // 2. Click "Continue as Guest"
    await page.click('text=Continue as Guest');

    // 3. Add expense
    await page.selectOption('select[name="person"]', 'Person1');
    await page.fill('input[type="number"]', '1000');
    await page.selectOption('select[name="category"]', 'Groceries');
    await page.click('text=UPI');
    await page.fill('input[placeholder*="description"]', 'Weekly groceries');
    await page.click('button:has-text("Add Expense")');

    // 4. Navigate to summaries
    await page.click('text=Summaries');

    // 5. Verify expense exists
    await expect(page.locator('text=Weekly groceries')).toBeVisible();
    await expect(page.locator('text=₹1000')).toBeVisible();

    // 6. Delete expense
    await page.hover('text=Weekly groceries');
    await page.click('[aria-label="Delete expense"]');
    await page.click('text=Confirm');

    // 7. Verify deletion
    await expect(page.locator('text=Weekly groceries')).not.toBeVisible();
  });

  test('should work offline', async ({ page, context }) => {
    await page.goto('/');
    await page.click('text=Continue as Guest');

    // Add expense
    await page.fill('input[type="number"]', '500');
    // ... fill form

    // Go offline
    await context.setOffline(true);

    // Should still work
    await page.click('button:has-text("Add Expense")');
    
    // Go back online
    await context.setOffline(false);

    // Should sync
    await page.waitForTimeout(1000);
    await page.click('text=Summaries');
    await expect(page.locator('text=₹500')).toBeVisible();
  });
});
```

---

## Test Coverage Goals

- **Unit Tests**: 80%+ coverage
- **Integration Tests**: Cover all critical user flows
- **E2E Tests**: Cover happy path + key edge cases

---

## Running Tests

```bash
# Unit & Integration tests
npm run test              # Run all tests
npm run test:watch        # Watch mode
npm run test:ui           # Vitest UI
npm run test:coverage     # Coverage report

# E2E tests
npm run test:e2e          # Run Playwright tests
npm run test:e2e:ui       # Playwright UI mode
```

---

## CI/CD Integration

### GitHub Actions (`.github/workflows/test.yml`)

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm run test:coverage
      - run: npm run test:e2e
      - uses: codecov/codecov-action@v3
        with:
          file: ./coverage/coverage-final.json
```

---

## Mocking Guidelines

### Mock Supabase

```typescript
vi.mock('./services/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}));
```

### Mock Gemini API

```typescript
vi.mock('./services/geminiService', () => ({
  parseReceiptImage: vi.fn().mockResolvedValue({
    amount: 500,
    category: 'Food',
    date: '2024-01-25',
  }),
  roastSpending: vi.fn().mockResolvedValue('Your spending is... interesting 🔥'),
}));
```

---

## Best Practices

1. **Test behavior, not implementation**
2. **Use data-testid sparingly** - prefer semantic queries
3. **Mock external dependencies** - Supabase, Gemini, etc.
4. **Test accessibility** - use `getByRole`, check ARIA
5. **Clean up after tests** - reset store, clear mocks
6. **Avoid snapshot tests** - they break easily and don't test behavior

---

## Next Steps

1. Set up Vitest configuration
2. Write tests for critical paths first
3. Gradually increase coverage
4. Add pre-commit hook to run tests
5. Set up CI/CD pipeline
