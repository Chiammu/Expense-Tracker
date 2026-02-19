import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';

// Rate limiting: Simple in-memory store (use Redis/Upstash in production)
const requestCounts = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMIT = 30; // 30 requests per minute
const WINDOW_MS = 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const userLimit = requestCounts.get(ip);

  if (!userLimit || now > userLimit.resetTime) {
    requestCounts.set(ip, { count: 1, resetTime: now + WINDOW_MS });
    return true;
  }

  if (userLimit.count >= RATE_LIMIT) {
    return false;
  }

  userLimit.count++;
  return true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket?.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Try again in a minute.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY not configured');
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const { action, payload } = req.body;

    if (!action) {
      return res.status(400).json({ error: 'Action is required' });
    }

    const ai = new GoogleGenAI({ apiKey });

    switch (action) {
      case 'chat': {
        const { history, userMessage, systemInstruction } = payload;
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [...history, { role: 'user', parts: [{ text: userMessage }] }],
          config: {
            systemInstruction
          }
        });
        return res.json({ text: response.text || "I didn't catch that." });
      }

      case 'strategy': {
        const { prompt } = payload;
        const response = await ai.models.generateContent({
          model: 'gemini-3-pro-preview',
          contents: prompt,
          config: {
            thinkingConfig: { thinkingBudget: 32768 }
          }
        });
        return res.json({ text: response.text || "Strategy generation failed." });
      }

      case 'insights': {
        const { prompt } = payload;
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: prompt
        });
        return res.json({ text: response.text || "No insights generated." });
      }

      case 'roast': {
        const { prompt } = payload;
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: prompt
        });
        return res.json({ text: response.text?.trim() || "You spend money so boringly I have nothing to say." });
      }

      case 'metalRates': {
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: "Output JSON only: { \"gold\": number, \"silver\": number } for current 24k gold and silver prices per gram in India in INR.",
          config: { tools: [{ googleSearch: {} }] }
        });
        const text = response.text || "";
        try {
          const start = text.indexOf('{');
          const end = text.lastIndexOf('}') + 1;
          const data = JSON.parse(text.slice(start, end));
          return res.json({ gold: Number(data.gold) || 7300, silver: Number(data.silver) || 92, source: 'Live' });
        } catch (e) {
          return res.json({ gold: 7300, silver: 92, source: 'Fallback' });
        }
      }

      case 'parseReceipt': {
        const { base64Image } = payload;
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
        return res.json(JSON.parse(response.text || '{}'));
      }

      case 'parseNLP': {
        const { text, person1Name, person2Name } = payload;
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
        return res.json(JSON.parse(response.text || '{}'));
      }

      case 'parseStatementText': {
        const { prompt } = payload;
        const response = await ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: prompt,
          config: {
            responseMimeType: "application/json"
          }
        });
        const text = response.text || "[]";
        try {
          return res.json(JSON.parse(text));
        } catch (e) {
          const start = text.indexOf('[');
          const end = text.lastIndexOf(']') + 1;
          if (start !== -1 && end !== -1) {
            return res.json(JSON.parse(text.slice(start, end)));
          }
          return res.json([]);
        }
      }

      default:
        return res.status(400).json({ error: 'Unknown action' });
    }
  } catch (error: any) {
    console.error('Gemini API Error:', error);
    const msg = error.toString().toLowerCase() + (error.message || "").toLowerCase();
    if (msg.includes("429") || msg.includes("quota")) {
      return res.status(429).json({ error: "AI quota exhausted. Try again later." });
    }
    return res.status(500).json({ error: error.message || "AI request failed" });
  }
}
