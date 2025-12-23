
import { GoogleGenAI, Type } from "@google/genai";
import { AppState, Expense, Loan } from "../types";

// Helper to format currency
const formatCurrency = (amount: number) => {
  return '₹' + amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const getAI = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("CRITICAL ERROR: API Key is missing.");
    throw new Error("API Key is missing.");
  }
  return new GoogleGenAI({ apiKey });
};

const handleGeminiError = (error: any) => {
  console.error("Gemini API Error details:", error);
  const msg = error.toString().toLowerCase() + (error.message || "").toLowerCase();
  
  if (msg.includes("429") || msg.includes("quota") || msg.includes("resource_exhausted")) {
    return "⚠️ AI is exhausted. Please try again tomorrow.";
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

    const summaryText = `
      Names: ${state.settings.person1Name}, ${state.settings.person2Name}
      Total Expenses: ${formatCurrency(totalExpenses)}
      Budget: ${formatCurrency(state.monthlyBudget)}
      Top Categories: ${JSON.stringify(categoryBreakdown)}
    `;

    const prompt = `Analyze these finances for a couple and give 3 short, punchy, actionable tips. Be encouraging. Use emojis. \n\n ${summaryText}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "No insights generated.";
  } catch (error: any) {
    return handleGeminiError(error);
  }
};

export const generateMonthlyDigest = async (state: AppState): Promise<string> => {
  try {
    const ai = getAI();
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

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "Digest failed to generate.";
  } catch (error) {
    return handleGeminiError(error);
  }
};

export const roastSpending = async (state: AppState): Promise<string> => {
  try {
    const ai = getAI();
    // Analyze last 20 expenses
    const recent = state.expenses.slice(-20).map(e => {
      const who = e.person === 'Person1' ? state.settings.person1Name : (e.person === 'Person2' ? state.settings.person2Name : 'Both');
      return `${who}: ₹${e.amount} on ${e.category} (${e.note || 'no note'})`;
    }).join('\n');

    const prompt = `
      CONTEXT: Financial roast for a couple: ${state.settings.person1Name} and ${state.settings.person2Name}.
      DATA: Last 20 expenses:
      ${recent}

      INSTRUCTION: Be savage, hilarious, and brutal. Roast their spending habits based ONLY on the data provided. 
      Mention specific "stupid" notes or high amounts. 
      Limit to 350 characters. Plain text only. No markdown. Use 🔥 emojis.
    `;

    const response = await ai.models.generateContent({ 
      model: 'gemini-3-flash-preview', 
      contents: prompt 
    });

    return response.text?.trim() || "You spend money so boringly I have nothing to say.";
  } catch (error) { 
    return "Your spending is so chaotic it broke my circuits. Get help."; 
  }
};

export const getLatestMetalRates = async (): Promise<{gold: number, silver: number, source?: string}> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: "Output JSON only: { \"gold\": number, \"silver\": number } for current 24k gold and silver prices per gram in India in INR.",
      config: { tools: [{googleSearch: {}}] }
    });
    
    const text = response.text || "";
    try {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}') + 1;
      const data = JSON.parse(text.slice(start, end));
      return { gold: Number(data.gold) || 7200, silver: Number(data.silver) || 90, source: 'Live' };
    } catch (e) { return { gold: 7300, silver: 92, source: 'Fallback' }; }
  } catch (error) { return { gold: 7300, silver: 92, source: 'Offline' }; }
};

export const chatWithFinances = async (history: any[], userMessage: string, state: AppState): Promise<string> => {
  try {
    const ai = getAI();
    const context = `Context: Total Exp: ₹${state.expenses.reduce((s,e) => s+e.amount, 0)}. Names: ${state.settings.person1Name}, ${state.settings.person2Name}`;
    const prompt = `${context}\nUser: ${userMessage}`;
    const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
    return response.text || "I didn't catch that.";
  } catch (error: any) { return handleGeminiError(error); }
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
          { text: "Extract: amount (number), date (YYYY-MM-DD), category, note. Return JSON." }
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
    const prompt = `Parse this expense note: "${text}". The people involved are ${person1Name} and ${person2Name}. Return JSON with: amount, date, category, person (Person1/Person2/Both), note.`;
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
