import OpenAI from 'openai';

// API key must be set via environment variable
if (!process.env.OPENROUTER_API_KEY) {
    console.warn('OPENROUTER_API_KEY is not defined - AI features will not work');
}

const openRouterTimeoutMs = Number(process.env.OPENROUTER_TIMEOUT_MS || 20000);

export const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY || '',
    timeout: Number.isFinite(openRouterTimeoutMs) ? openRouterTimeoutMs : 20000,
    maxRetries: 0,
    defaultHeaders: {
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'Aether Sonic',
    },
});

export const MODEL_NAME = process.env.MODEL_NAME || 'moonshotai/kimi-k2.6:free';
