import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import {
    OPENROUTER_API_KEY,
    OPENROUTER_HEADERS,
    OPENROUTER_TIMEOUT_MS,
    getOpenRouterModelCandidates,
} from '@/lib/ai/openrouter-config';

const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: OPENROUTER_API_KEY,
    timeout: OPENROUTER_TIMEOUT_MS,
    maxRetries: 0,
    defaultHeaders: OPENROUTER_HEADERS,
});

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonWithCors(data: unknown, init: ResponseInit = {}) {
    return NextResponse.json(data, { ...init, headers: corsHeaders });
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: Request) {
    try {
        const { code, cursorPosition } = await req.json();

        if (!code) {
            return jsonWithCors({ completion: '' });
        }

        console.log('[Complete API] Request:', { codeLength: code.length, cursorPosition });

        // Get code before and after cursor
        const beforeCursor = code.substring(0, cursorPosition);

        // Take only the last few lines for context to save tokens and focus attention
        const recentContext = beforeCursor.split('\n').slice(-5).join('\n');

        const prompt = `Complete this Strudel music code.
Context: ${recentContext}
Next chars:`;

        let response;
        let lastError: unknown;
        for (const model of getOpenRouterModelCandidates()) {
            try {
                console.log('[Complete API] Prompting model:', model);
                response = await openai.chat.completions.create({
                    model,
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 15, // Very short completion
                    temperature: 0.1, // Extremely deterministic
                    stop: ['\n', ';', ')', '  '], // Stop immediately at boundaries
                    presence_penalty: 0.0,
                    frequency_penalty: 0.5, // Discourage repetition
                });
                break;
            } catch (err) {
                lastError = err;
                console.warn(`[Complete API] Model failed (${model})`, err);
            }
        }

        if (!response) {
            throw lastError || new Error('No OpenRouter model returned a completion');
        }

        const completion = response.choices[0]?.message?.content || '';
        console.log('[Complete API] Raw completion:', completion);

        // Clean up the completion
        let cleaned = completion
            .replace(/^```.*\n?/gm, '')  // Remove code fences
            .replace(/\n```$/gm, '')
            .replace(/^Completion:/i, '') // Remove "Completion:" prefix if present
            .trim();

        // If the model repeated the last part of the input, remove it
        const lastWord = recentContext.trim().split(/[\s(.]+/).pop() || '';
        if (lastWord && cleaned.startsWith(lastWord)) {
            cleaned = cleaned.substring(lastWord.length);
        }

        console.log('[Complete API] Cleaned completion:', cleaned);

        return jsonWithCors({ completion: cleaned });
    } catch (error: unknown) {
        console.error('[Complete API] Error:', error);
        const message = error instanceof Error ? error.message : String(error);
        return jsonWithCors({ completion: '', error: message }, { status: 500 });
    }
}
