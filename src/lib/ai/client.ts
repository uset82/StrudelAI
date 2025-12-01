import OpenAI from 'openai';

// if (!process.env.OPENROUTER_API_KEY) {
//     throw new Error('OPENROUTER_API_KEY is not defined');
// }

export const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY || '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',
    defaultHeaders: {
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'Aether Sonic',
    },
});

export const MODEL_NAME = process.env.MODEL_NAME || 'x-ai/grok-4.1-fast';

