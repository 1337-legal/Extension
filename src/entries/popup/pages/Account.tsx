import React, { useState } from 'react';
import { Link } from 'react-router';

import AliasesTab from '../features/account/components/AliasesTab';
import AutofillTab from '../features/account/components/AutofillTab';
import EncryptionTab from '../features/account/components/EncryptionTab';
import RouteTab from '../features/account/components/RouteTab';

export default function Account() {
    const [activeTab, setActiveTab] = useState<'autofill' | 'route' | 'aliases' | 'encryption'>('autofill');

    return (
        <div className="min-w-[320px] min-h-[480px] bg-neutral-950 text-neutral-100 relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none [background:radial-gradient(60%_50%_at_100%_0%,rgba(251,146,60,0.14),transparent_60%),radial-gradient(40%_40%_at_0%_100%,rgba(236,72,153,0.08),transparent_60%)]" />

            {/* Frosted content card */}
            <div className="m-2 rounded-xl border border-neutral-800/60 bg-neutral-900/40 px-4 py-3 backdrop-blur-sm shadow-[0_10px_30px_-15px_rgba(0,0,0,0.6)] ring-1 ring-white/5 relative z-10">
                <div className="mb-2 flex items-center justify-between">
                    <h1 className="text-[12px] font-semibold tracking-tight">1337.legal</h1>
                    <span className="rounded border border-neutral-800 bg-neutral-900/80 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-neutral-400">Account</span>
                </div>

                <div className="mb-2 flex items-center gap-2 text-[11px]">
                    <Link to="/" className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-medium text-neutral-300 transition hover:text-orange-200 border border-neutral-800/60 bg-neutral-900/60 backdrop-blur-sm">
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                        Back
                    </Link>
                </div>

                <div>
                    {/* Segmented, pill-style tabs */}
                    <div className="mb-2 inline-flex items-center gap-1 rounded-md border border-neutral-800/60 bg-neutral-900/60 p-1 text-[11px] font-medium tracking-wide backdrop-blur-sm">
                        {(['autofill', 'route', 'aliases', 'encryption'] as const).map(k => (
                            <button
                                key={k}
                                onClick={() => setActiveTab(k)}
                                className={`px-3 py-1.5 rounded-[8px] transition ${activeTab === k ? 'bg-orange-500/20 text-orange-200 shadow-[inset_0_0_0_1px_rgba(251,146,60,.35)]' : 'text-neutral-300 hover:text-orange-200 hover:bg-white/5'}`}
                            >
                                {k.charAt(0).toUpperCase() + k.slice(1)}
                            </button>
                        ))}
                    </div>

                    {/* Content area */}
                    <div className="min-h-[320px] space-y-2 rounded-lg border border-neutral-800/60 bg-neutral-900/40 p-3 backdrop-blur-sm">
                        {activeTab === 'autofill' && <AutofillTab />}
                        {activeTab === 'route' && <RouteTab />}
                        {activeTab === 'aliases' && <AliasesTab />}
                        {activeTab === 'encryption' && <EncryptionTab />}
                    </div>
                </div>
            </div>
        </div>
    );
}