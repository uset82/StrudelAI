'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { SonicSessionState } from '@/types/sonic';
import { evalStrudelCode } from '@/lib/strudel/engine';

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
    const [editableCode, setEditableCode] = useState(code || '');
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

        const incoming = (code || '').trim();
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

    // Auto-resize textarea to fit content so no inner scrollbars appear
    const resizeTextarea = useCallback(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
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
        if (!codeToRun || !isConnected) return;
        let active = true;
        const fixCommonSyntaxIssues = (code: string): string => {
            let fixed = code;

            // Remove trailing commas before closing parentheses/brackets
            fixed = fixed.replace(/,(\s*[\)\]])/g, '$1');

            // Remove duplicate closing brackets/parentheses
            fixed = fixed.replace(/\}\}/g, '}');
            fixed = fixed.replace(/\)\)/g, ')');
            fixed = fixed.replace(/\]\]/g, ']');

            // Fix common mini-notation issues
            fixed = fixed.replace(/m\("([^"]*)\]"\)/g, (_match, content) => {
                // Remove trailing ] before closing quote
                return `m("${content}")`;
            });

            return fixed;
        };

        const validateSyntax = (code: string): { valid: boolean; error?: string } => {
            // Declare Strudel globals as function parameters to prevent "undefined" errors
            const strudelGlobals = 'note, m, s, n, stack, silence, sound, sample, seq, cat, sine, saw, tri, square, pink, noise, cosine, rand';
            try {
                // Wrap code as return expression with Strudel globals defined
                new Function(strudelGlobals, `return ${code}`);
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
    }, [editableCode, isConnected]);

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

    return (
        <div className="flex-1 font-mono text-sm text-cyan-100 relative">
            {runError && (
                <div className="mb-3 flex items-center justify-between">
                    <div className="text-xs text-red-400">{runError}</div>
                    <button
                        onClick={autoFix}
                        className="px-3 py-1 text-xs bg-cyan-600 hover:bg-cyan-500 text-white rounded transition-colors"
                    >
                        Auto-Fix
                    </button>
                </div>
            )}

            <div className="relative w-full">
                {isLoadingCompletion && (
                    <div className="absolute top-2 right-2 z-30">
                        <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></div>
                    </div>
                )}
                <textarea
                    ref={textareaRef}
                    id="strudel-code-editor"
                    name="strudelCode"
                    aria-label="Strudel code editor"
                    className="w-full min-h-[300px] bg-black/40 border border-cyan-900/50 p-4 text-cyan-100 font-mono text-sm resize-none overflow-hidden cursor-text pointer-events-auto z-10 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 rounded-lg relative"
                    value={editableCode}
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

                {/* Ghost text suggestion */}
                {suggestion && (
                    <div
                        className="absolute top-0 left-0 w-full h-full pointer-events-none font-mono text-sm pt-[17px] pl-[17px] whitespace-pre-wrap overflow-wrap-break-word text-transparent z-0 overflow-hidden"
                        aria-hidden="true"
                    >
                        {editableCode}<span className="text-cyan-500/70 bg-cyan-500/10">{suggestion}</span>
                    </div>
                )}
            </div>
        </div>
    );
}
