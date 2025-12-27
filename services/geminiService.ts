
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { AppState, Expense, Loan } from "../types";

const getAI = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key is missing.");
  return new GoogleGenAI({ apiKey });
};

const handleGeminiError = (error: any) => {
  console.error("Gemini API Error details:", error);
  const msg = error.toString().toLowerCase() + (error.message || "").toLowerCase();
  if (msg.includes("429") || msg.includes("quota")) return "⚠️ AI is exhausted. Try again later.";
  return `⚠️ AI Error: ${error.message || "Connection failed"}`;
};

// Tool definition for adding expenses
const addExpenseTool: FunctionDeclaration = {
  name: 'add_expense',
  parameters: {
    type: Type.OBJECT,
    description: 'Add a new expense to the financial tracker.',
    properties: {
      amount: { type: Type.NUMBER, description: 'The monetary amount.' },
      category: { type: Type.STRING, description: 'Category (Groceries, Rent, Food, etc.).' },
      person: { type: Type.STRING, enum: ['Person1', 'Person2', 'Both'], description: 'Who paid.' },
      note: { type: Type.STRING, description: 'Brief description.' },
      date: { type: Type.STRING, description: 'Date in YYYY-MM-DD.' }
    },
    required: ['amount', 'category', 'person']
  }
};

export const chatWithFinances = async (history: any[], userMessage: string, state: AppState): Promise<{text: string, toolCall?: any}> => {
  try {
    const ai = getAI();
    const system = `You are a financial assistant for a couple: ${state.settings.person1Name} and ${state.settings.person2Name}. 
    Available categories: ${state.settings.customCategories.join(', ')}.
    Context: Current month spending is ₹${state.expenses.reduce((s,e) => s+e.amount, 0)}.`;
    
    const response = await ai.models.generateContent({ 
      model: 'gemini-3-flash-preview', 
      contents: [...history, { role: 'user', parts: [{ text: userMessage }] }],
      config: {
        systemInstruction: system,
        tools: [{ functionDeclarations: [addExpenseTool] }]
      }
    });

    // Use response.functionCalls as recommended by standard
    const toolCall = response.functionCalls?.[0];
    return { 
      text: response.text || (toolCall ? "Processing your request..." : "I didn't catch that."),
      toolCall: toolCall
    };
  } catch (error: any) { 
    return { text: handleGeminiError(error) }; 
  }
};

export const getDeepFinancialStrategy = async (state: AppState): Promise<string> => {
  try {
    const ai = getAI();
    const prompt = `Analyze the full financial state:
    Assets: ₹${(state.investments.bankBalance.p1 + state.investments.bankBalance.p2 + state.investments.mutualFunds.shared + state.investments.stocks.shared)}
    Liabilities: ₹${state.loans.reduce((s, l) => s + l.pendingAmount, 0)}
    Monthly Budget: ₹${state.monthlyBudget}
    
    Provide a 10-year growth projection and a debt-payoff strategy. Use "Think Step-by-Step" reasoning.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 32768 } // Max budget for gemini-3-pro-preview reasoning
      }
    });

    return response.text || "Strategy generation failed.";
  } catch (error: any) {
    return handleGeminiError(error);
  }
};

export const predictNextMonthSpending = async (state: AppState): Promise<string> => {
  try {
    const ai = getAI();
    const history = state.expenses.slice(-100).map(e => ({ d: e.date, a: e.amount, c: e.category }));
    const fixed = state.fixedPayments.map(p => ({ n: p.name, a: p.amount }));

    const prompt = `Based on historical data: ${JSON.stringify(history)} 
    And fixed bills: ${JSON.stringify(fixed)}
    Predict next month's spending. Look for seasonal trends or recurring spikes. 
    Format: "Estimated: ₹[Amount]. Reason: [One sentence prediction]."`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt
    });

    return response.text || "Prediction unavailable.";
  } catch (error) {
    return "Spending prediction failed.";
  }
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
      Total Expenses: ₹${totalExpenses}
      Budget: ₹${state.monthlyBudget}
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
    const recent = state.expenses.slice(-20).map(e => {
      const who = e.person === 'Person1' ? state.settings.person1Name : (e.person === 'Person2' ? state.settings.person2Name : 'Both');
      return `${who}: ₹${e.amount} on ${e.category} (${e.note || 'no note'})`;
    }).join('\n');

    const prompt = `CONTEXT: Financial roast for a couple: ${state.settings.person1Name} and ${state.settings.person2Name}.
      DATA: Last 20 expenses: ${recent}
      INSTRUCTION: Be savage, hilarious, and brutal. Roast their spending habits based ONLY on the data provided. 
      Limit to 350 characters. Plain text only. Use 🔥 emojis.`;

    const response = await ai.models.generateContent({ 
      model: 'gemini-3-flash-preview', 
      contents: prompt 
    });

    return response.text?.trim() || "You spend money so boringly I have nothing to say.";
  } catch (error) { 
    return "Your spending is so chaotic it broke my circuits. Get help."; 
  }
};

export const getLatestMetalRates = async (): Promise<{gold: number, silver: number, source?: string, sources?: any[]}> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: "Output JSON only: { \"gold\": number, \"silver\": number } for current 24k gold and silver prices per gram in India in INR.",
      config: { tools: [{googleSearch: {}}] }
    });
    
    const text = response.text || "";
    // Extract grounding sources as required by guidelines for googleSearch tool
    const groundingSources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    try {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}') + 1;
      const data = JSON.parse(text.slice(start, end));
      return { 
        gold: Number(data.gold) || 7200, 
        silver: Number(data.silver) || 90, 
        source: 'Live',
        sources: groundingSources
      };
    } catch (e) { return { gold: 7300, silver: 92, source: 'Fallback', sources: groundingSources }; }
  } catch (error) { return { gold: 7300, silver: 92, source: 'Offline' }; }
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
          { text: "Extract expense details. Return JSON." }
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
    const prompt = `Parse this expense: "${text}". Names: ${person1Name}, ${person2Name}. Return JSON.`;
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
