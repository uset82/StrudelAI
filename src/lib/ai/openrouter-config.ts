type NetlifyRuntime = typeof globalThis & {
    Netlify?: {
        env?: {
            get?: (name: string) => string | undefined;
        };
    };
};

const DEFAULT_OPENROUTER_MODEL = 'nex-agi/nex-n2-pro:free';
const DEFAULT_OPENROUTER_FALLBACK_MODELS = [
    'nex-agi/deepseek-v3.1-nex-n1:free',
    'google/gemini-2.0-flash-exp:free',
];

export function getServerEnv(name: string) {
    const netlifyValue = (globalThis as NetlifyRuntime).Netlify?.env?.get?.(name);
    return (netlifyValue || process.env[name] || '').trim();
}

export const OPENROUTER_API_KEY =
    getServerEnv('OPENROUTER_API_KEY') ||
    getServerEnv('OPENROUTER_KEY');

export const OPENROUTER_TIMEOUT_MS = (() => {
    const raw = Number(getServerEnv('OPENROUTER_TIMEOUT_MS') || 15000);
    return Number.isFinite(raw) ? raw : 15000;
})();

export const OPENROUTER_MODEL =
    getServerEnv('OPENROUTER_MODEL') ||
    getServerEnv('MODEL_NAME') ||
    DEFAULT_OPENROUTER_MODEL;

export function getOpenRouterModelCandidates() {
    const configuredFallbacks = getServerEnv('OPENROUTER_FALLBACK_MODELS')
        .split(',')
        .map((model) => model.trim())
        .filter(Boolean);

    const candidates = [
        OPENROUTER_MODEL,
        ...(configuredFallbacks.length > 0 ? configuredFallbacks : DEFAULT_OPENROUTER_FALLBACK_MODELS),
    ];

    return Array.from(new Set(candidates));
}

export const OPENROUTER_HEADERS = {
    'HTTP-Referer':
        getServerEnv('NEXT_PUBLIC_APP_URL') ||
        getServerEnv('URL') ||
        getServerEnv('DEPLOY_URL') ||
        'http://localhost:3000',
    'X-Title': 'Aether Sonic',
};
