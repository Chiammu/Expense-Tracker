import { AppState, Expense, ParsedTransaction } from "../types";

import { GoogleGenerativeAI, Part } from "@google/generative-ai";
import { AppState, Expense } from "../types";

// Initialize Gemini API
const API_KEY = (import.meta as any).env.VITE_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

const getModel = (modelName: string = "gemini-1.5-flash") => {
  return genAI.getGenerativeModel({ model: modelName });
};

const handleGeminiError = (error: any) => {
  console.error("Gemini API Error details:", error);
  const msg = error.toString().toLowerCase();
  if (msg.includes("429") || msg.includes("quota")) {
    return "⚠️ AI is exhausted. Try again later.";
  }
  return `⚠️ AI Error: ${error.message || "Connection failed"}`;
};

// Tool definition for adding expenses
// Note: Client-side function calling with Gemini SDK usually returns the function call request, 
// which valid client code would then execute.
// For this app, we are just getting the structured response to parse.

const addExpenseTool = {
  functionDeclarations: [{
    name: 'add_expense',
    description: 'Add a new expense to the financial tracker.',
    parameters: {
      type: 'OBJECT',
      properties: {
        amount: { type: 'NUMBER', description: 'The monetary amount.' },
        category: { type: 'STRING', description: 'Category (Groceries, Rent, Food, etc.).' },
        person: { type: 'STRING', enum: ['Person1', 'Person2', 'Both'], description: 'Who paid.' },
        note: { type: 'STRING', description: 'Brief description.' },
        date: { type: 'STRING', description: 'Date in YYYY-MM-DD.' }
      },
      required: ['amount', 'category', 'person']
    }
  }]
};

  return response.json();
}

export const chatWithFinances = async (
  history: any[],
  userMessage: string,
  state: AppState
): Promise<{ text: string; toolCall?: any }> => {
  try {
    const model = getModel("gemini-1.5-flash");

    const systemInstruction = `You are a financial assistant for a couple: ${state.settings.person1Name} and ${state.settings.person2Name}. 
    Available categories: ${state.settings.customCategories.join(', ')}.
    Context: Current month spending is ₹${state.expenses.reduce((s, e) => s + e.amount, 0)}.`;

    const chat = model.startChat({
      history: history.map(h => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.parts[0].text }]
      })),
      systemInstruction: { role: 'system', parts: [{ text: systemInstruction }] },
      generationConfig: {
        tools: [addExpenseTool]
      } as any // Casting to any to avoid strict typing issues with tools in some SDK versions
    });

    const result = await chat.sendMessage(userMessage);
    const response = result.response;
    const text = response.text();

    // Check for function calls
    // In SDK, function calls are in response.functionCalls() array
    const functionCalls = response.functionCalls();
    const toolCall = functionCalls && functionCalls.length > 0 ? functionCalls[0] : undefined;

    return {
      text: text || (toolCall ? "Processing your request..." : "I didn't catch that."),
      toolCall: toolCall
    };
  } catch (error: any) {
    return { text: handleGeminiError(error) };
  }
};

export const getDeepFinancialStrategy = async (state: AppState): Promise<string> => {
  try {
    const model = getModel("gemini-1.5-pro");
    const prompt = `Analyze the full financial state:
    Assets: ₹${(state.investments.bankBalance.p1 + state.investments.bankBalance.p2 + state.investments.mutualFunds.shared + state.investments.stocks.shared)}
    Liabilities: ₹${state.loans.reduce((s, l) => s + l.pendingAmount, 0)}
    Monthly Budget: ₹${state.monthlyBudget}
    
    Provide a 10-year growth projection and a debt-payoff strategy. Use "Think Step-by-Step" reasoning.`;

    const result = await model.generateContent(prompt);
    return result.response.text() || "Strategy generation failed.";
  } catch (error: any) {
    return handleGeminiError(error);
  }
};

export const predictNextMonthSpending = async (state: AppState): Promise<string> => {
  try {
    const model = getModel("gemini-1.5-flash");
    const history = state.expenses.slice(-100).map(e => ({ d: e.date, a: e.amount, c: e.category }));
    const fixed = state.fixedPayments.map(p => ({ n: p.name, a: p.amount }));

    const prompt = `Based on historical data: ${JSON.stringify(history)} 
    And fixed bills: ${JSON.stringify(fixed)}
    Predict next month's spending. Look for seasonal trends or recurring spikes. 
    Format: "Estimated: ₹[Amount]. Reason: [One sentence prediction]."`;

    const result = await model.generateContent(prompt);
    return result.response.text() || "Prediction unavailable.";
  } catch (error) {
    return "Spending prediction failed.";
  }
};

