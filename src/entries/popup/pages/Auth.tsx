import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import { Button } from '@/components/ui/button';
import { generateMnemonic, validateMnemonic } from '@/lib/bip39';
import BackendService from '@/services/BackendService';
import { decryptMnemonic, encryptMnemonic } from '@/services/CryptoService';
import SessionService from '@/services/SessionService';

export default function Auth() {
    const navigate = useNavigate();

    const hasEnc = useMemo(() => !!SessionService.getEncryptedMnemonic(), []);
    const [mode, setMode] = useState<"have" | "new" | "verify" | "show" | "unlock">(() => hasEnc ? 'unlock' : 'have');

    const [error, setError] = useState<string | null>(null);

    const [mnemonic, setMnemonic] = useState('');
    const [signingIn, setSigningIn] = useState(false);

    const handleSignIn = async () => {
        const words = mnemonic.trim().toLowerCase().split(/\s+/).filter(Boolean);
        if (words.length !== 24) { setError('Please enter exactly 24 words.'); return; }
        const normalized = words.join(' ');
        if (!(await validateMnemonic(normalized))) { setError('Invalid BIP39 checksum.'); return; }
        try {
            setError(null); setSigningIn(true);
            try {
                await BackendService.auth(normalized);
            } catch (e: any) {
                const msg = e instanceof Error ? e.message : String(e ?? '');
                const aborted = /aborted/i.test(msg) || e?.name === 'AbortError';
                if (aborted) {
                    await new Promise(r => setTimeout(r, 200));
                    await BackendService.auth(normalized);
                } else {
                    throw e;
                }
            }
            navigate('/account');
        } catch (e: any) {
            const msg = e instanceof Error ? e.message : String(e ?? '');
            console.error('Sign-in failed:', e);
            if (/aborted/i.test(msg) || e?.name === 'AbortError') {
                setError('Network interrupted. Keep the popup open and try again.');
            } else {
                setError(msg || 'Authentication failed.');
            }
        } finally { setSigningIn(false); }
    };

    // --- Unlock existing (encrypted) ---
    const [unlockPass, setUnlockPass] = useState('');
    const [unlockLoading, setUnlockLoading] = useState(false);

    const handleUnlockEnc = async () => {
        try {
            setError(null); setUnlockLoading(true);
            const blob = SessionService.getEncryptedMnemonic();
            if (!blob) { setMode('have'); return; }
            const m = await decryptMnemonic(unlockPass, blob);
            await BackendService.auth(m);
            navigate('/account');
        } catch (e: any) {
            const msg = e instanceof Error ? e.message : String(e ?? '');
            if (/aborted/i.test(msg) || e?.name === 'AbortError') {
                setError('Network interrupted. Keep the popup open and try again.');
            } else {
                setError('Incorrect passcode or corrupted data.');
            }
        } finally { setUnlockLoading(false); }
    };

    // --- New user registration ---
    const [email, setEmail] = useState('');
    const [pgp, setPgp] = useState('');
    const [sending, setSending] = useState(false);

    const startRegister = async () => {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Enter a valid email.'); return; }
        try {
            setError(null); setSending(true);
            const { status, data } = await BackendService.sendRequest('POST', '/api/v1/auth/send-code', { email, pgp: (pgp || undefined) });
            if (status >= 400) throw new Error((data as any)?.message || 'Failed to start verification');
            setMode('verify');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to start verification');
        } finally { setSending(false); }
    };

    // --- Verify code ---
    const [code, setCode] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [generated, setGenerated] = useState<string | null>(null);

    const verifyCode = async () => {
        const parts = code.trim().split(/\s+/).filter(Boolean);
        if (parts.length < 3) { setError('Enter the 3-word code.'); return; }
        try {
            setError(null); setVerifying(true);
            const { status, data } = await BackendService.sendRequest('POST', '/api/v1/auth/verify-code', { email, code: code.trim() });
            if (status >= 400) throw new Error((data as any)?.message || 'Invalid code');
            const m = await generateMnemonic(256);
            setGenerated(m);
            setMode('show');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Verification failed');
        } finally { setVerifying(false); }
    };

    // --- Save encrypted and continue ---
    const [pass1, setPass1] = useState('');
    const [pass2, setPass2] = useState('');
    const [saving, setSaving] = useState(false);

    const encryptAndContinue = async () => {
        if (!generated) return;
        if (pass1.length < 8) { setError('Passcode must be at least 8 characters.'); return; }
        if (pass1 !== pass2) { setError('Passcodes do not match.'); return; }
        try {
            setError(null); setSaving(true);
            const blob = await encryptMnemonic(pass1, generated);
            SessionService.setEncryptedMnemonic(blob);
            await BackendService.auth(generated, email);
            navigate('/account');
        } catch {
            setError('Failed to continue. Try again.');
        } finally { setSaving(false); }
    };

    useEffect(() => { setError(null); }, [mode]);

    return (
        <div className="min-w-[320px] min-h-[480px] bg-neutral-950 text-neutral-100 relative overflow-hidden">
            <div className="px-4 py-3">
                <div className="mb-2 flex items-center justify-between">
                    <h1 className="text-[12px] font-semibold tracking-tight">1337.legal</h1>
                    <span className="rounded border border-neutral-800 bg-neutral-900 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-neutral-400">Auth</span>
                </div>

                <p className="text-[11px] text-neutral-400 mb-2">Authenticate to manage aliases and autofill.</p>

                {/* Segmented control */}
                <div className="mb-2 grid grid-cols-2 gap-2">
                    <button onClick={() => setMode(hasEnc ? 'unlock' : 'have')} className={`${mode === 'have' || mode === 'unlock' ? 'bg-orange-500/20 text-orange-200 border border-orange-400/40' : 'bg-neutral-900 text-neutral-300 border border-neutral-800 hover:border-neutral-700'} rounded-md px-2 py-1.5 text-[11px] font-medium`}>I have a mnemonic</button>
                    <button onClick={() => setMode('new')} className={`${mode === 'new' || mode === 'verify' || mode === 'show' ? 'bg-orange-500/20 text-orange-200 border border-orange-400/40' : 'bg-neutral-900 text-neutral-300 border border-neutral-800 hover:border-neutral-700'} rounded-md px-2 py-1.5 text-[11px] font-medium`}>I’m new</button>
                </div>

                {/* Unlock existing (encrypted) */}
                {mode === 'unlock' && (
                    <div>
                        <label className="block text-[11px] font-medium text-neutral-400 mb-1">Enter passcode</label>
                        <input
                            type="password"
                            value={unlockPass}
                            onChange={(e) => setUnlockPass(e.target.value)}
                            placeholder="passcode"
                            className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-xs text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/30"
                        />
                        <div className="mt-2 flex gap-2">
                            <Button onClick={handleUnlockEnc} className="bg-orange-500 text-neutral-900 hover:bg-orange-400 px-3 py-2 text-xs font-semibold rounded-md" disabled={unlockLoading || unlockPass.length < 1}>
                                {unlockLoading ? 'Unlocking…' : 'Unlock'}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Have mnemonic (manual) */}
                {(mode === 'have') && (
                    <div>
                        <label className="block text-[11px] font-medium text-neutral-400 mb-1">24-word mnemonic</label>
                        <textarea
                            rows={3}
                            value={mnemonic}
                            onChange={(e) => setMnemonic(e.target.value)}
                            placeholder="paste your 24 words here"
                            className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-xs text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/30"
                        />
                        <div className="mt-2 flex gap-2">
                            <Button onClick={handleSignIn} className="bg-orange-500 text-neutral-900 hover:bg-orange-400 px-3 py-2 text-xs font-semibold rounded-md" disabled={signingIn}>
                                {signingIn ? 'Signing in…' : 'Sign In'}
                            </Button>
                        </div>
                    </div>
                )}

                {/* New -> email */}
                {mode === 'new' && (
                    <div>
                        <label className="block text-[11px] font-medium text-neutral-400 mb-1">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-xs text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/30"
                        />
                        <label className="mt-2 block text-[11px] font-medium text-neutral-400 mb-1">PGP public key (optional)</label>
                        <textarea
                            rows={3}
                            value={pgp}
                            onChange={(e) => setPgp(e.target.value)}
                            placeholder={`-----BEGIN PGP PUBLIC KEY BLOCK-----\n...\n-----END PGP PUBLIC KEY BLOCK-----`}
                            className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-[10px] text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/30"
                        />
                        <div className="mt-2 flex gap-2">
                            <Button onClick={startRegister} className="bg-orange-500 text-neutral-900 hover:bg-orange-400 px-3 py-2 text-xs font-semibold rounded-md" disabled={sending}>
                                {sending ? 'Sending…' : 'Send code'}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Verify code */}
                {mode === 'verify' && (
                    <div>
                        <p className="mb-1 text-[11px] text-neutral-400">We sent a 3-word code to {email}. Enter it below.</p>
                        <input
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            placeholder="three word code"
                            className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-xs text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/30"
                        />
                        <div className="mt-2 flex gap-2">
                            <Button onClick={verifyCode} className="bg-orange-500 text-neutral-900 hover:bg-orange-400 px-3 py-2 text-xs font-semibold rounded-md" disabled={verifying || code.trim().split(/\s+/).length < 3}>
                                {verifying ? 'Verifying…' : 'Verify'}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Show generated and set passcode */}
                {mode === 'show' && generated && (
                    <div>
                        <p className="mb-2 text-[11px] text-neutral-400">Write down your 24 words. Then set a passcode to encrypt them locally.</p>
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                            {generated.split(' ').map((w, i) => (
                                <div key={i} className="flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1.5">
                                    <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-neutral-800 text-[10px] text-neutral-400">{i + 1}</span>
                                    <span className="truncate">{w}</span>
                                </div>
                            ))}
                        </div>
                        <label className="mt-3 block text-[11px] font-medium text-neutral-400">Create a passcode</label>
                        <div className="grid grid-cols-1 gap-2">
                            <input type="password" placeholder="Passcode (min 8 chars)" value={pass1} onChange={(e) => setPass1(e.target.value)} className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-xs text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/30" />
                            <input type="password" placeholder="Confirm passcode" value={pass2} onChange={(e) => setPass2(e.target.value)} className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-xs text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/30" />
                        </div>
                        <div className="mt-2 flex gap-2">
                            <Button onClick={encryptAndContinue} className="bg-orange-500 text-neutral-900 hover:bg-orange-400 px-3 py-2 text-xs font-semibold rounded-md" disabled={saving}>
                                {saving ? 'Please wait…' : 'Encrypt & continue'}
                            </Button>
                        </div>
                    </div>
                )}

                {error && <p className="mt-2 text-[11px] text-red-400">{error}</p>}

                <p className="mt-3 text-[10px] text-neutral-500">Your mnemonic never leaves your device. Only derived keys and encrypted payloads are sent.</p>
            </div>
        </div>
    );
}