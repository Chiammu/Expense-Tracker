
import { GoogleGenAI, Type } from "@google/genai";
import { AppState, Expense, Loan } from "../types";

// Helper to format currency
const formatCurrency = (amount: number) => {
  return '₹' + amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const getAI = () => {
  if (!process.env.API_KEY) {
    console.error("CRITICAL ERROR: API Key is missing in the build.");
    throw new Error("API Key is missing. Please check Environment Variables and redeploy.");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const handleGeminiError = (error: any) => {
  console.error("Gemini API Error details:", error);
  const msg = error.toString().toLowerCase() + (error.message || "").toLowerCase();
  
  if (msg.includes("429") || msg.includes("quota") || msg.includes("resource_exhausted")) {
    return "⚠️ Daily Limit Reached. Please try again tomorrow.";
  }
  return `⚠️ AI Error: ${error.message || "Connection failed"}`;
};

export const generateFinancialInsights = async (state: AppState): Promise<string> => {
  try {
    const ai = getAI();
    const totalExpenses = state.expenses.reduce((sum, e) => sum + e.amount, 0);
    const categoryBreakdown = state.expenses.reduce((acc, curr) => {
      acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
      return acc;
    }, {} as Record<string, number>);

    const person1Total = state.expenses.filter(e => e.person === 'Person1').reduce((sum, e) => sum + e.amount, 0);
    const person2Total = state.expenses.filter(e => e.person === 'Person2').reduce((sum, e) => sum + e.amount, 0);
    const sharedTotal = state.expenses.filter(e => e.person === 'Both').reduce((sum, e) => sum + e.amount, 0);

    const totalIncome = state.incomePerson1 + state.incomePerson2 + state.otherIncome.reduce((sum, i) => sum + i.amount, 0);

    const summaryText = `
      Total Expenses: ${formatCurrency(totalExpenses)}
      Total Income: ${formatCurrency(totalIncome)}
      Monthly Budget: ${formatCurrency(state.monthlyBudget)}
      
      Spending by Person:
      - ${state.settings.person1Name}: ${formatCurrency(person1Total)}
      - ${state.settings.person2Name}: ${formatCurrency(person2Total)}
      - Shared: ${formatCurrency(sharedTotal)}

      Top Categories: ${JSON.stringify(categoryBreakdown)}
    `;

    const prompt = `
      You are a friendly and encouraging financial advisor for a couple.
      Analyze the following financial summary for the current period.
      
      ${summaryText}

      Provide 3-4 distinct, actionable, and short insights or tips.
      - Focus on savings potential.
      - Gently warn if over budget.
      - Be personal using ${state.settings.person1Name} and ${state.settings.person2Name}.
      - Use emojis. Plain text only.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "No insights generated.";
  } catch (error: any) {
    return handleGeminiError(error);
  }
};

/**
 * Generates a full monthly digest suitable for an email report.
 */
export const generateMonthlyDigest = async (state: AppState): Promise<string> => {
  try {
    const ai = getAI();
    const now = new Date();
    const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });
    
    // Filter expenses for last 30 days
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
      Create a "Monthly Financial Report & AI Advisor Digest" for ${monthName}.
      
      Couple: ${state.settings.person1Name} and ${state.settings.person2Name}
      Total Spent: ${formatCurrency(totalSpent)}
      Budget: ${formatCurrency(state.monthlyBudget)}
      Income: ${formatCurrency(state.incomePerson1 + state.incomePerson2)}
      Category Totals: ${JSON.stringify(catGroups)}
      Savings Goals: ${JSON.stringify(state.savingsGoals)}

      Structure the response as follows:
      1. MONTHLY OVERVIEW: A high-level summary of the financial health.
      2. TOP SPENDING AREAS: Analyze where the money went and if it was efficient.
      3. AI ADVISOR STRATEGY: 3 specific, expert-level recommendations for the next month to improve savings or debt management.
      4. ENCOURAGEMENT: A warm closing statement.

      Format: Clean text suitable for an email body. Use emojis sparingly. Do not use Markdown headers, use capitalized labels.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "Digest failed to generate.";
  } catch (error) {
    return handleGeminiError(error);
  }
};

export const getLatestMetalRates = async (): Promise<{gold: number, silver: number, source?: string}> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: "Find the current price of 24k Gold (per gram) and Silver (per gram) in India today in INR. Extract just the numbers. Output JSON format: { \"gold\": number, \"silver\": number }.",
      config: {
        tools: [{googleSearch: {}}],
      }
    });
    
    const text = response.text || "";
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    try {
      const start = cleanText.indexOf('{');
      const end = cleanText.lastIndexOf('}') + 1;
      if (start !== -1 && end !== -1) {
        const jsonStr = cleanText.slice(start, end);
        const data = JSON.parse(jsonStr);
        return {
          gold: Number(data.gold) || 7200, 
          silver: Number(data.silver) || 90,
          source: 'Live (Google Search)'
        };
      }
    } catch (e) {}
    return { gold: 7300, silver: 92, source: 'Mock (Fallback)' };
  } catch (error) {
    return { gold: 7300, silver: 92, source: 'Offline' };
  }
};

export const analyzeLoanStrategy = async (loans: Loan[], surplus: number, person1: string, person2: string): Promise<string> => {
  try {
    const ai = getAI();
    const loanData = loans.map(l => `${l.name}: Pending ₹${l.pendingAmount}, EMI ₹${l.emiAmount}`).join('\n');
    const prompt = `
      Debt reduction strategy for ${person1} and ${person2}. Monthly surplus: ₹${surplus}.
      Current Loans: ${loanData}
      Suggest a strategy to close these effectively. Keep it short.
    `;
    const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
    return response.text || "Could not analyze loans.";
  } catch (error) { return handleGeminiError(error); }
};

export const roastSpending = async (state: AppState): Promise<string> => {
  try {
    const ai = getAI();
    const recentExpenses = state.expenses.slice(-15).map(e => `${e.category}: ${e.amount}`).join(', ');
    const prompt = `Savage roast of ${state.settings.person1Name} & ${state.settings.person2Name}'s spending: ${recentExpenses}. Under 280 characters.`;
    const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
    return response.text || "Roast failed.";
  } catch (error) { return handleGeminiError(error); }
};

export const parseReceiptImage = async (base64Image: string): Promise<Partial<Expense>> => {
  try {
    const ai = getAI();
    const base64Data = base64Image.split(',')[1] || base64Image;
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
          { text: "Extract Total Amount, Date (YYYY-MM-DD), Category, Note. Return JSON." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            amount: { type: Type.NUMBER },
            date: { type: Type.STRING },
            category: { type: Type.STRING },
            note: { type: Type.STRING }
          }
        }
      }
    });
    return JSON.parse(response.text || '{}');
  } catch (error) { throw error; }
};

