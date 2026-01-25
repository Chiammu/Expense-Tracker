# AI Features Setup Guide

## Overview
This app uses Google Gemini AI for several powerful features:
- 📸 Receipt image parsing (extract amounts, dates, categories)
- 🗣️ Natural language expense entry ("spent 500 on coffee")
- 🔥 Spending roasts (AI analyzes and roasts your spending habits)
- 💡 Financial insights and predictions
- 📊 Monthly digests

## Quick Setup

### Step 1: Get a Free Gemini API Key

1. Visit: **https://aistudio.google.com/app/apikey**
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy your API key

### Step 2: Add API Key to Your Project

Create a `.env` file in the root of your project:

```bash
# Copy the example file
cp .env.example .env
```

Edit `.env` and add your API key:

```env
GEMINI_API_KEY=your_actual_api_key_here
```

**Important:** Never commit your `.env` file to git! It's already in `.gitignore`.

### Step 3: Restart Development Server

```bash
# Stop the dev server (Ctrl+C)
# Then restart it
npm run dev
```

## Verifying Setup

### Test the AI Features

1. **Receipt Parsing** - Go to Add Expense → Click camera icon → Upload a receipt
2. **Voice Input** - Click microphone icon → Say "spent 500 on groceries"  
3. **Roast Feature** - Go to Summaries → Click "Roast My Spending" (needs 5+ expenses)
4. **Insights** - Go to Overview → Click AI prediction cards

### Check for Errors

Open browser console (F12) and look for:
- ✅ No "API Key is missing" errors
- ✅ AI responses appearing
- ❌ If you see errors, check your API key

## Troubleshooting

### Issue: "API Key is missing"

**Cause:** The `.env` file doesn't exist or the key is not set.

**Solution:**
```bash
# Create .env file
echo "GEMINI_API_KEY=your_key_here" > .env

# Restart dev server
npm run dev
```

### Issue: "AI quota exhausted" or 429 errors

**Cause:** Free tier has limits (60 requests per minute, 1500 per day).

**Solutions:**
1. Wait a few minutes and try again
2. Get a new API key
3. Upgrade to paid tier: https://ai.google.dev/pricing

### Issue: AI responses are slow

**Normal behavior:** 
- Receipt parsing: 2-5 seconds
- Roasting: 3-7 seconds
- NLP: 1-3 seconds

**If too slow:**
- Check your internet connection
- Try during off-peak hours
- Consider caching results

### Issue: Roast button does nothing

**Fixed in this update!** The roast result now displays in a beautiful card below the button.

**If still not working:**
1. Open browser console (F12)
2. Click "Roast My Spending"
3. Check for errors
4. Verify you have 5+ expenses

## API Key Security

### ⚠️ Important Security Notes

**Current Setup (Development):**
- API key is in client-side code
- Anyone can see it in browser DevTools
- Only suitable for development/personal use

**Production Setup (Recommended):**

For production deployment, **proxy AI requests through your backend**:

1. Create Supabase Edge Function:
```typescript
// supabase/functions/gemini-proxy/index.ts
import { serve } from 'https://deno.land/std/http/server.ts'

serve(async (req) => {
  const { action, data } = await req.json()
  const apiKey = Deno.env.get('GEMINI_API_KEY') // Server-side only!
  
  // Make Gemini API call here
  // Return result
})
```

2. Update client to use proxy:
```typescript
// Instead of calling Gemini directly
const result = await fetch('/functions/v1/gemini-proxy', {
  method: 'POST',
  body: JSON.stringify({ action: 'roast', data: expenses })
})
```

See `MIGRATION_PLAN.md` Phase 2.2 for detailed instructions.

## Rate Limiting

### Current Limits (Free Tier)

- **60 requests per minute**
- **1,500 requests per day**
- **32,000 tokens per minute**

### Implemented Protections

The app now includes rate limiting:
```typescript
// utils/security.ts
const aiRateLimiter = new RateLimiter(5, 60000); // 5 calls per minute
```

**Recommended:** Add rate limiting to all AI features (see MIGRATION_PLAN.md Phase 2.3)

## Feature-Specific Setup

### Receipt Parsing

**Requirements:**
- Clear photo of receipt
- Readable text
- Good lighting

**Supported formats:**
- JPG, PNG
- Max ~4MB (browser limit)

**What it extracts:**
- Amount
- Date
- Category (if recognizable)
- Merchant name

### Natural Language Processing

