import OpenAI from 'openai';

const client = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: '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',
    defaultHeaders: {
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Aether Sonic Interface',
    },
});

async function main() {
    console.log('Testing OpenRouter API...');
    try {
        const completion = await client.chat.completions.create({
            model: 'google/gemini-2.0-flash-exp:free',
            messages: [
                { role: 'user', content: 'Say "API Working" if you can hear me.' }
            ],
        });

        console.log('Response:', completion.choices[0].message.content);
        console.log('SUCCESS: API is working.');
    } catch (error) {
        console.error('ERROR: API test failed:', error);
    }
}

main();
