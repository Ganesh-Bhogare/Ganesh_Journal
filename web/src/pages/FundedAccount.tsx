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
    bridge?: {
        running?: boolean
        pid?: number | null
        mode?: 'once' | 'loop' | null
        startedAt?: string | null
        lastExitCode?: number | null
        lastOutput?: string
    }
    accounts?: Array<{
        accountId: string
        trades: number
        netPnl: number
        lastSyncedAt?: string | null
    }>
    selectedAccountId?: string | null
}

type FundedPrefs = {
    fundedReadOnlyEnabled: boolean
    fundedProvider: string
    fundedTerminalType: 'mt4' | 'mt5' | 'other'
    fundedAccountId: string
    fundedServer: string
    fundedMt5Login: string
    fundedMt5Password: string
    fundedMt5Path: string
    fundedBridgePollSeconds: string
    fundedBridgeLookbackDays: string
}

export default function FundedAccount() {
    const [data, setData] = useState<FundedStatusResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [prefLoading, setPrefLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState('')
    const [saveOk, setSaveOk] = useState('')
    const [bridgeBusy, setBridgeBusy] = useState(false)
    const [bridgeMsg, setBridgeMsg] = useState('')
    const [selectedAccountId, setSelectedAccountId] = useState('all')
    const [prefs, setPrefs] = useState<FundedPrefs>({
        fundedReadOnlyEnabled: false,
        fundedProvider: 'Goat Funded Trader',
        fundedTerminalType: 'mt5',
        fundedAccountId: '',
        fundedServer: '',
        fundedMt5Login: '',
        fundedMt5Password: '',
        fundedMt5Path: '',
        fundedBridgePollSeconds: '20',
        fundedBridgeLookbackDays: '3650',
    })

    const fetchStatus = async (accountId?: string) => {
        try {
            const params: any = {}
            if (accountId && accountId !== 'all') params.accountId = accountId
            const res = await api.get('/funded/status', { params })
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
                fundedMt5Login: p.fundedMt5Login != null ? String(p.fundedMt5Login) : '',
                fundedMt5Password: '',
                fundedMt5Path: p.fundedMt5Path != null ? String(p.fundedMt5Path) : '',
                fundedBridgePollSeconds: p.fundedBridgePollSeconds != null ? String(p.fundedBridgePollSeconds) : '20',
                fundedBridgeLookbackDays: p.fundedBridgeLookbackDays != null ? String(p.fundedBridgeLookbackDays) : '3650',
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
                fundedMt5Login: prefs.fundedMt5Login || undefined,
                fundedMt5Password: prefs.fundedMt5Password || undefined,
                fundedMt5Path: prefs.fundedMt5Path || undefined,
                fundedBridgePollSeconds: prefs.fundedBridgePollSeconds ? Number(prefs.fundedBridgePollSeconds) : undefined,
                fundedBridgeLookbackDays: prefs.fundedBridgeLookbackDays ? Number(prefs.fundedBridgeLookbackDays) : undefined,
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

    const persistPrefsForBridge = async (forceEnable = false) => {
        const payload = {
            fundedReadOnlyEnabled: forceEnable ? true : prefs.fundedReadOnlyEnabled,
            fundedProvider: prefs.fundedProvider || undefined,
            fundedTerminalType: prefs.fundedTerminalType,
            fundedAccountId: prefs.fundedAccountId || undefined,
            fundedServer: prefs.fundedServer || undefined,
            fundedMt5Login: prefs.fundedMt5Login || undefined,
            fundedMt5Password: prefs.fundedMt5Password || undefined,
            fundedMt5Path: prefs.fundedMt5Path || undefined,
            fundedBridgePollSeconds: prefs.fundedBridgePollSeconds ? Number(prefs.fundedBridgePollSeconds) : undefined,
            fundedBridgeLookbackDays: prefs.fundedBridgeLookbackDays ? Number(prefs.fundedBridgeLookbackDays) : undefined,
            fundedExecutionEnabled: false,
        } as Record<string, any>

        Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k])
        await api.put('/user/preferences', payload)

        if (forceEnable && !prefs.fundedReadOnlyEnabled) {
            setPrefs((prev) => ({ ...prev, fundedReadOnlyEnabled: true }))
        }
    }

    const startBridge = async (opts?: { once?: boolean; ignoreState?: boolean; backfillDays?: number }) => {
        if (bridgeBusy) return
        setBridgeBusy(true)
        setBridgeMsg('')
        try {
            await persistPrefsForBridge(true)

            const { data } = await api.post('/funded/bridge/start', {
                once: Boolean(opts?.once),
                ignoreState: Boolean(opts?.ignoreState),
                backfillDays: opts?.backfillDays,
            })
            setBridgeMsg(`Bridge started (${data?.mode || 'loop'})`)
            await fetchStatus(selectedAccountId)
        } catch (err: any) {
            const msg = err?.response?.data?.error
            setBridgeMsg(typeof msg === 'string' ? msg : 'Failed to start bridge')
        } finally {
            setBridgeBusy(false)
        }
    }

    const stopBridge = async () => {
        if (bridgeBusy) return
        setBridgeBusy(true)
        setBridgeMsg('')
        try {
            const { data } = await api.post('/funded/bridge/stop')
            setBridgeMsg(data?.stopped ? 'Bridge stopped' : 'Bridge was not running')
            await fetchStatus(selectedAccountId)
        } catch (err: any) {
            const msg = err?.response?.data?.error
            setBridgeMsg(typeof msg === 'string' ? msg : 'Failed to stop bridge')
        } finally {
            setBridgeBusy(false)
        }
    }

    useEffect(() => {
        loadPrefs()
    }, [])

    useEffect(() => {
        fetchStatus(selectedAccountId)

        // Keep funded panel live without forcing manual refresh.
        const id = window.setInterval(() => fetchStatus(selectedAccountId), 20000)
        return () => window.clearInterval(id)
    }, [selectedAccountId])

    const funded = data?.funded
    const sync = data?.sync
    const accountSummaries = Array.isArray(data?.accounts) ? data!.accounts : []
    const recent = Array.isArray(sync?.recent) ? sync?.recent : []
    const live = data?.live
    const bridge = data?.bridge
    const openPositions = Array.isArray(live?.openPositions) ? live.openPositions : []
    const mappingReady = Boolean(funded?.enabled && String(funded?.accountId || '').trim())

    const bridgeStatusHint = useMemo(() => {
        const out = String(bridge?.lastOutput || '').toLowerCase()
        if (bridge?.running) return 'Live sync chal raha hai.'
        if (!out && (sync?.totalSynced || 0) > 0) return 'Bridge stopped. Last sync successful.'
        if (out.includes('mt5 initialize failed')) return 'MT5 app open karo. Agar zarurat ho to MT5 Terminal Path fill karo.'
        if (out.includes('mt5 login failed')) return 'MT5 Login/Password/Server verify karo.'
        if (out.includes('sync failed (401)')) return 'Bridge auth failed. Server token/config check karo.'
        if (out.includes('no read-only linked user found')) return 'Account ID ya Server mapping mismatch hai.'
        if ((sync?.totalSynced || 0) === 0) return 'Backfill Now dabao to old trades import ho jayenge.'
        return 'Bridge stopped.'
    }, [bridge?.running, bridge?.lastOutput, sync?.totalSynced])

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
                        <select
                            value={selectedAccountId}
                            onChange={(e) => setSelectedAccountId(e.target.value)}
                            className="px-3 py-2 rounded-xl bg-neutral-800 border border-neutral-700 text-sm text-neutral-100 focus:outline-none"
                        >
                            <option value="all">All Accounts</option>
                            {accountSummaries.map((a) => (
                                <option key={a.accountId} value={a.accountId}>{a.accountId}</option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={() => fetchStatus(selectedAccountId)}
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
                        Execution disabled by design. Yahan credentials save karke UI se bridge start/stop/backfill kar sakte ho.
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

                        <div>
                            <label className="block text-sm text-neutral-300 mb-2">MT5 Login</label>
                            <input
                                type="text"
                                value={prefs.fundedMt5Login}
                                onChange={(e) => setPrefs({ ...prefs, fundedMt5Login: e.target.value })}
                                disabled={prefLoading}
                                className="w-full px-3 py-2 bg-neutral-200/60 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:outline-none focus:border-brand disabled:opacity-60"
                                placeholder="e.g. 314650897"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-neutral-300 mb-2">MT5 Password</label>
                            <input
                                type="password"
                                value={prefs.fundedMt5Password}
                                onChange={(e) => setPrefs({ ...prefs, fundedMt5Password: e.target.value })}
                                disabled={prefLoading}
                                className="w-full px-3 py-2 bg-neutral-200/60 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:outline-none focus:border-brand disabled:opacity-60"
                                placeholder="MT5 account password"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-neutral-300 mb-2">Bridge Poll Seconds</label>
                            <input
                                type="number"
                                min={5}
                                value={prefs.fundedBridgePollSeconds}
                                onChange={(e) => setPrefs({ ...prefs, fundedBridgePollSeconds: e.target.value })}
                                disabled={prefLoading}
                                className="w-full px-3 py-2 bg-neutral-200/60 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:outline-none focus:border-brand disabled:opacity-60"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-neutral-300 mb-2">Backfill Days</label>
                            <input
                                type="number"
                                min={1}
                                value={prefs.fundedBridgeLookbackDays}
                                onChange={(e) => setPrefs({ ...prefs, fundedBridgeLookbackDays: e.target.value })}
                                disabled={prefLoading}
                                className="w-full px-3 py-2 bg-neutral-200/60 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:outline-none focus:border-brand disabled:opacity-60"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm text-neutral-300 mb-2">MT5 Terminal Path (Optional)</label>
                            <input
                                type="text"
                                value={prefs.fundedMt5Path}
                                onChange={(e) => setPrefs({ ...prefs, fundedMt5Path: e.target.value })}
                                disabled={prefLoading}
                                className="w-full px-3 py-2 bg-neutral-200/60 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:outline-none focus:border-brand disabled:opacity-60"
                                placeholder="C:\\Program Files\\MetaTrader 5\\terminal64.exe"
                            />
                        </div>
                    </div>

                    <div className="text-xs text-neutral-500">
                        Bridge token server side secure rehta hai. Credentials ke baad Save karo, phir niche se bridge start/backfill karo.
                    </div>

                    {bridgeMsg ? <div className="text-sm text-cyan-300">{bridgeMsg}</div> : null}

                    <div className="text-xs text-slate-400 bg-slate-900/40 border border-slate-700/50 rounded-lg p-3">
                        Bridge Status: <span className={bridge?.running ? 'text-green-400' : 'text-amber-300'}>{bridge?.running ? 'Running' : 'Stopped'}</span>
                        <span className="text-slate-400"> | {bridgeStatusHint}</span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <GradientButton onClick={savePrefs} disabled={saving || prefLoading}>
                            {saving ? 'Saving...' : 'Save Funded Settings'}
                        </GradientButton>
                        <button
                            type="button"
                            onClick={() => startBridge({ once: false, ignoreState: false })}
                            disabled={bridgeBusy || saving || prefLoading}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-green-700 text-green-300 hover:bg-green-900/30 transition-colors disabled:opacity-60"
                        >
                            Start Live Sync
                        </button>
                        <button
                            type="button"
                            onClick={() => startBridge({ once: true, ignoreState: true, backfillDays: 3650 })}
                            disabled={bridgeBusy || saving || prefLoading}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-cyan-700 text-cyan-300 hover:bg-cyan-900/30 transition-colors disabled:opacity-60"
                        >
                            Backfill All History
                        </button>
                        <button
                            type="button"
                            onClick={stopBridge}
                            disabled={bridgeBusy || saving || prefLoading}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-red-700 text-red-300 hover:bg-red-900/30 transition-colors disabled:opacity-60"
                        >
                            Stop Bridge
                        </button>
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
                    <div className="text-xs text-slate-400">View: {selectedAccountId === 'all' ? 'All Accounts' : selectedAccountId} | Server: {funded?.server || 'N/A'}</div>
                </div>

                {accountSummaries.length > 0 && (
                    <div className="mb-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                        {accountSummaries.map((acc) => (
                            <button
                                key={acc.accountId}
                                type="button"
                                onClick={() => setSelectedAccountId(acc.accountId)}
                                className={`text-left rounded-lg border px-3 py-2 transition-colors ${selectedAccountId === acc.accountId
                                    ? 'border-cyan-500/70 bg-cyan-500/10'
                                    : 'border-neutral-800 bg-neutral-900/40 hover:border-neutral-700'}`}
                            >
                                <div className="text-xs text-slate-400">{acc.accountId}</div>
                                <div className="text-sm text-slate-200">Trades: {acc.trades}</div>
                                <div className={`text-xs ${(acc.netPnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    Net: {(acc.netPnl || 0) >= 0 ? '+' : ''}${Number(acc.netPnl || 0).toFixed(2)}
                                </div>
                            </button>
                        ))}
                    </div>
                )}

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