**Examples:**
- "spent 500 on groceries"
- "paid 2000 for rent yesterday"
- "John spent 350 on food"

**Supports:**
- Person recognition (Person1, Person2, Both)
- Date parsing (today, yesterday, last week)
- Category inference
- Amount extraction

### Roast Feature

**Requirements:**
- Minimum 5 expenses
- More expenses = better roasts

**How it works:**
1. Takes last 20 expenses
2. Sends to Gemini with "roast" prompt
3. AI analyzes patterns
4. Returns savage but funny roast

**Cooldown:** 5 minutes between roasts (configurable in `utils/constants.ts`)

## Cost Estimation

### Free Tier
- **Perfect for personal use**
- 1,500 requests/day = ~50 expenses per day
- Receipt: ~$0.00 per scan
- Roast: ~$0.00 per roast

### If You Exceed Free Tier
- Paid tier: $0.35 per 1M tokens
- Average request: ~500 tokens
- Cost: ~$0.000175 per request (negligible)

**Monthly estimate for heavy user:**
- 100 receipts: ~$0.02
- 50 roasts: ~$0.01
- 100 NLP entries: ~$0.01
- **Total: ~$0.04/month**

## Advanced Configuration

### Change AI Models

Edit `services/geminiService.ts`:

```typescript
// Current: gemini-3-flash-preview (fast, cheap)
model: 'gemini-3-flash-preview'

// Alternatives:
model: 'gemini-1.5-flash'  // More stable
model: 'gemini-1.5-pro'    // Better accuracy, slower
```

### Adjust Prompts

Make roasts more or less savage:

```typescript
// In geminiService.ts -> roastSpending()
const prompt = `INSTRUCTION: Be savage, hilarious, and brutal.`

// Change to:
const prompt = `INSTRUCTION: Be funny but gentle.`
```

### Add Rate Limiting

```typescript
import { RateLimiter } from '../utils/security';

const aiRateLimiter = new RateLimiter(5, 60000);

export const roastSpending = async (state: AppState) => {
  if (!aiRateLimiter.isAllowed()) {
    const wait = Math.ceil(aiRateLimiter.getTimeUntilAllowed() / 1000);
    throw new Error(`Rate limited. Try again in ${wait}s`);
  }
  // ... rest of code
};
```

## Environment Variables

### Full .env Example

```env
# Required for AI features
GEMINI_API_KEY=your_gemini_api_key

# Optional: Supabase (for cloud sync)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Vite Environment Variables

**Note:** Vite requires `VITE_` prefix for client-side variables.

For Gemini, we use `process.env.GEMINI_API_KEY` which is defined in `vite.config.ts`:

```typescript
define: {
  'process.env.GEMINI_API_KEY': JSON.stringify(process.env.GEMINI_API_KEY)
}
```

## FAQ

**Q: Can I use this without AI features?**  
A: Yes! All AI features are optional. Manual entry always works.

**Q: Will my receipts be stored?**  
A: No. Images are sent to Gemini, processed, then discarded. Only extracted text is saved.

**Q: Is my data private?**  
A: Gemini processes requests but doesn't store them for training (as of 2024). See: https://ai.google.dev/gemini-api/terms

**Q: Can I switch to OpenAI or Claude?**  
A: Yes! Replace the API calls in `services/geminiService.ts`. See MIGRATION_PLAN.md for details.

**Q: Why is the API key exposed in browser?**  
A: This is a development setup. For production, use backend proxy (see Security section above).

## Next Steps

1. ✅ Set up API key (.env file)
2. ✅ Test all AI features
3. 📖 Read `EXPERT_RECOMMENDATIONS.md` for improvements
4. 🔒 Follow `MIGRATION_PLAN.md` Phase 2 for production security
5. ⚡ Implement rate limiting (Phase 2.3)

## Support

If you encounter issues:

1. Check browser console for errors
2. Verify API key is correct
3. Test API key directly: https://aistudio.google.com/app/prompts/new_chat
4. Review this guide's Troubleshooting section
5. Check Gemini API status: https://status.google.com/

## Resources

- **Gemini API Docs:** https://ai.google.dev/docs
- **Get API Key:** https://aistudio.google.com/app/apikey
- **Pricing:** https://ai.google.dev/pricing
- **Rate Limits:** https://ai.google.dev/gemini-api/docs/quota
- **Terms:** https://ai.google.dev/gemini-api/terms

---

**Ready to roast your spending?** 🔥 Get your API key and start tracking smarter!
