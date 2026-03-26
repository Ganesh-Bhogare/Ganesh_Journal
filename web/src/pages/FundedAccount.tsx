import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Radio, RefreshCcw, ShieldCheck } from 'lucide-react'
import AnimatedCard from '../components/AnimatedCard'
import GradientButton from '../components/GradientButton'
import { api } from '../lib/api'

type FundedStatusResponse = {
    funded?: {
        enabled?: boolean
        provider?: string
        terminalType?: string
        accountId?: string
        server?: string
    }
    sync?: {
        totalSynced?: number
        lastSyncedAt?: string | null
        recent?: Array<{
            _id?: string
            externalTradeId?: string
            instrument?: string
            direction?: 'long' | 'short' | string
            pnl?: number
            updatedAt?: string
        }>
    }
    live?: {
        updatedAt?: string | null
        openPositions?: Array<{
            ticket?: string
            symbol?: string
            direction?: 'long' | 'short' | string
            volume?: number
            openPrice?: number
            currentPrice?: number
            unrealizedPnl?: number
            sl?: number
            tp?: number
            openTime?: string
        }>
    }
}

type FundedPrefs = {
    fundedReadOnlyEnabled: boolean
    fundedProvider: string
    fundedTerminalType: 'mt4' | 'mt5' | 'other'
    fundedAccountId: string
    fundedServer: string
}

