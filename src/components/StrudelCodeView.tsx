'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { SonicSessionState } from '@/types/sonic';
import { evalStrudelCode, formatStrudelDisplayCode } from '@/lib/strudel/engine';

interface StrudelCodeViewProps {
    code?: string;
    tracks?: SonicSessionState['tracks'];
    isConnected?: boolean;
    onCodeChange?: (code: string) => void;
    onRun?: (code: string) => void;
}

function resolveApiBaseUrl() {
    const fallback = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    if (typeof window === 'undefined') {
        return fallback;
    }

    try {
        const current = new URL(window.location.href);
        const envUrl = process.env.NEXT_PUBLIC_APP_URL ? new URL(process.env.NEXT_PUBLIC_APP_URL) : null;
        const isHttp = current.protocol === 'http:' || current.protocol === 'https:';

        if (!isHttp) {
            if (envUrl) {
                return envUrl.origin;
            }
            console.warn('[StrudelCodeView] Non-HTTP origin detected, defaulting to localhost:3000 for API.');
            return 'http://localhost:3000';
        }

        if (envUrl) {
            if (envUrl.host !== current.host) {
                console.warn('[StrudelCodeView] NEXT_PUBLIC_APP_URL differs from current host. Using window location.');
                return current.origin;
            }
            return envUrl.origin;
        }

        return current.origin;
    } catch (err) {
        console.warn('[StrudelCodeView] Invalid API URL, falling back to env/default.', err);
        return fallback;
    }
}

function resolveApiUrl(path: string) {
    const base = resolveApiBaseUrl();
    try {
        return new URL(path, base).toString();
    } catch {
        return path;
    }
}

