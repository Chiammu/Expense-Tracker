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
    "zomato": "Zomato",
    "swiggy": "Swiggy",
    "amazon": "Amazon",
    "flipkart": "Flipkart",
    "blinkit": "Blinkit",
    "netflix": "Netflix",
    "spotify": "Spotify",
    "uber": "Uber",
    "ola": "Ola",
    "myntra": "Myntra",
    "ajio": "Ajio",
    "dmart": "DMart",
    "jiomart": "JioMart",
    "bigbasket": "BigBasket",
    "starbucks": "Starbucks",
    "mcdonalds": "McDonald's",
    "kfc": "KFC",
    "dominos": "Domino's",
    "pizza hut": "Pizza Hut",
    "bookmyshow": "BookMyShow",
    "paytm": "Paytm",
    "gpay": "Google Pay",
    "phonepe": "PhonePe",
    "cred": "CRED",
    "zerodha": "Zerodha",
    "groww": "Groww",
    "apple": "Apple",
    "google": "Google",
    "microsoft": "Microsoft"
};

export function extractMerchant(note: string, category: string): string {
    if (!note || note.trim() === '') {
        return category; // Fallback to category if note is empty
    }

    let cleanNote = note.trim();

    // 1. Remove common payment prefixes
    const prefixes = ["UPI-", "NEFT-", "IMPS-", "RTGS-", "POS-", "ATM-", "CARD-", "MOB-"];
    for (const prefix of prefixes) {
        if (cleanNote.toUpperCase().startsWith(prefix)) {
            cleanNote = cleanNote.substring(prefix.length).trim();
        }
    }

    // 2. Remove bank reference codes roughly (simple heuristic: look for alphanumeric strings at end > 6 chars)
    // This is tricky without regex, but let's try a simple regex replacement
    // "HDFC0001234" usually at the end or "REF123456"
    cleanNote = cleanNote.replace(/\s[A-Z0-9]{6,}$/, '').trim();

    // Also remove something that looks like a pure transaction ID e.g., "1234567890"
    if (/^\d+$/.test(cleanNote)) {
        return category;
    }

    // 3. Normalized check
    const lowerNote = cleanNote.toLowerCase();

    // Check strict mappings first
    for (const [key, val] of Object.entries(MERCHANT_MAPPINGS)) {
        if (lowerNote.includes(key)) {
            return val;
        }
    }

    // 4. Proper capitalization for others
    // If it's a short name, just capitalize first letter
    if (cleanNote.length > 0) {
        return cleanNote.charAt(0).toUpperCase() + cleanNote.slice(1);
    }

    return category;
}

export function getMerchantStats(expenses: Expense[]): MerchantStat[] {
    const merchantMap: Record<string, {
        totalSpent: number;
        count: number;
        dates: string[];
        categories: Record<string, number>;
    }> = {};

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    // Group by merchant
    expenses.forEach(e => {
        const merchantName = extractMerchant(e.note, e.category);

        if (!merchantMap[merchantName]) {
            merchantMap[merchantName] = {
                totalSpent: 0,
                count: 0,
                dates: [],
                categories: {}
            };
        }

        merchantMap[merchantName].totalSpent += e.amount;
        merchantMap[merchantName].count += 1;
        merchantMap[merchantName].dates.push(e.date);

        // Track categories to find the most frequent one
        merchantMap[merchantName].categories[e.category] = (merchantMap[merchantName].categories[e.category] || 0) + 1;
    });

    // Convert to array
    const stats: MerchantStat[] = Object.entries(merchantMap).map(([name, data]) => {
        // Determine primary category
        const primaryCategory = Object.entries(data.categories).sort((a, b) => b[1] - a[1])[0][0];

        // Sort dates
        data.dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime()); // Descending
        const lastVisit = data.dates[0];

        // Calculate Trend (This month avg vs Previous avg? Or simply vs last visit?)
        // Simple trend: Did we spend more than average transaction amount in the last visit?
        // Or maybe: Is the last visit recent?
        // Let's implement trend = 'up' if average spend > global average spend?
        // Better: let's compute month-over-month if possible, but that's complex.
        // Fallback: stable by default.
        let trend: MerchantStat['trend'] = 'stable';

        return {
            merchant: name,
            totalSpent: data.totalSpent,
            visitCount: data.count,
            averageSpend: data.totalSpent / data.count,
            lastVisit,
            category: primaryCategory,
            trend,
            percentOfTotal: (data.totalSpent / totalExpenses) * 100
        };
    });

    // Sort by total spent descending
    return stats.sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 20);
}