export const generateFinancialInsights = async (state: AppState): Promise<string> => {
  try {
    const model = getModel("gemini-1.5-flash");
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

    const result = await model.generateContent(prompt);
    return result.response.text() || "No insights generated.";
  } catch (error: any) {
    return handleGeminiError(error);
  }
};

export const generateMonthlyDigest = async (state: AppState): Promise<string> => {
  try {
    const model = getModel("gemini-1.5-flash");
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

    const result = await model.generateContent(prompt);
    return result.response.text() || "Digest failed to generate.";
  } catch (error) {
    return handleGeminiError(error);
  }
};

export const roastSpending = async (state: AppState): Promise<string> => {
  try {
    const model = getModel("gemini-1.5-flash");
    const recent = state.expenses.slice(-20).map(e => {
      const who = e.person === 'Person1' ? state.settings.person1Name : (e.person === 'Person2' ? state.settings.person2Name : 'Both');
      return `${who}: ₹${e.amount} on ${e.category} (${e.note || 'no note'})`;
    }).join('\n');

    const prompt = `CONTEXT: Financial roast for a couple: ${state.settings.person1Name} and ${state.settings.person2Name}.
      DATA: Last 20 expenses: ${recent}
      INSTRUCTION: Be savage, hilarious, and brutal. Roast their spending habits based ONLY on the data provided. 
      Limit to 350 characters. Plain text only. Use 🔥 emojis.`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim() || "You spend money so boringly I have nothing to say.";
  } catch (error) {
    return "Your spending is so chaotic it broke my circuits. Get help.";
  }
};

export const getLatestMetalRates = async (): Promise<{ gold: number; silver: number; source?: string }> => {
  try {
    const model = getModel("gemini-1.5-flash");
    // Google Search tool is not standard in the basic SDK call without specific setup, 
    // but assuming standard generation for now or if supported by the model config.
    // For safety, we'll prompt for JSON.
    const prompt = "Output JSON only: { \"gold\": number, \"silver\": number } for current 24k gold and silver prices per gram in India in INR.";

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    try {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}') + 1;
      const data = JSON.parse(text.slice(start, end));
      return { gold: Number(data.gold) || 7200, silver: Number(data.silver) || 90, source: 'Live' };
    } catch (e) { return { gold: 7300, silver: 92, source: 'Fallback' }; }
  } catch (error) { return { gold: 7300, silver: 92, source: 'Offline' }; }
};

export const parseReceiptImage = async (base64Image: string): Promise<Partial<Expense>> => {
  try {
    const model = getModel("gemini-1.5-flash");
    const base64Data = base64Image.split(',')[1] || base64Image;

    const result = await model.generateContent({
      contents: [
        {
          role: 'user', parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
            { text: "Extract expense details. Return JSON." }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: 'OBJECT' as any, // explicit cast
          properties: {
            amount: { type: 'NUMBER' as any },
            date: { type: 'STRING' as any },
            category: { type: 'STRING' as any },
            note: { type: 'STRING' as any }
          }
        }
      }
    });

    return JSON.parse(result.response.text() || '{}');
  } catch (error) { throw error; }
};

export const parseNaturalLanguageExpense = async (
  text: string,
  person1Name: string,
  person2Name: string
): Promise<Partial<Expense>> => {
  try {
    const model = getModel("gemini-1.5-flash");
    const prompt = `Parse this expense: "${text}". Names: ${person1Name}, ${person2Name}. Return JSON.`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: 'OBJECT' as any,
          properties: {
            amount: { type: 'NUMBER' as any },
            date: { type: 'STRING' as any },
            category: { type: 'STRING' as any },
            paymentMode: { type: 'STRING' as any },
            note: { type: 'STRING' as any },
            person: { type: 'STRING' as any, enum: ["Person1", "Person2", "Both"] }
          }
        }
      }
    });

    return JSON.parse(result.response.text() || '{}');
  } catch (error) { throw error; }
};
