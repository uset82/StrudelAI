const BLOCKED_FIGURES = [
    'trump',
    'obama',
    'biden',
    'musk',
    'elon',
    'swift',
    'taylor swift',
    'putin',
    'harris',
    'kamala',
    'eminem',
    'celebrity',
    'president',
    'politician'
];

export interface SafetyCheckResult {
    approved: boolean;
    reason?: string;
}

/**
 * Validates text or prompt prompts to prevent voice cloning abuse.
 */
export function checkVoiceSafety(prompt: string, text?: string): SafetyCheckResult {
    const combinedText = `${prompt} ${text || ''}`.toLowerCase();

    // Check for explicit "impersonate" or "clone" keywords followed by specific names
    const hasCloningIntent = /\b(clone|impersonate|mimic|sound\s+like|voice\s+of)\b/i.test(combinedText);

    if (hasCloningIntent) {
        for (const name of BLOCKED_FIGURES) {
            if (combinedText.includes(name)) {
                return {
                    approved: false,
                    reason: `Voice cloning or impersonation of public figure "${name}" is blocked for safety and ethical reasons.`
                };
            }
        }
    }

    // Check general impersonation flags
    if (/\b(clone\s+my\s+friend|impersonate\s+my\s+boss|unauthorized\s+clone)\b/i.test(combinedText)) {
        return {
            approved: false,
            reason: 'Unauthorized cloning of private individuals without explicit consent is blocked.'
        };
    }

    return { approved: true };
}
