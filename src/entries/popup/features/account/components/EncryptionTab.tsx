import React, { useEffect, useState } from 'react';

import BackendService from '@/services/BackendService';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const EncryptionTab: React.FC = () => {
    const qc = useQueryClient();
    const { data: user } = useQuery({
        queryKey: ['user'],
        queryFn: () => BackendService.getUser(),
    });

    const [pgpKey, setPgpKey] = useState('');
    const [status, setStatus] = useState('');

    useEffect(() => { setPgpKey((user as any)?.pgpPublicKey || ''); }, [(user as any)?.pgpPublicKey]);

    const saveMutation = useMutation({
        mutationFn: (key: string) => BackendService.updateUser({ pgpPublicKey: key }),
        onSuccess: () => { setStatus('Key saved'); qc.invalidateQueries({ queryKey: ['user'] }); },
        onError: (e: unknown) => setStatus(e instanceof Error ? e.message : 'Save failed'),
    });

    const removeMutation = useMutation({
        mutationFn: () => BackendService.updateUser({ pgpPublicKey: null }),
        onSuccess: () => { setStatus('Key removed'); qc.invalidateQueries({ queryKey: ['user'] }); },
        onError: (e: unknown) => setStatus(e instanceof Error ? e.message : 'Remove failed'),
    });

    return (
        <div className="space-y-2">
            <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-neutral-500">PGP Public Key</label>
                <textarea value={pgpKey} onChange={e => setPgpKey(e.target.value)} placeholder="-----BEGIN PGP PUBLIC KEY BLOCK-----" className="h-28 w-full resize-none rounded-md bg-neutral-950/60 px-3 py-2 text-[11px] font-mono leading-tight text-neutral-100 outline-none focus:bg-neutral-900/70 focus:ring-2 focus:ring-orange-500/30" />
                <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                    <button onClick={() => saveMutation.mutate(pgpKey.trim())} disabled={!pgpKey.trim() || saveMutation.isPending} className="rounded-md bg-orange-500 px-3 py-1.5 font-semibold text-neutral-900 hover:bg-orange-400 disabled:opacity-40">{saveMutation.isPending ? 'Saving…' : 'Save Key'}</button>
                    <button onClick={() => removeMutation.mutate()} disabled={!((user as any)?.pgpPublicKey) || removeMutation.isPending} className="rounded-md border border-neutral-700 bg-neutral-800/60 px-3 py-1.5 font-medium text-neutral-300 transition hover:border-orange-500/50 hover:text-orange-200 disabled:opacity-40">Remove</button>
                    <button onClick={() => setPgpKey('')} disabled={saveMutation.isPending || removeMutation.isPending || (!pgpKey && !((user as any)?.pgpPublicKey))} className="rounded-md px-3 py-1.5 font-medium text-neutral-500 hover:text-orange-300 disabled:opacity-30">Clear</button>
                </div>
                {status && <p className="mt-1 text-[10px] text-neutral-400">{status}</p>}
            </div>
        </div>
    );
};

export default EncryptionTab;