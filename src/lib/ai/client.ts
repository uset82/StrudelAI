import OpenAI from 'openai';

// API key must be set via environment variable
if (!process.env.OPENROUTER_API_KEY) {
    console.warn('OPENROUTER_API_KEY is not defined - AI features will not work');
}

export const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY || '',
    defaultHeaders: {
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'Aether Sonic',
    },
});

export const MODEL_NAME = process.env.MODEL_NAME || 'google/gemini-2.0-flash-exp:free';

