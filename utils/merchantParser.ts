import { Expense } from '../types';

export interface MerchantStat {
  merchant: string;
  totalSpent: number;
  visitCount: number;
  averageSpend: number;
  lastVisit: string;
  category: string;
  trend: 'up' | 'down' | 'stable';
  percentOfTotal: number;
}

const MERCHANT_MAPPINGS: Record<string, string> = {
  'zomato': 'Zomato',
  'swiggy': 'Swiggy',
  'amazon': 'Amazon',
  'flipkart': 'Flipkart',
  'blinkit': 'Blinkit',
  'netflix': 'Netflix',
  'spotify': 'Spotify',
  'uber': 'Uber',
  'ola': 'Ola',
  'zepto': 'Zepto',
  'bigbasket': 'BigBasket',
  'instamart': 'Instamart',
  'myntra': 'Myntra',
  'ajio': 'AJIO',
  'meesho': 'Meesho',
  'paytm': 'Paytm',
  'phonepe': 'PhonePe',
  'gpay': 'GPay',
  'google pay': 'GPay',
};

const MERCHANT_EMOJIS: Record<string, string> = {
  'Zomato': '🍽️',
  'Swiggy': '🍔',
  'Amazon': '📦',
  'Flipkart': '🛒',
  'Blinkit': '🥛',
  'Netflix': '🎬',
  'Spotify': '🎵',
  'Uber': '🚕',
  'Ola': '🚗',
  'Zepto': '🚀',
  'BigBasket': '🥦',
  'Instamart': '🏪',
  'Myntra': '👗',
  'AJIO': '👔',
  'Meesho': '🛍️',
  'Paytm': '💳',
  'PhonePe': '💙',
  'GPay': '💚',
};

export function extractMerchant(note: string, category: string): string {
  if (!note || note.trim() === '') {
    return category;
  }

  let cleaned = note.toLowerCase().trim();

  cleaned = cleaned.replace(/^upi-/, '');
  cleaned = cleaned.replace(/^neft-/, '');
  cleaned = cleaned.replace(/^imps-/, '');

  cleaned = cleaned.replace(/\s*[-:]\s*[a-z0-9]{10,}$/i, '');
  cleaned = cleaned.replace(/\s*[-:]\s*hdfc\d+/i, '');
  cleaned = cleaned.replace(/\s*[-:]\s*icici\d+/i, '');
  cleaned = cleaned.replace(/\s*[-:]\s*sbi\d+/i, '');
  cleaned = cleaned.replace(/\s*[-:]\s*\d{10,}$/i, '');

  cleaned = cleaned.trim();

  for (const [key, value] of Object.entries(MERCHANT_MAPPINGS)) {
    if (cleaned.includes(key)) {
      return value;
    }
  }

  if (cleaned.length > 30) {
    cleaned = cleaned.substring(0, 30);
  }

  if (cleaned === '' || cleaned === 'upi') {
    return category;
  }

  return cleaned
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function getMerchantEmoji(merchantName: string): string {
  const lowerName = merchantName.toLowerCase();

  for (const [key, emoji] of Object.entries(MERCHANT_EMOJIS)) {
    if (lowerName.includes(key.toLowerCase())) {
      return emoji;
    }
  }

  const emojis = ['🏪', '🛍️', '💳', '🏬', '⭐'];
  const index = merchantName.length % emojis.length;
  return emojis[index];
}

export function getMerchantStats(expenses: Expense[]): MerchantStat[] {
  const merchantMap: Record<string, Expense[]> = {};

  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, now.getDate());

  expenses.forEach(expense => {
    const merchant = extractMerchant(expense.note, expense.category);
    if (!merchantMap[merchant]) {
      merchantMap[merchant] = [];
    }
    merchantMap[merchant].push(expense);
  });

  const totalAllSpending = expenses.reduce((sum, e) => sum + e.amount, 0);

  const stats: MerchantStat[] = Object.entries(merchantMap).map(([merchant, merchantExpenses]) => {
    const totalSpent = merchantExpenses.reduce((sum, e) => sum + e.amount, 0);
    const visitCount = merchantExpenses.length;
    const averageSpend = totalSpent / visitCount;

    const lastVisit = merchantExpenses
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date;

    const currentMonthSpending = merchantExpenses
      .filter(e => new Date(e.date) >= lastMonth)
      .reduce((sum, e) => sum + e.amount, 0);

    const previousMonthSpending = merchantExpenses
      .filter(e => {
        const d = new Date(e.date);
        return d >= twoMonthsAgo && d < lastMonth;
      })
      .reduce((sum, e) => sum + e.amount, 0);

    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (previousMonthSpending > 0) {
      const change = (currentMonthSpending - previousMonthSpending) / previousMonthSpending;
      if (change > 0.1) trend = 'up';
      else if (change < -0.1) trend = 'down';
    } else if (currentMonthSpending > 0) {
      trend = 'up';
    }

    const category = merchantExpenses[0].category;

    return {
      merchant,
      totalSpent,
      visitCount,
      averageSpend,
      lastVisit,
      category,
      trend,
      percentOfTotal: totalAllSpending > 0 ? (totalSpent / totalAllSpending) * 100 : 0,
    };
  });

  return stats
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 20);
}
