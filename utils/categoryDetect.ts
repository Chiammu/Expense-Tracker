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
    'recurring deposit', 'insurance', 'lic'
  ],
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
