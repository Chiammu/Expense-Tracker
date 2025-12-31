# Task Plan: Refinement & Scaling

## Phase 1: Robustness & Cleanup (Immediate)
- [ ] **Type Safety Overhaul**: replace all `any` uses in `storage.ts` and `geminiService.ts` with strict types.
- [ ] **Data Security**: Implement basic encryption for LocalStorage data.
- [ ] **CI Pipeline**: Create `.github/workflows/ci.yml` for automated type checking.

## Phase 2: Performance & Architecture (Weeks 1-2)
- [ ] **React Query Migration**: Replace manual `useEffect` fetching in `App.tsx` with `useQuery`.
- [ ] **Code Splitting**: Wrap route components in `Suspense` and `lazy` import.
- [ ] **Supabase RLS**: Audit and harden database policies.

## Phase 3: Testing Strategy (Week 3)
- [ ] **Unit Tests**: Write tests for `storage.ts` conflict resolution logic.
- [ ] **Integration Tests**: Test the `AddExpense` flow with mocked Supabase calls.

## Phase 4: Feature Expansion (Month 2)
- [ ] **Receipt Scanning**: Implement Optical Character Recognition (OCR) for receipts.
- [ ] **Advanced Analytics**: Add charts for monthly comparisons and category trends.
- [ ] **Multi-Currency Support**: Add support for USD/EUR conversions.