export const parseNaturalLanguageExpense = async (text: string, person1Name: string, person2Name: string): Promise<Partial<Expense>> => {
  try {
    const ai = getAI();
    const prompt = `Parse: "${text}". Names: ${person1Name}, ${person2Name}. Categories: Groceries, Rent, Bills, EMIs, Shopping, Travel, Food, Entertainment, Medical, Education, Investments, Others.`;
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            amount: { type: Type.NUMBER },
            date: { type: Type.STRING },
            category: { type: Type.STRING },
            paymentMode: { type: Type.STRING },
            note: { type: Type.STRING },
            person: { type: Type.STRING, enum: ["Person1", "Person2", "Both"] }
          }
        }
      }
    });
    return JSON.parse(response.text || '{}');
  } catch (error) { throw error; }
};

export const chatWithFinances = async (history: any[], userMessage: string, state: AppState): Promise<string> => {
  try {
    const ai = getAI();
    const context = `Context: Total Exp: ${state.expenses.reduce((s,e) => s+e.amount, 0)}. Names: ${state.settings.person1Name}, ${state.settings.person2Name}`;
    const prompt = `${context}\nUser: ${userMessage}`;
    const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
    return response.text || "I didn't catch that.";
  } catch (error: any) { return handleGeminiError(error); }
};
