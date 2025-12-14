import { GoogleGenAI, Type } from "@google/genai";
import { AppState, Expense } from "../types";

// Helper to format currency
const formatCurrency = (amount: number) => {
  return '₹' + amount.toFixed(2);
};

const getAI = () => {
  // The key is injected by Vite at build time via vite.config.ts
  const apiKey = process.env.API_KEY;
  
  // Debug log (Safe: only logs length or start)
  console.log("Gemini Service Init. Key present:", !!apiKey, "Length:", apiKey?.length);

  if (!apiKey) {
    console.error("CRITICAL ERROR: API Key is missing in the build.");
    throw new Error("API Key is missing. Please check Vercel Environment Variables (GEMINI_API_KEY) and redeploy.");
  }
  return new GoogleGenAI({ apiKey });
};

// Error Helper
const handleGeminiError = (error: any) => {
  console.error("Gemini API Error details:", error);
  const msg = error.toString().toLowerCase() + (error.message || "").toLowerCase();
  
  if (msg.includes("429") || msg.includes("quota") || msg.includes("resource_exhausted")) {
    return "⚠️ Daily Limit Reached. Please try again tomorrow.";
  }
  if (msg.includes("api key")) {
    return "⚠️ Configuration Error: API Key missing.";
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
    const monthlyBudget = state.monthlyBudget;

    const summaryText = `
      Total Expenses: ${formatCurrency(totalExpenses)}
      Total Income: ${formatCurrency(totalIncome)}
      Monthly Budget: ${formatCurrency(monthlyBudget)}
      
      Spending by Person:
      - ${state.settings.person1Name}: ${formatCurrency(person1Total)}
      - ${state.settings.person2Name}: ${formatCurrency(person2Total)}
      - Shared: ${formatCurrency(sharedTotal)}

      Top Categories: ${JSON.stringify(categoryBreakdown)}
      
      Fixed Payments Count: ${state.fixedPayments.length}
    `;

    const prompt = `
      You are a friendly and encouraging financial advisor for a couple.
      Analyze the following financial summary for the current period.
      
      ${summaryText}

      Provide 3-4 distinct, actionable, and short insights or tips.
      - Focus on savings potential if they are under budget.
      - Gently warn if they are over budget or specific categories are high.
      - Be specifically personalized using their names (${state.settings.person1Name} and ${state.settings.person2Name}).
      - Use emojis to make it engaging.
      - Do NOT use markdown formatting like bold or headers, just plain text with emojis and newlines.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "No insights generated.";

  } catch (error: any) {
    return handleGeminiError(error);
  }
};

// ------------------------------------------------------------------
// NEW FEATURES
// ------------------------------------------------------------------

export const suggestSmartBudget = async (state: AppState): Promise<{totalBudget: number, categoryBudgets: Record<string, number>}> => {
    // Deprecated functionality, kept stub for type safety if imported elsewhere, but logic removed per request.
    return {totalBudget: 0, categoryBudgets: {}};
};

export const roastSpending = async (state: AppState): Promise<string> => {
  try {
    const ai = getAI();
    const recentExpenses = state.expenses.slice(-15).map(e => `${e.category}: ${e.amount} (${e.note})`).join(', ');
    
    const prompt = `
      You are a savage, funny stand-up comedian roasting a couple's finances.
      Here are their recent expenses: ${recentExpenses}.
      
      Give them a short, spicy, hilarious roast about their spending habits. 
      Make fun of specific purchases if they look silly. 
      Keep it under 280 characters like a tweet. 
      Names: ${state.settings.person1Name} & ${state.settings.person2Name}.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    return response.text || "You guys are spending so boringly I can't even roast you.";
  } catch (error) {
    // Return the friendly error message directly as the roast text
    return handleGeminiError(error);
  }
};

export const parseReceiptImage = async (base64Image: string): Promise<Partial<Expense>> => {
  try {
    const ai = getAI();
    // Remove data URL prefix if present for API
    const base64Data = base64Image.split(',')[1] || base64Image;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
          { text: "Extract the following details from this receipt: Total Amount, Date (YYYY-MM-DD), Category (Groceries, Food, Shopping, Travel, Medical, etc.), Merchant/Description. Return JSON." }
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
  } catch (error) {
    console.error("Receipt Scanning Error:", error);
    throw error;
  }
};

export const parseNaturalLanguageExpense = async (text: string, person1Name: string, person2Name: string): Promise<Partial<Expense>> => {
  try {
    const ai = getAI();
    const prompt = `
      Parse this expense text into JSON: "${text}". 
      Today is ${new Date().toISOString().split('T')[0]}. 
      
      Rules for "person":
      - Person1 Name: "${person1Name}" -> Set person to "Person1"
      - Person2 Name: "${person2Name}" -> Set person to "Person2"
      - If text implies shared or both, set person to "Both"
      - If ambiguous, do not set person.

      Categories: Groceries, Rent, Bills, EMIs, Shopping, Travel, Food, Entertainment, Medical, Education, Investments, Others.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
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
  } catch (error) {
    console.error("NLP Error:", error);
    throw error;
  }
};

export const chatWithFinances = async (history: {role: string, content: string}[], userMessage: string, state: AppState): Promise<string> => {
  try {
    const ai = getAI();
    
    // Provide context
    const context = `
      Context:
      Current Date: ${new Date().toLocaleDateString()}
      Total Expenses: ${state.expenses.reduce((s,e) => s + e.amount, 0)}
      Expenses: ${JSON.stringify(state.expenses.slice(-20))} (Last 20)
      Names: ${state.settings.person1Name}, ${state.settings.person2Name}
    `;

    // Simple one-shot chat for now to keep it stateless in service
    const prompt = `
      ${context}
      
      User: ${userMessage}
      
      Answer as a helpful financial assistant. Keep it brief.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "I didn't catch that.";
  } catch (error: any) {
    return handleGeminiError(error);
  }
};