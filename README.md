# Couple Expense Tracker

A shared personal-finance app for couples to track expenses, budgets, recurring payments, and investments in one place.

## Shipped Features

- Expense capture with category/person/payment tracking
- Search and filterable summaries with category analytics
- Merchant analytics dashboard inside Summaries
- Split-bill generator and shareable split links
- Cash-flow calendar forecast in Overview
- Investment and asset tracking
- Savings goals, budgets, and smart alerts
- Challenge tracking and reward celebrations
- PIN/WebAuthn lock screen support (existing app behavior)
- Optional AI features (roast/insights/parsing) when API keys are configured

## Scope Notes

The following experimental modules are **not shipped in the current UI** and were removed to reduce dead code:

- In-app Chat screen
- Spend Score panel
- Unused security utility helper module (`utils/security.ts`) that was not wired into runtime flows

## Run Locally

**Prerequisites:** Node.js 18+

1. Install dependencies:
   ```bash
   npm install
   ```
2. (Optional) Configure AI key in `.env`:
   ```bash
   GEMINI_API_KEY=your_key_here
   ```
3. Start dev server:
   ```bash
   npm run dev
   ```
4. Build for production:
   ```bash
   npm run build
   ```