export function StrudelCodeView({ code, isConnected, onCodeChange, onRun }: StrudelCodeViewProps) {
    console.log('[StrudelCodeView] Rendering with:', { code: code?.slice(0, 50), isConnected });
    const [editableCode, setEditableCode] = useState(() => formatStrudelDisplayCode(code || ''));
    const [runError, setRunError] = useState<string | null>(null);
    const [isUserEditing, setIsUserEditing] = useState(false);
    const [suggestion, setSuggestion] = useState<string>('');
    const [isLoadingCompletion, setIsLoadingCompletion] = useState(false);
    const lastRunRef = useRef<string>('');
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const userEditTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const completionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const autoRunTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Only sync code prop when user is NOT actively editing
    useEffect(() => {
        if (isUserEditing) {
            console.log('[StrudelCodeView] User is editing, skipping prop sync');
            return;
        }

        const incoming = formatStrudelDisplayCode(code || '').trim();
        if (incoming && incoming !== editableCode.trim()) {
            console.log('[StrudelCodeView] Syncing code from prop');
            // defer state update to next tick to avoid cascading renders
            queueMicrotask(() => {
                setEditableCode(incoming);
                lastRunRef.current = '';
            });
        }
    }, [code, editableCode, isUserEditing]);

    // removed duplicate effect

    // Keep the editor pinned to its workspace instead of resizing the app shell.
    const resizeTextarea = useCallback(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = '100%';
    }, []);

    useEffect(() => {
        resizeTextarea();
    }, [editableCode, resizeTextarea]);

    const isBalanced = (s: string) => {
        let paren = 0, brace = 0, bracket = 0;
        let inDouble = false, inSingle = false;
        for (let i = 0; i < s.length; i++) {
            const ch = s[i];
            const prev = s[i - 1];
            const escaped = prev === '\\';
            if (!escaped) {
                if (!inSingle && ch === '"') inDouble = !inDouble;
                if (!inDouble && ch === "'") inSingle = !inSingle;
                if (!inSingle && !inDouble) {
                    if (ch === '(') paren++;
                    else if (ch === ')') paren--;
                    else if (ch === '{') brace++;
                    else if (ch === '}') brace--;
                    else if (ch === '[') bracket++;
                    else if (ch === ']') bracket--;
                    if (paren < 0 || brace < 0 || bracket < 0) return false;
                }
            }
        }
        return paren === 0 && brace === 0 && bracket === 0 && !inDouble && !inSingle;
    };

    useEffect(() => {
        const codeToRun = editableCode.trim();
        if (!codeToRun) return;
        let active = true;
        const fixCommonSyntaxIssues = (code: string): string => {
            let fixed = code;

            // Strip comments and setcpm before evaluation
            fixed = fixed.replace(/\/\*[\s\S]*?\*\//g, '');
            fixed = fixed.replace(/\/\/.*/g, '');
            fixed = fixed.replace(/setcpm\s*\([^)]*\)\s*;?/gi, '');
            fixed = fixed.replace(/\bcpm\s*\([^)]*\)\s*;?/gi, '');

            // Remove trailing commas before closing parentheses/brackets
            fixed = fixed.replace(/,(\s*[\)\]])/g, '$1');

            // Remove duplicate closing braces/brackets. Do not collapse "))":
            // nested Strudel expressions commonly need adjacent closing parens.
            fixed = fixed.replace(/\}\}/g, '}');
            fixed = fixed.replace(/\]\]/g, ']');

            // Fix common mini-notation issues
            fixed = fixed.replace(/m\("([^"]*)\]"\)/g, (_match, content) => {
                // Remove trailing ] before closing quote
                return `m("${content}")`;
            });

            // Clean leading/trailing semicolons
            fixed = fixed.replace(/^[\s;,]+/, '').replace(/[\s;,]+$/, '');

            return fixed;
        };

        const validateSyntax = (code: string): { valid: boolean; error?: string } => {
            // Declare Strudel globals as function parameters to prevent "undefined" errors
            const strudelGlobals = 'note, m, s, n, stack, silence, sound, sample, seq, cat, sine, saw, tri, square, pink, noise, cosine, rand, setcpm, cpm';
            try {
                const cleaned = code
                    .replace(/\/\*[\s\S]*?\*\//g, '')
                    .replace(/\/\/.*/g, '')
                    .replace(/setcpm\s*\([^)]*\)\s*;?/gi, '')
                    .replace(/\bcpm\s*\([^)]*\)\s*;?/gi, '')
                    .replace(/^[\s;,]+/, '')
                    .replace(/[\s;,]+$/, '');

                if (!cleaned) return { valid: true };

                // Wrap code as return expression with Strudel globals defined
                new Function(strudelGlobals, `return (${cleaned})`);
                return { valid: true };
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                // Ignore "is not defined" errors - those are just undefined Strudel functions we didn't list
                if (message.includes('is not defined')) {
                    return { valid: true };
                }
                return { valid: false, error: message };
            }
        };

        const buildEvalCode = (src: string) => {
            const t = src.trim();
            if (!t) return 's("~")';

            // If it's already an IIFE with a return statement (engine-generated), use as-is
            if (t.startsWith('(() =>') && t.includes('return')) {
                return t;
            }

            // Otherwise, assume it's a valid Strudel expression and return directly
            // This handles: s("bd"), stack(...), note(...), etc.
            return t;
        };

        const timer = setTimeout(async () => {
            if (!active) return;
            if (lastRunRef.current === codeToRun) return;
            if (!isBalanced(codeToRun)) return;

            // Skip evaluation of engine-generated IIFEs (they're already evaluated by updateStrudel)
            if (codeToRun.startsWith('(() =>') && codeToRun.includes('return pattern.analyze(1)')) {
                lastRunRef.current = codeToRun;
                setRunError(null);
                return;
            }
            // Build and fix code before evaluation
            let codeToEval = buildEvalCode(codeToRun);

            // Try to fix common syntax issues
            const fixedCode = fixCommonSyntaxIssues(codeToEval);
            codeToEval = fixedCode;

            // Validate syntax before evaluation
            const validation = validateSyntax(codeToEval);

            if (!validation.valid) {
                console.warn('[StrudelCodeView] Syntax validation failed:', validation.error);
                setRunError(`Syntax error: ${validation.error}`);
                return;
            }

            try {
                console.log('[StrudelCodeView] Evaluating code:', codeToRun.slice(0, 100));
                await evalStrudelCode(codeToEval);
                lastRunRef.current = codeToRun;
                setRunError(null);
                console.log('[StrudelCodeView] Code evaluation successful');
            } catch (err) {
                console.error('[StrudelCodeView] Code evaluation error:', err);
                console.error('[StrudelCodeView] Failed code:', codeToEval.slice(0, 200));

                // Extract meaningful error message
                let errorMsg = 'Unknown error';
                if (err instanceof Error && err.message) {
                    errorMsg = err.message;
                } else if (typeof err === 'string') {
                    errorMsg = err;
                } else if (err && typeof (err as { toString: () => string }).toString === 'function') {
                    errorMsg = (err as { toString: () => string }).toString();
                }

                // Clean up error message
                errorMsg = errorMsg.replace(/^Error:\s*/i, '');

                setRunError(`${errorMsg}`);

                // Don't re-throw - just log and show error to user
            }
        }, 500);
        return () => {
            active = false;
            clearTimeout(timer);
        };
    }, [editableCode]);

    // Fetch AI completion
    const fetchCompletion = useCallback(async (text: string, cursorPos: number) => {
        if (!text || text.length < 3) {
            setSuggestion('');
            return;
        }

        setIsLoadingCompletion(true);
        try {
            const response = await fetch(resolveApiUrl('/api/complete'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: text, cursorPosition: cursorPos }),
            });

            if (response.ok) {
                const data = await response.json();
                if (data.completion) {
                    setSuggestion(data.completion);
                } else {
                    setSuggestion('');
                }
            }
        } catch (err) {
            console.error('[Completion] Error:', err);
            setSuggestion('');
        } finally {
            setIsLoadingCompletion(false);
        }
    }, []);

    const highlightRef = useRef<HTMLPreElement | null>(null);

    // Auto-fix function for common syntax errors
    const autoFix = useCallback(() => {
        let fixed = editableCode;

        // Balance parentheses
        const openParen = (fixed.match(/\(/g) || []).length;
        const closeParen = (fixed.match(/\)/g) || []).length;

        if (openParen > closeParen) {
            // Add missing closing parentheses
            fixed += ')'.repeat(openParen - closeParen);
            console.log('[StrudelCodeView] Added', openParen - closeParen, 'closing parentheses');
        } else if (closeParen > openParen) {
            // Remove extra closing parentheses from the end
            const diff = closeParen - openParen;
            for (let i = 0; i < diff; i++) {
                fixed = fixed.replace(/\)([^)]*?)$/, '$1');
            }
            console.log('[StrudelCodeView] Removed', diff, 'extra closing parentheses');
        }

        // Balance square brackets
        const openBracket = (fixed.match(/\[/g) || []).length;
        const closeBracket = (fixed.match(/\]/g) || []).length;

        if (openBracket > closeBracket) {
            fixed += ']'.repeat(openBracket - closeBracket);
        } else if (closeBracket > openBracket) {
            const diff = closeBracket - openBracket;
            for (let i = 0; i < diff; i++) {
                fixed = fixed.replace(/\]([^\]]*?)$/, '$1');
            }
        }

        // Remove trailing commas before closing parentheses
        fixed = fixed.replace(/,\s*\)/g, ')');

        // Fix common spacing issues
        fixed = fixed.replace(/\s+\)/g, ')');
        fixed = fixed.replace(/\(\s+/g, '(');

        setEditableCode(fixed);
        onCodeChange?.(fixed);
        setRunError(null);
        console.log('[StrudelCodeView] Auto-fixed code');
    }, [editableCode, onCodeChange]);

    const editorLines = editableCode.split('\n');
    const editorLineCount = Math.max(16, editorLines.length + 4);
    const editorContentHeight = editorLineCount * 24 + 24;
    const editorContentWidthCh = Math.max(112, ...editorLines.map((line) => line.length + 20));

    const highlightedCode = highlightJS(editableCode);
    const suggestionHtml = suggestion ? `<span class="bg-lime-300/10 text-lime-200/70">${escapeHtml(suggestion)}</span>` : '';
    const combinedHtml = highlightedCode + suggestionHtml;
    const copyCodeToClipboard = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(editableCode || '');
            console.log('[StrudelCodeView] Copied workspace code to clipboard');
        } catch (e) {
            console.warn('[StrudelCodeView] Copy failed', e);
        }
    }, [editableCode]);

    const replaceWorkspaceCode = useCallback(() => {
        const next = formatStrudelDisplayCode(code || editableCode || '');
        setEditableCode(next);
        setIsUserEditing(false);
        setSuggestion('');
        lastRunRef.current = '';
        onCodeChange?.(next);
        onRun?.(next);
        console.log('[StrudelCodeView] Replaced workspace code from latest generated code');
    }, [code, editableCode, onCodeChange, onRun]);

    return (
        <div className="relative flex h-full min-h-0 min-w-0 flex-col font-mono text-[13px] text-[#e6edf3] max-sm:text-base">
            {runError && (
                <div className="mb-3 flex items-center justify-between rounded-md border border-rose-400/20 bg-rose-400/10 px-3 py-2">
                    <div className="text-xs font-medium text-rose-200">{runError}</div>
                    <button
                        onClick={autoFix}
                        className="rounded-md bg-rose-200 px-3 py-1 text-xs font-semibold text-rose-950 transition-colors hover:bg-white"
                    >
                        Auto-Fix
                    </button>
                </div>
            )}

            <div className="strudel-code-shell relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md border border-white/[0.08] bg-[#0d0f12] shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
                <div className="flex h-8 shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#121417] px-3">
                    <span className="text-xs text-[#8a94a6]">javascript</span>
                    <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.12em] text-[#4b5563]">
                        {isLoadingCompletion && (
                            <>
                                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-lime-300" />
                                <span>Suggesting</span>
                            </>
                        )}
                        <button
                            type="button"
                            onClick={replaceWorkspaceCode}
                            className="rounded border border-cyan-300/20 bg-cyan-300/10 px-1.5 py-0.5 text-[9px] text-cyan-100 hover:bg-cyan-300/15"
                            title="Replace the editable workspace with the latest generated code"
                        >
                            Replace Workspace Code
                        </button>
                        <button
                            type="button"
                            onClick={copyCodeToClipboard}
                            className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] text-slate-400 hover:bg-white/10 hover:text-slate-200"
                            title="Copy Code"
                        >
                            Copy Code
                        </button>
                    </div>
                </div>

                <div className="relative min-h-0 min-w-0 flex-1">
                    <div className="studio-scrollbar h-full min-h-0 w-full overflow-auto">
                        <div
                            className="relative min-w-full"
                            style={{
                                minHeight: '100%',
                                height: `${editorContentHeight}px`,
                                width: `${editorContentWidthCh}ch`,
                            }}
                        >
                            <div
                                className="pointer-events-none absolute inset-y-0 left-0 z-20 w-11 border-r border-white/[0.06] pr-3 pt-3 text-right font-mono text-[11px] leading-6 text-[#3f4652] max-sm:w-9 max-sm:pr-2 max-sm:text-[10px] max-sm:leading-6"
                                aria-hidden="true"
                            >
                                {Array.from({ length: editorLineCount }).map((_, index) => (
                                    <div key={index}>{index + 1}</div>
                                ))}
                            </div>

                            {/* Highlighted code view behind the textarea */}
                            <pre
                                ref={highlightRef}
                                className="strudel-code-highlight pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible whitespace-pre py-3 pl-16 pr-4 font-mono text-[13px] leading-6 text-[#e6edf3] max-sm:pl-12 max-sm:text-base max-sm:leading-6"
                                dangerouslySetInnerHTML={{ __html: combinedHtml }}
                                aria-hidden="true"
                            />

                            {/* Interactive transparent textarea on top */}
                            <textarea
                                ref={textareaRef}
                                id="strudel-code-editor"
                                name="strudelCode"
                                aria-label="Strudel code editor"
                                className="absolute inset-0 z-10 h-full w-full cursor-text resize-none overflow-hidden whitespace-pre border-none bg-transparent py-3 pl-16 pr-4 font-mono text-[13px] leading-6 text-transparent caret-lime-200 outline-none selection:bg-lime-300/20 placeholder:text-[#5b6470] focus:outline-none max-sm:pl-12 max-sm:text-base max-sm:leading-6"
                                value={editableCode}
                                wrap="off"
                                onChange={(e) => {
                                    const newValue = e.target.value;
                                    const cursorPos = e.target.selectionStart || newValue.length;
                                    console.log('[StrudelCodeView] Text changed:', newValue.slice(0, 50));
                                    setEditableCode(newValue);
                                    onCodeChange?.(newValue); // Notify parent
                                    setIsUserEditing(true);
                                    setSuggestion(''); // Clear suggestion when typing

                                    // Clear existing timeouts
                                    if (userEditTimeoutRef.current) clearTimeout(userEditTimeoutRef.current);
                                    if (autoRunTimeoutRef.current) clearTimeout(autoRunTimeoutRef.current);

                                    // Set user as "not editing" after 1.2 seconds of inactivity
                                    userEditTimeoutRef.current = setTimeout(() => {
                                        console.log('[StrudelCodeView] User stopped editing');
                                        setIsUserEditing(false);
                                    }, 1200);

                                    // Auto-run code after 800ms of inactivity
                                    autoRunTimeoutRef.current = setTimeout(() => {
                                        console.log('[StrudelCodeView] Auto-running code...');
                                        onRun?.(newValue);
                                    }, 800);

                                    // Trigger completion after 500ms of no typing
                                    if (completionTimeoutRef.current) {
                                        clearTimeout(completionTimeoutRef.current);
                                    }
                                    completionTimeoutRef.current = setTimeout(() => {
                                        console.log('[StrudelCodeView] Triggering completion fetch...');
                                        fetchCompletion(newValue, cursorPos);
                                    }, 500);

                                    resizeTextarea();
                                }}
                                onFocus={() => console.log('[StrudelCodeView] Textarea focused')}
                                onClick={() => console.log('[StrudelCodeView] Textarea clicked')}
                                onKeyDown={(e) => {
                                    console.log('[StrudelCodeView] Key pressed:', e.key);

                                    // Run on Ctrl+Enter
                                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                        e.preventDefault();
                                        console.log('[StrudelCodeView] Manual run triggered');
                                        onRun?.(editableCode);
                                        return;
                                    }

                                    // Handle Tab key (Accept suggestion OR Indent)
                                    if (e.key === 'Tab') {
                                        e.preventDefault(); // Always prevent focus loss

                                        if (suggestion) {
                                            // Accept AI suggestion
                                            const newValue = editableCode + suggestion;
                                            setEditableCode(newValue);
                                            onCodeChange?.(newValue);
                                            setSuggestion('');

                                            // Move cursor to end
                                            setTimeout(() => {
                                                if (textareaRef.current) {
                                                    textareaRef.current.selectionStart = newValue.length;
                                                    textareaRef.current.selectionEnd = newValue.length;
                                                }
                                            }, 0);
                                        } else {
                                            // Insert indentation (2 spaces)
                                            const start = e.currentTarget.selectionStart;
                                            const end = e.currentTarget.selectionEnd;
                                            const newValue = editableCode.substring(0, start) + '  ' + editableCode.substring(end);

                                            setEditableCode(newValue);
                                            onCodeChange?.(newValue);

                                            // Move cursor after spaces
                                            setTimeout(() => {
                                                if (textareaRef.current) {
                                                    textareaRef.current.selectionStart = start + 2;
                                                    textareaRef.current.selectionEnd = start + 2;
                                                }
                                            }, 0);
                                        }
                                        return;
                                    }

                                    // Clear suggestion on Escape
                                    if (e.key === 'Escape') {
                                        setSuggestion('');
                                    }
                                }}
                                placeholder="// Type Strudel code here...
