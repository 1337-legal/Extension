import React, { useEffect, useState } from 'react';

import BackendService from '@/services/BackendService';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const RouteTab: React.FC = () => {
    const qc = useQueryClient();
    const { data: user, isLoading, isFetching } = useQuery({
        queryKey: ['user'],
        queryFn: () => BackendService.getUser(),
    });

    const [forwarding, setForwarding] = useState('');
    const [status, setStatus] = useState('');

    useEffect(() => { setForwarding((user as any)?.address || ''); }, [(user as any)?.address]);

    const updateMutation = useMutation({
        mutationFn: (address: string) => BackendService.updateUser({ address }),
        onSuccess: () => { setStatus('Updated'); qc.invalidateQueries({ queryKey: ['user'] }); },
        onError: (e: unknown) => setStatus(e instanceof Error ? e.message : 'Update failed'),
    });

    const onUpdate = () => { if (!forwarding) return; setStatus(''); updateMutation.mutate(forwarding); };

    return (
        <div className="space-y-2">
            <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-neutral-500">Forwarding Address</label>
                <div className="flex gap-2">
                    <input value={forwarding} onChange={e => setForwarding(e.target.value)} placeholder="you@example.com" className="flex-1 rounded-md bg-neutral-950/60 px-2 py-2 text-xs text-neutral-100 outline-none focus:bg-neutral-900/70 focus:ring-2 focus:ring-orange-500/30" />
                    <button onClick={onUpdate} disabled={!forwarding || updateMutation.isPending} className="rounded-md bg-orange-500 px-3 py-2 text-[11px] font-semibold text-neutral-900 hover:bg-orange-400 disabled:opacity-40">{updateMutation.isPending ? 'Saving…' : 'Update'}</button>
                </div>
                {(status || isLoading || isFetching) && (
                    <p className="mt-1 text-[10px] text-neutral-400">{isLoading || isFetching ? 'Loading…' : status}</p>
                )}
            </div>
        </div>
    );
};

export default RouteTab;