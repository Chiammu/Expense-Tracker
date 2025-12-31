# Implementation Plan: Feature Differentiation & Growth

This plan aligns the user's growth strategy with technical execution steps.

## 1. Competitive Moat: "The AI Financial Partner"
**Objective**: Move beyond simple tracking to "Active Financial Coaching".

### A. Smart Categorization & Receipt OCR
*Current State*: Manual entry.
*Differentiation*: "Snap & Forget".
**Implementation**:
1.  **OCR Service**: Use Gemini 1.5 Flash (multimodal) to process images.
    *   *File*: `services/geminiService.ts`
    *   *Action*: Update `parseReceiptImage` to be more robust with structured JSON output.
2.  **Auto-Categorization**: Train a small prompt in Gemini to classify transaction descriptions based on Indian context (e.g., "Swiggy" -> "Food", "Uber" -> "Transport").

### B. "Conflict Prediction" Engine (Unique Value Prop)
*Idea*: Analyze spending patterns that historically cause budget overruns.
**Implementation**:
1.  **Data Analysis**: Create a new service `services/analytics.ts`.
2.  **Logic**: Compare `p1` vs `p2` spending in specific categories against the limits.
3.  **UI**: Add a "Partner Pulse" widget in `Overview.tsx` showing alignment score.

## 2. India-Specific Features
**Objective**: Dominate the local market niche.

### A. UPI Integration (Manual Intent)
*Limitation*: Cannot auto-read SMS on iOS/Web implies manual input.
*Workaround*: "Share to App".
1.  **PWA Feature**: Ensure the app is installable.
2.  **Share Target API**: Allow sharing a UPI screenshot to the PWA, which triggers the OCR engine to extract amounts.

### B. Gold/SIP Tracking via API
*Feature*: Live tracking of investments.
**Implementation**:
1.  **Gold Price API**: Integrate a free generic API for live gold rates (or scrape via Edge Function).
2.  **Portfolio Calculation**: Update `Investments.tsx` to multiply `grams * current_rate`.

## 3. Relationship features "Impact Stories"
**Objective**: Emotional engagement.
**Implementation**:
1.  **Story Generator**: Use Gemini to generate a monthly "Newsletter" style summary.
    *   "You saved enough for a weekend trip to Coorg!"
2.  **Visuals**: Use a library like `framer-motion` to create a "Spotify Wrapped" style monthly review modal.

## 4. Monetization Strategy (Technical Prep)
**Objective**: Prepare codebase for Freemium model.
**Implementation**:
1.  **User Tiers**: Add `tier` column to `app_state` table (`free`, `pro`).
2.  **Feature Gating**: Create a `CheckAccess` HOC (Higher Order Component) to lock features like "Advanced Analytics" or "AI Coach".
3.  **Payment Gateway**: Prepare for Razorpay integration (backend function required).

## Execution Roadmap (Next 2 Weeks)

### Week 1: The "Wow" Factor (AI)
- [ ] Refine `geminiService.ts` for consistent JSON outputs.
- [ ] Implement "Smart Category Suggestion" in `AddExpense` form.
- [ ] Build the "Roast" feature into a more helpful "Monthly Insight" report.

### Week 2: Reliability & PWA
- [ ] Configure `manifest.json` for full PWA installability.
- [ ] Implement "Share Target" for potential UPI screenshot sharing.
- [ ] Add offline support via Service Workers.
