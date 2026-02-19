import { GoogleGenAI } from "@google/genai";

export const config = {
    runtime: 'edge',
};

export default async function handler(req: Request) {
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const { history, userMessage, prompt, task, systemInstruction, tools, model, generationConfig, contents } = await req.json();
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return new Response(JSON.stringify({ error: 'Server configuration error: API Key missing' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const ai = new GoogleGenAI({ apiKey });
        const targetModel = model || 'gemini-1.5-flash';

        if (task === 'chat') {
            const genModel = (ai as any).getGenerativeModel({
                model: targetModel,
                systemInstruction: systemInstruction,
                tools: tools,
                generationConfig: generationConfig
            });

            const chat = genModel.startChat({
                history: history || [],
            });

            const result = await chat.sendMessage(userMessage);
            const response = await result.response;

            return new Response(JSON.stringify({
                text: response.text(),
                candidates: response.candidates,
                functionCalls: response.functionCalls()
            }), {
                headers: { 'Content-Type': 'application/json' }
            });

        } else if (task === 'generate') {
            const genModel = (ai as any).getGenerativeModel({
                model: targetModel,
                systemInstruction: systemInstruction,
                tools: tools,
                generationConfig: generationConfig
            });

            // 'contents' can be used for multi-modal inputs (images + text)
            // 'prompt' is for simple text
            const input = contents ? contents : prompt;

            const result = await genModel.generateContent(input);

            return new Response(JSON.stringify({
                text: result.response.text(),
                candidates: result.response.candidates
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response('Invalid task', { status: 400 });

    } catch (error: any) {
        console.error('Gemini API Error:', error);
        return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
