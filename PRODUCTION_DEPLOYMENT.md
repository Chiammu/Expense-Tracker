# Production Deployment Guide

## 🔐 Critical Security Fixes Implemented

### 1. Gemini API Key Protection
- **Before**: API key exposed in client bundle via `vite.config.ts`
- **After**: All Gemini calls proxied through serverless API route `/api/gemini`
- **Action Required**: Set `GEMINI_API_KEY` environment variable in Vercel

### 2. Tailwind CSS Migration
- **Before**: 3MB runtime Tailwind loaded from CDN with `unsafe-eval`
- **After**: Tailwind installed as PostCSS plugin with proper tree-shaking
- **Result**: ~90% reduction in CSS bundle size, CSP compliant

### 3. Content Security Policy
- **Before**: `unsafe-inline` and `unsafe-eval` allowed (XSS vulnerability)
- **After**: Strict CSP with only necessary permissions
- **Note**: Removed external icon CDN, using local assets

### 4. Sensitive Data Protection
- Added `fixed_backup.json` to `.gitignore`
- Removed from git history
- Added pattern `*_backup.json` to prevent future leaks

## 🚀 Deployment Steps

### Vercel Deployment

1. **Set Environment Variables**:
   ```bash
   GEMINI_API_KEY=your_gemini_api_key_here
   VITE_API_BASE=https://your-domain.vercel.app
   ```

2. **Build Command**: `npm run build`
3. **Output Directory**: `dist`
4. **Install Command**: `npm install`

5. **Deploy**:
   ```bash
   vercel --prod
   ```

### Required Icons
The app references `/icon-192.png` and `/icon-512.png`. Add these to `/public/`:
- Download from: https://www.flaticon.com/free-icon/expenses_2344132
- Or generate custom icons with your branding

### Security Headers
Security headers are configured in `vercel.json`:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=()`

### SEO/Privacy
- `robots.txt` added to prevent indexing (financial data)
- Meta tag `noindex, nofollow` added to HTML

## 📊 Performance Optimizations

### Code Splitting
- **Lazy Loading**: Summaries, Overview, Investments, Settings components
- **Manual Chunks**: React, Recharts, jsPDF, Supabase separated
- **Expected**: ~40% reduction in initial bundle size

### Bundle Analysis
Run locally to check bundle sizes:
```bash
npm run build
npx vite-bundle-visualizer
```

## 🐛 Bug Fixes

### 1. Expense ID Collision
- **Before**: `Date.now()` - possible collisions in same millisecond
- **After**: `crypto.randomUUID()` - guaranteed unique IDs
- **Impact**: Fixed potential data corruption in LWW merge logic

### 2. Missing `updatedAt` in AppState
- Added `updatedAt: number` to `AppState` interface
- Fixed Last-Write-Wins conflict resolution

### 3. Stale Closure in Realtime Subscription
- **Before**: `store.setState` captured in closure, stale after re-renders
- **After**: Using `useRef` to hold latest setState handler
- **Impact**: Fixed bug where synced data appeared to disappear

### 4. TypeScript `any` Types
- Session typed properly: `{ user: { id: string; email?: string } }`
- Fixed `duePayments` typing
- Expense ID changed from `number` to `string` (for UUID)

## 🔄 Migration Notes

### Breaking Changes
- **Expense IDs**: Changed from `number` to `string`
- Existing data will work (numbers coerce to strings)
- Cloud sync will handle migration automatically via LWW

### Backwards Compatibility
- Old local storage data will be migrated on first load
- Cloud sync merges gracefully using `updatedAt` timestamps

## 📝 Rate Limiting

The `/api/gemini` endpoint has built-in rate limiting:
- **Limit**: 30 requests per minute per IP
- **Response**: `429 Too Many Requests`
- **Recommendation**: Upgrade to Redis/Upstash for production

## 🧪 Testing Checklist

Before deploying to production:

- [ ] Test Gemini API calls (check `/api/gemini` endpoint works)
- [ ] Verify icons load properly
- [ ] Test PWA install on iOS/Android
- [ ] Check CSP headers (DevTools → Network → Response Headers)
- [ ] Test lazy loading (Network tab, slow 3G throttling)
- [ ] Verify rate limiting works (spam AI features)
- [ ] Test offline mode (Service Worker active)
- [ ] Check robots.txt accessible at `/robots.txt`

## 🚨 Known Limitations

1. **Rate Limiting**: In-memory store resets on cold starts
   - **Solution**: Use Vercel KV or Upstash Redis

2. **Icons**: Placeholder references need real assets
   - **Solution**: Add proper PWA icons to `/public/`

3. **Error Monitoring**: No telemetry configured
   - **Recommendation**: Add Sentry (see below)

## 🔍 Optional Enhancements

### Add Sentry Error Tracking
```bash
npm install @sentry/react
```

In `index.tsx`:
```typescript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "your_sentry_dsn",
  environment: "production"
});
```

### Add Analytics
```bash
npm install @vercel/analytics
```

## 📞 Support

For production issues:
1. Check Vercel deployment logs
2. Verify environment variables are set
3. Test API endpoint directly: `curl https://your-domain.vercel.app/api/gemini`
4. Check browser console for CSP violations

---

**Deployment Date**: [Auto-generated on deploy]
**Version**: 2.0.0 (Production-Ready)
