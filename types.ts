
export interface Expense {
  id: number;
  person: string;
  date: string;
  amount: number;
  category: string;
  paymentMode: string;
  note: string;
}

export interface FixedPayment {
  id: number;
  name: string;
  amount: number;
  day: number;
}

export interface OtherIncome {
  id: number;
  desc: string;
  amount: number;
}

export interface SavingsGoal {
  id: number;
  name: string;
  targetAmount: number;
  currentAmount: number;
}

export interface ChatMessage {
  id: string;
  sender: 'Person1' | 'Person2';
  text: string;
  timestamp: string;
}

// --- NEW TYPES FOR INVESTMENTS ---
export interface AssetSplit {
  p1: number;
  p2: number;
  shared: number;
}

export interface MetalAsset {
  p1Grams: number;
  p2Grams: number;
  sharedGrams: number;
}

export interface Investments {
  bankBalance: { p1: number; p2: number };
  mutualFunds: AssetSplit;
  stocks: AssetSplit;
  gold: MetalAsset;
  silver: MetalAsset;
}

export interface Loan {
  id: number;
  name: string;
  totalAmount: number; // Original Principal
  pendingAmount: number; // Currently pending
  emiAmount: number; // Monthly payment
  person: 'Person1' | 'Person2' | 'Both';
}

export interface AppSettings {
  theme: 'light' | 'dark';
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontStyle: 'clean' | 'playful' | 'serif';
  fontSize: 'small' | 'medium' | 'large';
  coverPhotoData: string | null;
  headerTitle: string;
  headerSubtitle: string;
  person1Name: string;
  person2Name: string;
  customCategories: string[];
  categoryIcons: Record<string, string>;
  pin: string | null; 
  syncId: string | null; 
  lastFixedPaymentCheck: string | null; 
}

export interface AppState {
  expenses: Expense[];
  settings: AppSettings;
  monthlyBudget: number;
  otherIncome: OtherIncome[];
  fixedPayments: FixedPayment[];
  incomePerson1: number;
  incomePerson2: number;
  savingsGoals: SavingsGoal[];
  categoryBudgets: Record<string, number>;
  chatMessages: ChatMessage[];
  // New State Fields
  investments: Investments;
  loans: Loan[];
}

export type Section = 'add-expense' | 'summaries' | 'investments' | 'overview' | 'settings';

export const DEFAULT_CATEGORIES = [
  "Groceries", "Rent", "Bills", "EMIs", "Shopping", "Travel", "Food", 
  "Entertainment", "Medical", "Education", "Investments", "Others"
];

export const DEFAULT_ICONS: Record<string, string> = {
  "Groceries": "🥦", "Rent": "🏠", "Bills": "⚡", "EMIs": "🏦",
  "Shopping": "🛍️", "Travel": "🚕", "Food": "🍔", "Entertainment": "🎬",
  "Medical": "💊", "Education": "📚", "Investments": "📈", "Others": "📦"
};

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  primaryColor: '#e91e63',
  secondaryColor: '#2196f3',
  accentColor: '#ff6f00',
  fontStyle: 'clean',
  fontSize: 'medium',
  coverPhotoData: null,
  headerTitle: 'Couple Expense Tracker',
  headerSubtitle: 'Manage your finances together',
  person1Name: 'Person 1',
  person2Name: 'Person 2',
  customCategories: DEFAULT_CATEGORIES,
  categoryIcons: DEFAULT_ICONS,
  pin: null,
  syncId: null,
  lastFixedPaymentCheck: new Date().toISOString(),
};

export const INITIAL_INVESTMENTS: Investments = {
  bankBalance: { p1: 0, p2: 0 },
  mutualFunds: { p1: 0, p2: 0, shared: 0 },
  stocks: { p1: 0, p2: 0, shared: 0 },
  gold: { p1Grams: 0, p2Grams: 0, sharedGrams: 0 },
  silver: { p1Grams: 0, p2Grams: 0, sharedGrams: 0 },
};

export const INITIAL_STATE: AppState = {
  expenses: [],
  settings: DEFAULT_SETTINGS,
  monthlyBudget: 0,
  otherIncome: [],
  fixedPayments: [],
  incomePerson1: 0,
  incomePerson2: 0,
  savingsGoals: [],
  categoryBudgets: {},
  chatMessages: [],
  investments: INITIAL_INVESTMENTS,
  loans: [],
};
