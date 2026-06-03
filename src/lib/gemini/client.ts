import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GOOGLE_API_KEY || '';

if (!apiKey) {
    console.error('GOOGLE_API_KEY is not set');
}

export const genAI = new GoogleGenerativeAI(apiKey);
export const MODEL_NAME = 'gemini-2.0-flash-exp'; // Using the latest fast model
