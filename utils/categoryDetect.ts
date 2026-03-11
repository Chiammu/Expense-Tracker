/**
 * Auto-detects expense category from bank statement description using keyword matching.
 * Tuned for Indian bank statement narrations.
 */

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Food': [
    'zomato', 'swiggy', 'dominos', 'pizza', 'mcdonald', 'kfc', 'burger', 'restaurant',
    'cafe', 'coffee', 'starbucks', 'chai', 'bakery', 'food', 'eat', 'dining', 'biryani',
    'subway', 'dunkin', 'barbeque', 'hotel', 'canteen', 'mess', 'tiffin'
  ],
  'Groceries': [
    'bigbasket', 'blinkit', 'zepto', 'grofers', 'dmart', 'reliance smart', 'more',
    'grocery', 'supermarket', 'vegetables', 'fruits', 'milk', 'dairy', 'provision',
    'kirana', 'jiomart', 'nature basket', 'star bazaar', 'spar', 'fresh'
  ],
  'Travel': [
    'irctc', 'uber', 'ola', 'rapido', 'redbus', 'makemytrip', 'goibibo', 'cleartrip',
    'yatra', 'indigo', 'spicejet', 'airindia', 'vistara', 'cab', 'taxi', 'metro',
    'petrol', 'diesel', 'fuel', 'hp ', 'iocl', 'bpcl', 'toll', 'fastag', 'parking',
    'railway', 'flight', 'bus ticket', 'auto '
  ],
  'Shopping': [
    'amazon', 'flipkart', 'myntra', 'ajio', 'nykaa', 'meesho', 'snapdeal',
    'tata cliq', 'croma', 'reliance digital', 'vijay sales', 'decathlon',
    'lifestyle', 'shoppers stop', 'westside', 'h&m', 'zara', 'pantaloons',
    'mall', 'fashion', 'clothing', 'shoes', 'accessories'
  ],
  'Bills': [
    'electricity', 'water bill', 'gas bill', 'broadband', 'jio', 'airtel', 'vi ',
    'bsnl', 'postpaid', 'prepaid', 'recharge', 'dth', 'tata sky', 'dish tv',
    'internet', 'wifi', 'mobile bill', 'phone bill', 'utility', 'maintenance'
  ],
  'Entertainment': [
    'netflix', 'amazon prime', 'hotstar', 'disney', 'spotify', 'youtube',
    'apple music', 'gaana', 'jiocinema', 'zee5', 'sonyliv', 'pvr', 'inox',
    'cinema', 'movie', 'game', 'steam', 'playstation', 'xbox', 'book my show',
    'concert', 'event', 'ticket'
  ],
  'Medical': [
    'pharmacy', 'medical', 'hospital', 'doctor', 'clinic', 'apollo', 'practo',
    'pharmeasy', 'netmeds', '1mg', 'medplus', 'lab test', 'diagnostic',
    'health', 'medicine', 'dental', 'eye care', 'optical'
  ],
  'Education': [
    'school', 'college', 'university', 'tuition', 'coaching', 'udemy', 'coursera',
    'unacademy', 'byjus', 'book', 'stationery', 'education', 'exam', 'fee',
    'library', 'course'
  ],
  'EMIs': [
    'emi', 'loan', 'repayment', 'instalment', 'installment', 'bajaj finserv',
    'hdfc ltd', 'home loan', 'car loan', 'personal loan'
  ],
  'Rent': [
    'rent', 'lease', 'landlord', 'house rent', 'room rent', 'pg ', 'hostel'
  ],
  'Investments': [
    'mutual fund', 'sip', 'zerodha', 'groww', 'upstox', 'kuvera', 'coin',
    'stock', 'share', 'demat', 'nps', 'ppf', 'fd ', 'fixed deposit', 'rd ',
    'recurring deposit', 'insurance', 'lic', 'dividend', 'nach ', 'ach/dir'
  ],
  'Taxes': [
    'tds ', 'tcs ', 'tax deduct', 'income tax', 'gst '
  ],
  'Cash Transfer': [
    'nfs/cash', 'atm wdl', 'cash withdrawal', 'atm withdrawal'
  ]
};

/**
 * Given a bank narration/description string, returns the best-matching category.
 * Falls back to 'Others' if no match found.
 */
export function detectCategory(description: string): string {
  const lower = description.toLowerCase();
  
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        return category;
      }
    }
  }
  
  return 'Others';
}

/**
 * Given a bank narration/description string, returns the best-matching category.
 * Falls back to 'Others' if no match found.
 */
export function cleanMerchantName(description: string): string {
  let cleaned = description;

  // Handle common UPI formats
  // Format 1: UPI/123456789012/Merchant Name/...
  // Format 2: UPI/Merchant Name/123456789012/...
  if (cleaned.toUpperCase().startsWith('UPI/')) {
    const parts = cleaned.split('/');
      if (/^\d{8,}$/.test(parts[1]) && parts.length >= 3) {
        // ID is second, Merchant is third
        cleaned = parts[2];
      } else if (parts.length > 2 && /^\d{8,}$/.test(parts[2])) {
        // Merchant is second, ID is third
        cleaned = parts[1];
      } else if (parts[1]) {
        // Fallback: If it doesn't strictly look like a long ID, just take the first meaningful part
        // but avoid chopping off the whole name if it contained slashes naturally
        cleaned = parts.slice(1).join(' ').replace(/pay@icici|@sbi|@hdfc/i, '');
      }
  } else if (cleaned.toUpperCase().startsWith('NEFT') || cleaned.toUpperCase().startsWith('IMPS')) {
    // Strip NEFT/IMPS prefixes conditionally
    const match = cleaned.match(/(?:NEFT|IMPS)[\s\w-]*?([A-Za-z\s]+)(?:$|\/|-)/);
    if (match && match[1].trim() !== '') {
      cleaned = match[1];
    }
  }

  // Remove common payment processor suffixes
  cleaned = cleaned.replace(/@icici$|@hdfc$|@sbi$|@ybl$|@paytm$|@axl$|@ibl$/i, '');

  return cleaned.trim() || description.trim();
}

/**
 * Smart categorize based on description and amount.
 */
export function smartCategorize(description: string, amount: number): string {
  const lower = description.toLowerCase();

  // Rule 1: Sweeps and Internal Transfers
  if (lower.includes('sweep trf') || lower.includes('fd premat') || lower.includes('fd maturity') || lower.includes('self transfer')) {
    return 'Investments';
  }

  // Rule 2: Dividends and NACH 
  if (lower.includes('dividend') || lower.includes('ach/dir') || lower.includes('nach')) {
    return 'Investments';
  }

  // Rule 3: ATM Withdrawals
  if (lower.includes('nfs/cash') || lower.includes('atm wdl') || lower.includes('cash wdl')) {
    return 'Cash Transfer';
  }

  // --- Negative Keyword Protection ---
  // e.g. "Dining table pepperfry" shouldn't be Dining Out.
  const isFurniture = lower.includes('table') || lower.includes('chair') || lower.includes('bed') || lower.includes('ikea') || lower.includes('pepperfry');
  
  // Standard detection
  let bestCategory = 'Others';
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    // Skip Dining/Food if it's clearly furniture
    if (isFurniture && (category === 'Food' || category === 'Dining')) {
      continue;
    }

    let found = false;
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        bestCategory = category;
        found = true;
        break;
      }
    }
    if (found) break;
  }

  // Rule 2: Amount-based dining vs food
  if (bestCategory === 'Food' && amount > 1000) {
    return 'Dining';
  }

  return bestCategory;
}
