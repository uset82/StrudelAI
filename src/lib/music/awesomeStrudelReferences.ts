import awesomeStrudelRaw from '../../../training_data/awesome_strudel_sanitized.json';

export type AwesomeStrudelReference = {
    id: string;
    title: string;
    artist: string;
    prompt: string;
    bpm: number;
    key: string;
    scale: string;
    thought: string;
    tracks: Record<string, string | null>;
};

export const AWESOME_STRUDEL_REFERENCES = awesomeStrudelRaw as AwesomeStrudelReference[];

const tokenize = (value: string) =>
    value
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean);

function summarizeTrack(code: string | null) {
    if (!code || code === 'silence') return null;
    const lowered = code.toLowerCase();
    const traits = [
        /\bbd\b|rolandtr|kick/i.test(code) ? 'drums' : null,
        /\bbass|[a-g](?:#|b)?[01]\b/i.test(code) ? 'bass' : null,
        /sawtooth|square|supersaw|lead/i.test(code) ? 'synth lead' : null,
        /piano|chord|voicing/i.test(code) ? 'chords' : null,
        /room|delay|reverb/i.test(code) ? 'space FX' : null,
        /arrange|cat|pickrestart|mask/i.test(lowered) ? 'arranged sections' : null,
    ].filter(Boolean);
    return traits.length ? traits.join(', ') : 'musical pattern';
}

export function getRelevantAwesomeStrudelReferences(prompt: string, limit = 2) {
    const promptTokens = new Set(tokenize(prompt));
    return AWESOME_STRUDEL_REFERENCES
        .map((reference) => {
            let score = 0;
            for (const token of tokenize(`${reference.id} ${reference.title} ${reference.artist} ${reference.prompt}`)) {
                if (promptTokens.has(token)) score += 2;
            }
            if (reference.prompt.toLowerCase().includes(prompt.toLowerCase())) score += 4;
            return { reference, score };
        })
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((item) => item.reference);
}

export function formatAwesomeStrudelReferencesForPrompt(prompt: string, limit = 2) {
    const references = getRelevantAwesomeStrudelReferences(prompt, limit);
    if (references.length === 0) return '';

    const lines = ['## AWESOME STRUDEL SOURCE REFERENCES'];
    lines.push('Use these as musical reference traits only. Do not copy full song code or unsupported helper-heavy scripts.');
    for (const reference of references) {
        const trackTraits = Object.entries(reference.tracks)
            .map(([trackId, code]) => {
                const summary = summarizeTrack(code);
                return summary ? `${trackId}: ${summary}` : null;
            })
            .filter(Boolean)
            .join('; ');
        lines.push(`${reference.title} (${reference.artist})`);
        lines.push(`Prompt: ${reference.prompt}`);
        lines.push(`BPM/key: ${reference.bpm}, ${reference.key}`);
        lines.push(`Reference traits: ${trackTraits || 'arranged Strudel song form'}.`);
    }
    return lines.join('\n');
}
