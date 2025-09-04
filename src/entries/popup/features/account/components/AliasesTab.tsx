import React from 'react';

import BackendService from '@/services/BackendService';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

type AliasRecord = { id?: string; alias?: string; address?: string; createdAt?: string };

const AliasesTab: React.FC = () => {
    const qc = useQueryClient();

    const { data: aliases = [], isLoading, isFetching, error } = useQuery<AliasRecord[]>({
        queryKey: ['aliases'],
        queryFn: () => BackendService.listAliases(),
    });

    const createMutation = useMutation({
        mutationFn: () => BackendService.createAlias(),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['aliases'] })
    });

    const deleteMutation = useMutation({
        mutationFn: (r: AliasRecord) => BackendService.deleteAlias(r),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['aliases'] })
    });

    const handleRemove = (r: AliasRecord) => { if (confirm('Delete alias?')) deleteMutation.mutate(r); };

    const err = (createMutation.error || deleteMutation.error || error) as unknown;
    const msg = err ? (err instanceof Error ? err.message : 'Request failed') : '';

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-[12px] font-semibold text-neutral-200">Aliases</h3>
                <div className="flex gap-2">
                    <button onClick={() => qc.invalidateQueries({ queryKey: ['aliases'] })} disabled={isFetching || isLoading} className="rounded-md border border-neutral-700 bg-neutral-800/60 px-2 py-1 text-[10px] font-medium text-neutral-300 disabled:opacity-40">Reload</button>
                    <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="rounded-md bg-orange-500 px-2.5 py-1 text-[10px] font-semibold text-neutral-900 shadow disabled:opacity-50">New</button>
                </div>
            </div>
            {msg && <p className="text-[10px] text-red-400">{msg}</p>}
            <div className="max-h-48 overflow-auto rounded-md border border-neutral-800/60 bg-neutral-950/40">
                <table className="w-full text-left text-[11px]">
                    <thead className="bg-neutral-900/70 text-neutral-500 uppercase tracking-wider">
                        <tr>
                            <th className="px-2 py-1.5 font-medium">Alias</th>
                            <th className="px-2 py-1.5 font-medium">Created</th>
                            <th className="px-2 py-1.5" />
                        </tr>
                    </thead>
                    <tbody>
                        {aliases.length === 0 && !isLoading && (
                            <tr><td colSpan={3} className="px-2 py-3 text-neutral-600">No aliases.</td></tr>
                        )}
                        {aliases.map(a => (
                            <tr key={a.id || a.alias} className="border-t border-neutral-800/60 hover:bg-neutral-900/50">
                                <td className="px-2 py-1.5 font-mono text-[10px] text-orange-200">{a.alias || a.address}</td>
                                <td className="px-2 py-1.5 text-neutral-500">{a.createdAt ? new Date(a.createdAt).toLocaleString() : '—'}</td>
                                <td className="px-2 py-1.5 text-right">
                                    <button onClick={() => handleRemove(a)} className="rounded-md border border-red-800/40 bg-red-900/10 px-2 py-0.5 text-[10px] font-medium text-red-300 hover:bg-red-900/20">Delete</button>
                                </td>
                            </tr>
                        ))}
                        {isLoading && <tr><td colSpan={3} className="px-2 py-3 text-neutral-600">Loading…</td></tr>}
                    </tbody>
                </table>
            </div>
            <p className="text-[10px] text-neutral-500">Deletion revokes routing for that alias.</p>
        </div>
    );
};

export default AliasesTab;