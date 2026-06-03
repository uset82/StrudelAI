import OpenAI from 'openai';
import {
    OPENROUTER_API_KEY,
    OPENROUTER_HEADERS,
    OPENROUTER_MODEL,
    OPENROUTER_TIMEOUT_MS,
} from './openrouter-config';

// API key must be set via environment variable
if (!OPENROUTER_API_KEY) {
    console.warn('OPENROUTER_API_KEY is not defined - AI features will not work');
}

export const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: OPENROUTER_API_KEY,
    timeout: OPENROUTER_TIMEOUT_MS,
    maxRetries: 0,
    defaultHeaders: OPENROUTER_HEADERS,
});

export const MODEL_NAME = OPENROUTER_MODEL;
