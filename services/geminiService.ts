import { AppState, Expense, ParsedTransaction } from "../types";

// API base URL - defaults to same origin in production
const API_BASE = import.meta.env.VITE_API_BASE || '';

const handleGeminiError = (error: any) => {
  console.error("Gemini API Error details:", error);
  const msg = error.toString().toLowerCase();
  if (msg.includes("429") || msg.includes("quota")) {
    return "⚠️ AI is exhausted. Try again later.";
  }
  return `⚠️ AI Error: ${error.message || "Connection failed"}`;
};

async function callGeminiAPI(action: string, payload: any): Promise<any> {
  const response = await fetch(`${API_BASE}/api/gemini`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'API request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export const chatWithFinances = async (
  history: any[],
  userMessage: string,
  state: AppState
): Promise<{ text: string; toolCall?: any }> => {
  try {
    const systemInstruction = `You are a financial assistant for a couple: ${state.settings.person1Name} and ${state.settings.person2Name}.
    Available categories: ${state.settings.customCategories.join(', ')}.
    Context: Current month spending is ₹${state.expenses.reduce((s, e) => s + e.amount, 0)}.`;
    const result = await callGeminiAPI('chat', { history, userMessage, systemInstruction });
    return { text: result.text, toolCall: result.toolCall };
  } catch (error: any) {
    return { text: handleGeminiError(error) };
  }
};

export const getDeepFinancialStrategy = async (state: AppState): Promise<string> => {
  try {
    const prompt = `Analyze the full financial state:
    Assets: ₹${(state.investments.bankBalance.p1 + state.investments.bankBalance.p2 + state.investments.mutualFunds.shared + state.investments.stocks.shared)}
    Liabilities: ₹${state.loans.reduce((s, l) => s + l.pendingAmount, 0)}
    Monthly Budget: ₹${state.monthlyBudget}
    Provide a 10-year growth projection and a debt-payoff strategy. Use "Think Step-by-Step" reasoning.`;
    const result = await callGeminiAPI('strategy', { prompt });
    return result.text;
  } catch (error: any) {
    return handleGeminiError(error);
  }
};

export const predictNextMonthSpending = async (state: AppState): Promise<string> => {
  try {
    const history = state.expenses.slice(-100).map(e => ({ d: e.date, a: e.amount, c: e.category }));
    const fixed = state.fixedPayments.map(p => ({ n: p.name, a: p.amount }));
    const prompt = `Based on historical data: ${JSON.stringify(history)}
    And fixed bills: ${JSON.stringify(fixed)}
    Predict next month's spending. Look for seasonal trends or recurring spikes.
    Format: "Estimated: ₹[Amount]. Reason: [One sentence prediction]."``;
    const result = await callGeminiAPI('insights', { prompt });
    return result.text;
  } catch (error) {
    return "Spending prediction failed.";
  }
};

export const generateFinancialInsights = async (state: AppState): Promise<string> => {
  try {
    const totalExpenses = state.expenses.reduce((sum, e) => sum + e.amount, 0);
    const categoryBreakdown = state.expenses.reduce((acc, curr) => {
      acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
      return acc;
    }, {} as Record<string, number>);
    const summaryText = `
      Names: ${state.settings.person1Name}, ${state.settings.person2Name}
      Total Expenses: ₹${totalExpenses}
      Budget: ₹${state.monthlyBudget}
      Top Categories: ${JSON.stringify(categoryBreakdown)}
    `;
    const prompt = `Analyze these finances for a couple and give 3 short, punchy, actionable tips. Be encouraging. Use emojis. \n\n ${summaryText}`;
    const result = await callGeminiAPI('insights', { prompt });
    return result.text;
  } catch (error: any) {
    return handleGeminiError(error);
  }
};

export const generateMonthlyDigest = async (state: AppState): Promise<string> => {
  try {
    const now = new Date();
    const lastMonthExpenses = state.expenses.filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const totalSpent = lastMonthExpenses.reduce((s, e) => s + e.amount, 0);
    const catGroups = lastMonthExpenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    }, {} as Record<string, number>);
    const prompt = `
      Create a "Monthly Financial Report & AI Advisor Digest" for ${state.settings.person1Name} and ${state.settings.person2Name}.
      Total Spent: ₹${totalSpent}
      Budget: ₹${state.monthlyBudget}
      Category Totals: ${JSON.stringify(catGroups)}
      Instructions:
      1. Keep it professional but insightful.
      2. No Markdown headers like # or ##. Use CAPITALIZED labels.
      3. Focus on efficiency and savings.
      4. Length: Approx 300 words.
    `;
    const result = await callGeminiAPI('insights', { prompt });
    return result.text;
  } catch (error) {
    return handleGeminiError(error);
  }
};

export const roastSpending = async (state: AppState): Promise<string> => {
  try {
    const recent = state.expenses.slice(-20).map(e => {
      const who = e.person === 'Person1' ? state.settings.person1Name : (e.person === 'Person2' ? state.settings.person2Name : 'Both');
      return `${who}: ₹${e.amount} on ${e.category} (${e.note || 'no note'})`;
    }).join('\n');
    const prompt = `CONTEXT: Financial roast for a couple: ${state.settings.person1Name} and ${state.settings.person2Name}.
DATA: Last 20 expenses: ${recent}
INSTRUCTION: Be savage, hilarious, and brutal. Roast their spending habits based ONLY on the data provided. Limit to 350 characters. Plain text only. Use 🔥 emojis.`;
    const result = await callGeminiAPI('roast', { prompt });
    return result.text;
  } catch (error) {
    return "Your spending is so chaotic it broke my circuits. Get help.";
  }
};

export const getLatestMetalRates = async (): Promise<{ gold: number; silver: number; source?: string }> => {
  try {
    return await callGeminiAPI('metalRates', {});
  } catch (error) {
    return { gold: 7300, silver: 92, source: 'Offline' };
  }
};

export const parseReceiptImage = async (base64Image: string): Promise<Partial<Expense>> => {
  try {
    return await callGeminiAPI('parseReceipt', { base64Image });
  } catch (error) {
    throw error;
  }
};

export const parseNaturalLanguageExpense = async (
  text: string,
  person1Name: string,
  person2Name: string
): Promise<Partial<Expense>> => {
  try {
    return await callGeminiAPI('parseNLP', { text, person1Name, person2Name });
  } catch (error) {
    throw error;
  }
};

export const parseStatementText = async (
  rawText: string,
  categories: string[]
): Promise<ParsedTransaction[]> => {
  try {
    const prompt = `You are a bank statement parser for Indian banks. Parse this statement text and return a JSON array of transactions. Each transaction must have: date (YYYY-MM-DD format), description (merchant/payee name, cleaned up), debit (number, 0 if none), credit (number, 0 if none). Only include debit transactions (expenses). Raw text: ${rawText}. Return ONLY valid JSON array, no markdown.`;
    return await callGeminiAPI('parseStatementText', { prompt, categories });
  } catch (error) {
    throw error;
  }
};

export const suggestTransactionCategories = async (
  descriptions: string[],
  categories: string[]
): Promise<string[]> => {
  try {
    const prompt = `You are categorizing bank transactions. Categories: ${categories.join(', ')}. For each description, return the best category from the list. Descriptions: ${JSON.stringify(descriptions)}. Return ONLY a JSON array of category strings in the same order as descriptions.`;
    const result = await callGeminiAPI('insights', { prompt });
    const text = result.text || '';
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']') + 1;
    if (start === -1 || end === -1) {
      return descriptions.map(() => 'Others');
    }
    const parsed = JSON.parse(text.slice(start, end));
    if (!Array.isArray(parsed)) {
      return descriptions.map(() => 'Others');
    }
    return parsed.map((entry) => (typeof entry === 'string' ? entry : 'Others'));
  } catch (error) {
    return descriptions.map(() => 'Others');
  }
};