export default function FundedAccount() {
    const [data, setData] = useState<FundedStatusResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [prefLoading, setPrefLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState('')
    const [saveOk, setSaveOk] = useState('')
    const [prefs, setPrefs] = useState<FundedPrefs>({
        fundedReadOnlyEnabled: false,
        fundedProvider: 'Goat Funded Trader',
        fundedTerminalType: 'mt5',
        fundedAccountId: '',
        fundedServer: '',
    })

    const fetchStatus = async () => {
        try {
            const res = await api.get('/funded/status')
            setData(res.data || null)
        } catch (err) {
            console.error('Failed to fetch funded status', err)
            setData(null)
        } finally {
            setLoading(false)
        }
    }

    const loadPrefs = async () => {
        try {
            const { data } = await api.get('/user/preferences')
            const p = data?.preferences || {}
            setPrefs({
                fundedReadOnlyEnabled: Boolean(p.fundedReadOnlyEnabled),
                fundedProvider: p.fundedProvider != null ? String(p.fundedProvider) : 'Goat Funded Trader',
                fundedTerminalType: (p.fundedTerminalType === 'mt4' || p.fundedTerminalType === 'other') ? p.fundedTerminalType : 'mt5',
                fundedAccountId: p.fundedAccountId != null ? String(p.fundedAccountId) : '',
                fundedServer: p.fundedServer != null ? String(p.fundedServer) : '',
            })
        } catch (err) {
            console.error('Failed to load funded preferences', err)
        } finally {
            setPrefLoading(false)
        }
    }

    const savePrefs = async () => {
        if (saving) return
        setSaving(true)
        setSaveError('')
        setSaveOk('')
        try {
            const payload = {
                fundedReadOnlyEnabled: prefs.fundedReadOnlyEnabled,
                fundedProvider: prefs.fundedProvider || undefined,
                fundedTerminalType: prefs.fundedTerminalType,
                fundedAccountId: prefs.fundedAccountId || undefined,
                fundedServer: prefs.fundedServer || undefined,
                fundedExecutionEnabled: false,
            } as Record<string, any>

            Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k])
            await api.put('/user/preferences', payload)
            setSaveOk('Saved successfully. Funded mapping updated.')
            await fetchStatus()
        } catch (err: any) {
            const msg = err?.response?.data?.error
            setSaveError(typeof msg === 'string' ? msg : 'Failed to save funded settings')
        } finally {
            setSaving(false)
        }
    }

    useEffect(() => {
        fetchStatus()
        loadPrefs()

        // Keep funded panel live without forcing manual refresh.
        const id = window.setInterval(fetchStatus, 20000)
        return () => window.clearInterval(id)
    }, [])

    const funded = data?.funded
    const sync = data?.sync
    const recent = Array.isArray(sync?.recent) ? sync?.recent : []
    const live = data?.live
    const openPositions = Array.isArray(live?.openPositions) ? live.openPositions : []
    const mappingReady = Boolean(funded?.enabled && String(funded?.accountId || '').trim())

    const statusLabel = useMemo(() => {
        if (!funded?.enabled) return 'Not linked'
        if (!mappingReady) return 'Enabled, mapping incomplete'
        return 'Connected (Read-only)'
    }, [funded?.enabled, mappingReady])

    const lastSyncLabel = useMemo(() => {
        return sync?.lastSyncedAt ? new Date(sync.lastSyncedAt).toLocaleString() : 'Never'
    }, [sync?.lastSyncedAt])

    return (
        <div className="space-y-6">
            <AnimatedCard delay={0.04} className="p-5 md:p-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                        <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-100">
                            <ShieldCheck size={16} className="text-cyan-300" />
                            Funded Account
                        </div>
                        <h1 className="mt-2 text-2xl md:text-3xl font-bold text-white">Read-only Funded Sync Panel</h1>
                        <p className="mt-2 text-sm text-slate-300 max-w-2xl">
                            Is panel me funded account link status, sync count, last sync timestamp aur imported trades ka recent feed milega.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={fetchStatus}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-blue-700/60 text-white hover:bg-blue-900/35 transition-colors"
                        >
                            <RefreshCcw size={15} /> Refresh
                        </button>
                    </div>
                </div>
            </AnimatedCard>

            <AnimatedCard delay={0.06} className="p-4 md:p-5">
                <h3 className="text-lg font-semibold mb-4">Funded Account Mapping (Save Here)</h3>
                <div className="space-y-4">
                    <div className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                        Execution disabled by design. Sirf read-only account mapping save hota hai.
                    </div>

                    {saveError ? <div className="text-sm text-red-400">{saveError}</div> : null}
                    {saveOk ? <div className="text-sm text-green-400">{saveOk}</div> : null}

                    <div className="flex items-center justify-between">
                        <span className="text-neutral-300">Enable Read-only Bridge</span>
                        <button
                            type="button"
                            onClick={() => setPrefs({ ...prefs, fundedReadOnlyEnabled: !prefs.fundedReadOnlyEnabled })}
                            disabled={prefLoading}
                            className={`px-3 py-1.5 rounded-lg border text-sm ${prefs.fundedReadOnlyEnabled
                                ? 'bg-brand/20 border-brand/50 text-brand'
                                : 'bg-neutral-200/60 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 text-neutral-300'
                                } disabled:opacity-60`}
                        >
                            {prefs.fundedReadOnlyEnabled ? 'Enabled' : 'Disabled'}
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-neutral-300 mb-2">Provider</label>
                            <input
                                type="text"
                                value={prefs.fundedProvider}
                                onChange={(e) => setPrefs({ ...prefs, fundedProvider: e.target.value })}
                                disabled={prefLoading}
                                className="w-full px-3 py-2 bg-neutral-200/60 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:outline-none focus:border-brand disabled:opacity-60"
                                placeholder="Goat Funded Trader"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-neutral-300 mb-2">Terminal</label>
                            <select
                                value={prefs.fundedTerminalType}
                                onChange={(e) => setPrefs({ ...prefs, fundedTerminalType: e.target.value as 'mt4' | 'mt5' | 'other' })}
                                disabled={prefLoading}
                                className="w-full px-3 py-2 bg-neutral-200/60 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:outline-none focus:border-brand disabled:opacity-60"
                            >
                                <option value="mt5">MT5</option>
                                <option value="mt4">MT4</option>
                                <option value="other">Other</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm text-neutral-300 mb-2">Account ID</label>
                            <input
                                type="text"
                                value={prefs.fundedAccountId}
                                onChange={(e) => setPrefs({ ...prefs, fundedAccountId: e.target.value })}
                                disabled={prefLoading}
                                className="w-full px-3 py-2 bg-neutral-200/60 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:outline-none focus:border-brand disabled:opacity-60"
                                placeholder="e.g. 12345678"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-neutral-300 mb-2">Server</label>
                            <input
                                type="text"
                                value={prefs.fundedServer}
                                onChange={(e) => setPrefs({ ...prefs, fundedServer: e.target.value })}
                                disabled={prefLoading}
                                className="w-full px-3 py-2 bg-neutral-200/60 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:outline-none focus:border-brand disabled:opacity-60"
                                placeholder="e.g. Broker-Server-01"
                            />
                        </div>
                    </div>

                    <div className="text-xs text-neutral-500">
                        Password/API key yahan save nahi hota. Bridge token server side hi secure rehta hai.
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <GradientButton onClick={savePrefs} disabled={saving || prefLoading}>
                            {saving ? 'Saving...' : 'Save Funded Settings'}
                        </GradientButton>
                        <button
                            type="button"
                            onClick={loadPrefs}
                            disabled={saving}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-neutral-700 text-neutral-200 hover:bg-neutral-800/50 transition-colors disabled:opacity-60"
                        >
                            Reload Form
                        </button>
                    </div>
                </div>
            </AnimatedCard>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <AnimatedCard delay={0.08} className="p-4">
                    <div className="text-xs text-slate-400">Link Status</div>
                    <div className="mt-2 text-sm font-semibold inline-flex items-center gap-2">
                        {mappingReady ? <CheckCircle2 size={15} className="text-green-400" /> : <AlertTriangle size={15} className="text-amber-300" />}
                        {statusLabel}
                    </div>
                </AnimatedCard>

                <AnimatedCard delay={0.1} className="p-4">
                    <div className="text-xs text-slate-400">Provider / Terminal</div>
                    <div className="mt-2 text-sm font-semibold text-white">
                        {(funded?.provider || 'N/A')} / {String(funded?.terminalType || 'mt5').toUpperCase()}
                    </div>
                </AnimatedCard>

                <AnimatedCard delay={0.12} className="p-4">
                    <div className="text-xs text-slate-400">Total Synced Trades</div>
                    <div className="mt-2 text-xl font-bold text-cyan-300">{sync?.totalSynced ?? 0}</div>
                </AnimatedCard>

                <AnimatedCard delay={0.14} className="p-4">
                    <div className="text-xs text-slate-400">Last Sync</div>
                    <div className="mt-2 text-sm font-semibold text-white">{lastSyncLabel}</div>
                </AnimatedCard>
            </div>

            <AnimatedCard delay={0.18} className="p-4 md:p-5">
                <div className="flex items-center justify-between mb-3">
                    <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-200">
                        <Radio size={14} className="text-cyan-300" />
                        Recent Funded Imports
                    </div>
                    <div className="text-xs text-slate-400">Account: {funded?.accountId || 'N/A'} | Server: {funded?.server || 'N/A'}</div>
                </div>

                {loading ? (
                    <div className="text-sm text-slate-400 py-6">Loading funded sync data...</div>
                ) : recent.length > 0 ? (
                    <div className="space-y-2">
                        {recent.map((trade) => (
                            <div key={trade.externalTradeId || trade._id} className="flex items-center justify-between rounded-xl border border-neutral-800/80 px-3 py-2 text-xs">
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-slate-200">{trade.instrument || 'N/A'}</span>
                                    <span className={`px-1.5 py-0.5 rounded ${trade.direction === 'long' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                                        {String(trade.direction || 'na').toUpperCase()}
                                    </span>
                                </div>
                                <div className="text-slate-400">{trade.updatedAt ? new Date(trade.updatedAt).toLocaleString() : '-'}</div>
                                <div className={`font-semibold ${(trade.pnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {(trade.pnl || 0) >= 0 ? '+' : ''}${Number(trade.pnl || 0).toFixed(2)}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-sm text-slate-500 py-6">
                        No funded trades synced yet. Settings me funded account map karo, phir local MT5 bridge run karo.
                    </div>
                )}
            </AnimatedCard>

            <AnimatedCard delay={0.22} className="p-4 md:p-5">
                <div className="flex items-center justify-between mb-3">
                    <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-200">
                        <Radio size={14} className="text-emerald-300" />
                        Live Open Positions (Read-only)
                    </div>
                    <div className="text-xs text-slate-400">
                        Updated: {live?.updatedAt ? new Date(live.updatedAt).toLocaleString() : 'Never'}
                    </div>
                </div>

                {openPositions.length > 0 ? (
                    <div className="space-y-2">
                        {openPositions.map((pos) => (
                            <div key={pos.ticket} className="grid grid-cols-2 md:grid-cols-6 gap-2 rounded-xl border border-neutral-800/80 px-3 py-2 text-xs">
                                <div>
                                    <div className="text-slate-500">Symbol</div>
                                    <div className="font-semibold text-slate-200">{pos.symbol || 'N/A'}</div>
                                </div>
                                <div>
                                    <div className="text-slate-500">Direction</div>
                                    <div className={pos.direction === 'long' ? 'text-green-300 font-semibold' : 'text-red-300 font-semibold'}>
                                        {String(pos.direction || 'na').toUpperCase()}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-slate-500">Volume</div>
                                    <div className="text-slate-200">{Number(pos.volume || 0).toFixed(2)}</div>
                                </div>
                                <div>
                                    <div className="text-slate-500">Open / Current</div>
                                    <div className="text-slate-200">{Number(pos.openPrice || 0).toFixed(5)} / {Number(pos.currentPrice || 0).toFixed(5)}</div>
                                </div>
                                <div>
                                    <div className="text-slate-500">Floating PnL</div>
                                    <div className={(pos.unrealizedPnl || 0) >= 0 ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
                                        {(pos.unrealizedPnl || 0) >= 0 ? '+' : ''}${Number(pos.unrealizedPnl || 0).toFixed(2)}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-slate-500">Ticket</div>
                                    <div className="text-slate-300">{pos.ticket || '-'}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-sm text-slate-500 py-3">
                        No open positions right now. Jab bridge run hoga aur account me live position hogi, yahan auto show ho jayegi.
                    </div>
                )}
            </AnimatedCard>
        </div>
    )
}
