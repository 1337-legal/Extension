import React, { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import BackendService from '@/services/BackendService';

const AutofillTab: React.FC = () => {
    const [alias, setAlias] = useState('');
    const [copied, setCopied] = useState(false);
    const [creating, setCreating] = useState(false);

    const copy = useCallback(async () => {
        if (!alias) return;
        try { await navigator.clipboard.writeText(alias); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch { /* noop */ }
    }, [alias]);

    const generate = async () => {
        setCreating(true);
        try {
            const r = await BackendService.createAlias() as any;
            setAlias(r?.address || r?.alias || '');
        } catch { /* noop */ }
        finally { setCreating(false); }
    };

    useEffect(() => { if (alias) void copy(); }, [alias, copy]);

    return (
        <div className="space-y-3">
            <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-neutral-500">Current Alias</label>
                <div className="flex items-stretch rounded-md border border-neutral-800/60 bg-neutral-950/50">
                    <input value={alias} readOnly placeholder="(none yet)" className="flex-1 bg-transparent px-2 text-center py-2 text-[11px] font-mono text-orange-200 placeholder-neutral-600 outline-none" />
                    <Button onClick={copy} disabled={!alias} className="px-2 text-[10px] font-medium text-neutral-400 hover:text-orange-300 disabled:opacity-40">{copied ? 'Copied' : 'Copy'}</Button>
                </div>
            </div>
            <div>
                <Button onClick={generate} disabled={creating} className="inline-flex items-center rounded-md bg-orange-500 px-3 py-2 text-[11px] font-semibold text-neutral-900 shadow hover:bg-orange-400 disabled:opacity-50">
                    {creating ? 'Generating…' : 'Generate'}
                </Button>
            </div>
            <p className="text-[10px] text-neutral-500">Use this alias in forms; it forwards while hiding your real address.</p>
        </div>
    );
};

export default AutofillTab;