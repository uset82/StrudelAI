import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY || '',
    defaultHeaders: {
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'Aether Sonic',
    },
});

const MODEL_NAME = process.env.MODEL_NAME || 'x-ai/grok-4.1-fast';

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

        console.log('[Complete API] Prompting model:', MODEL_NAME);

        const response = await openai.chat.completions.create({
            model: MODEL_NAME,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 15, // Very short completion
            temperature: 0.1, // Extremely deterministic
            stop: ['\n', ';', ')', '  '], // Stop immediately at boundaries
            presence_penalty: 0.0,
            frequency_penalty: 0.5, // Discourage repetition
        });

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
