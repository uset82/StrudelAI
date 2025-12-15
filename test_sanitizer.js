const coerceLooseLines = (src) => {
    const lines = src.split(/\n+/).map(l => l.trim()).filter(Boolean);
    if (lines.length <= 1) return src;
    if (/[{;]|\b(const|let|var|function|class|return|if|for|while|=>)\b/.test(src)) {
        return src;
    }
    const isPlainExpr = (l) => /^(note\(|s\(|stack\(|silence|sound\(|sample\(|n\(|m\()/i.test(l);
    if (lines.every(isPlainExpr)) {
        return `stack(${ lines.join(', ') })`;
    }
    return src;
};

const balanceDelimiters = (src) => {
    let openParens = 0;
    let openBrackets = 0;
    for (const ch of src) {
        if (ch === '(') openParens++;
        else if (ch === ')') openParens = Math.max(0, openParens - 1);
        else if (ch === '[') openBrackets++;
        else if (ch === ']') openBrackets = Math.max(0, openBrackets - 1);
    }
    let balanced = src;
    if (openParens > 0) {
        balanced += ')'.repeat(openParens);
    }
    if (openBrackets > 0) {
        balanced += ']'.repeat(openBrackets);
    }
    return balanced;
};

// Test cases for vowel sanitization
const testCases = [
    { input: '.vowel("a")', expected: '.vowel("a")' },
    { input: '.vowel("zorro")', expected: '.vowel("o")' }, // Fallback to 'o' or 'a'
    { input: '.vowel("a e i o u")', expected: '.vowel("a e i o u")' }, // Sequence
    { input: '.vowel("<a e> i")', expected: '.vowel("<a e> i")' }, // Mini-notation
    { input: '.vowel("robot")', expected: '.vowel("o")' }, // Invalid word
    { input: '.vowel("a zorro u")', expected: '.vowel("a o u")' }, // Mixed valid/invalid
    { input: '.vowel("  a   e  ")', expected: '.vowel("a e")' }, // Whitespace
];

const sanitizeGeneratedCode = (input) => {
    let output = input;

    // Remove markdown bullets or stray list markers the model sometimes emits
    output = output.replace(/^\s*[-*]\s+/gm, '');

    // Remove .bank() calls (samples not available)
    output = output.replace(/\.bank\([^)]*\)/g, '');
    // Remove slider() calls (not available)
    output = output.replace(/\.slider\([^)]*\)/g, '');
    // Remove ._pianoroll() calls (not available)
    output = output.replace(/\._pianoroll\([^)]*\)/g, '');
    // Strip analyze() which is forbidden in this environment
    output = output.replace(/\.analyze\([^)]*\)/gi, '');
    output = output.replace(/\banalyze\([^)]*\)/gi, '');
    // Strip tempo helpers that frequently break parsing (model still tries to add them)
    output = output.replace(/\bcpm\([^)]*\)/gi, '');
    output = output.replace(/\.cpm\([^)]*\)/gi, '');
    output = output.replace(/setcpm\([^)]*\)/gi, '');
    
    // Normalize vowel arguments to valid vowels
    // Allow sequences but filter out invalid words
    output = output.replace(/\.vowel\(\s*(["'`]) ([^"'`]+)\1\s*\)/gi, (_match, quote, content) => {
        // Replace any word-like token that isn't a vowel with 'a' (or 'o' if it looks like one?)
        // Actually, let's just default to 'a' for simplicity, or try to map.
        // But for "zorro", "o" is better.
        
        const cleanContent = content.replace(/[a-z]+/gi, (token) => {
    if (/^[aeiou]$/i.test(token)) return token.toLowerCase();
    // If invalid, try to find a vowel inside, else 'a'
    const match = token.match(/[aeiou]/i);
    return match ? match[0].toLowerCase() : 'a';
});

// Clean up multiple spaces
return `.vowel("${cleanContent.replace(/\s+/g, ' ').trim()}")`;
    });

// Fix mini-notation strings that start with "(" which breaks the mini parser
output = output.replace(/m\(\s*["'`]\(([^"'`]+)["'`]\s*\)/gi, (_match, inner) => {
    return `m("${inner}")`;
});

// Clean up dangling commas left by removals
output = output.replace(/,\s*(?=[\)\}])/g, '');

output = coerceLooseLines(output.trim());

// Fix run-on code: "stack(...))stack(...)" -> "stack(...))"
const runOnMatch = output.match(/\)\s*(stack|note|s|sound|n|seq|cat)\(/);
if (runOnMatch && runOnMatch.index) {
    console.log('[API/Agent] Detected run-on code, truncating...');
    output = output.substring(0, runOnMatch.index + 1);
}

return balanceDelimiters(output);
};

console.log('--- Running Sanitizer Tests ---');
testCases.forEach(({ input }, i) => {
    const result = sanitizeGeneratedCode(input);
    console.log(`Test ${i + 1}:`);
    console.log(`Input:    ${input}`);
    console.log(`Output:   ${result}`);
    // console.log(`Expected: ${expected}`);
    console.log('-----------------------------');
});