// Example: note(m(&quot;c3 ~ c3 ~&quot;)).s(&quot;square&quot;)
// Try: stack(note(m(&quot;c3*4&quot;)).s(&quot;square&quot;), note(m(&quot;c5*8&quot;)).s(&quot;square&quot;).decay(0.02))
// Press Tab to accept AI suggestions"
                                spellCheck={false}
                                autoComplete="off"
                                autoCorrect="off"
                                autoCapitalize="off"
                            />
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function highlightJS(code: string): string {
    const escaped = escapeHtml(code);
    // Comment group: (\/\/[^\n]*)
    // String group: ('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)
    // Number group: (\b\d+(?:\.\d+)?\b)
    // Keyword group: (\b(?:const|let|var|function|return|import|export)\b)
    // Function/Method group: (\b(?:stack|s|gain|hpf|lpf|note|m|att|decay|room|slow|sound|sample|seq|cat|sine|saw|tri|square|pink|noise|cosine|rand|vowel|distort|resonance|delay|bandpass|highpass|lowpass|pan|speed|coarse|mix|room|size)\b)
    const tokenRegex = /(\/\/[^\n]*)|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|(\b(?:const|let|var|function|return|import|export)\b)|(\b(?:stack|s|gain|hpf|lpf|note|m|att|decay|sustain|release|room|slow|fast|sound|sample|seq|cat|sine|saw|tri|square|pink|noise|cosine|rand|range|vowel|distort|resonance|delay|bandpass|highpass|lowpass|bandf|cutoff|pan|speed|coarse|mix|size|velocity|trans|add|rev|jux|crush|phaser|chorus|tremolo|leslie|acidenv)\b)|([().,{}\[\]])|(&lt;|&gt;|=&gt;|[-+*/=])/g;

    return escaped.replace(tokenRegex, (match, comment, string, number, keyword, func, punctuation, operator) => {
        if (comment) {
            return `<span class="strudel-token strudel-token-comment">${comment}</span>`;
        }
        if (string) {
            return `<span class="strudel-token strudel-token-string">${string}</span>`;
        }
        if (number) {
            return `<span class="strudel-token strudel-token-number">${number}</span>`;
        }
        if (keyword) {
            return `<span class="strudel-token strudel-token-keyword">${keyword}</span>`;
        }
        if (func) {
            return `<span class="strudel-token strudel-token-function">${func}</span>`;
        }
        if (punctuation) {
            return `<span class="strudel-token strudel-token-punctuation">${punctuation}</span>`;
        }
        if (operator) {
            return `<span class="strudel-token strudel-token-operator">${operator}</span>`;
        }
        return match;
    });
}
