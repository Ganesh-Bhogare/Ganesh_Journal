import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import AnimatedCard from '../components/AnimatedCard'
import { useTheme } from '../contexts/ThemeContext'
import { api } from '../lib/api'

export default function Settings() {
    const { theme, toggleTheme } = useTheme()

    const [saving, setSaving] = useState(false)
    const [prefLoading, setPrefLoading] = useState(true)
    const [error, setError] = useState<string>('')

    const [prefs, setPrefs] = useState({
        accountBalance: '',
        riskMode: 'percent' as 'percent' | 'fixed',
        riskPercent: '1',
        riskAmount: '',
        pipValuePerLot: '10',
        maxDailyLossAmount: '',
        maxDailyLossPercent: '',
        maxTradesPerDay: '',
        stopAfterLosses: '',
        enforcement: 'block' as 'warn' | 'block',

        fundedReadOnlyEnabled: false,
        fundedProvider: 'Goat Funded Trader',
        fundedTerminalType: 'mt5' as 'mt4' | 'mt5' | 'other',
        fundedAccountId: '',
        fundedServer: '',
        fundedExecutionEnabled: false,
    })

    const showRiskAmount = useMemo(() => prefs.riskMode === 'fixed', [prefs.riskMode])

    useEffect(() => {
        const load = async () => {
            try {
                const { data } = await api.get('/user/preferences')
                const p = data?.preferences || {}
                setPrefs({
                    accountBalance: p.accountBalance != null ? String(p.accountBalance) : '',
                    riskMode: (p.riskMode === 'fixed' ? 'fixed' : 'percent'),
                    riskPercent: p.riskPercent != null ? String(p.riskPercent) : '1',
                    riskAmount: p.riskAmount != null ? String(p.riskAmount) : '',
                    pipValuePerLot: p.pipValuePerLot != null ? String(p.pipValuePerLot) : '10',
                    maxDailyLossAmount: p.maxDailyLossAmount != null ? String(p.maxDailyLossAmount) : '',
                    maxDailyLossPercent: p.maxDailyLossPercent != null ? String(p.maxDailyLossPercent) : '',
                    maxTradesPerDay: p.maxTradesPerDay != null ? String(p.maxTradesPerDay) : '',
                    stopAfterLosses: p.stopAfterLosses != null ? String(p.stopAfterLosses) : '',
                    enforcement: (p.enforcement === 'warn' ? 'warn' : 'block'),

                    fundedReadOnlyEnabled: Boolean(p.fundedReadOnlyEnabled),
                    fundedProvider: p.fundedProvider != null ? String(p.fundedProvider) : 'Goat Funded Trader',
                    fundedTerminalType: (p.fundedTerminalType === 'mt4' || p.fundedTerminalType === 'other') ? p.fundedTerminalType : 'mt5',
                    fundedAccountId: p.fundedAccountId != null ? String(p.fundedAccountId) : '',
                    fundedServer: p.fundedServer != null ? String(p.fundedServer) : '',
                    fundedExecutionEnabled: false,
                })
            } catch (err) {
                console.error('Failed to load preferences', err)
            } finally {
                setPrefLoading(false)
            }
        }
        load()
    }, [])

    const savePrefs = async () => {
        if (saving) return
        setSaving(true)
        setError('')
        try {
            const payload: any = {
                accountBalance: prefs.accountBalance ? Number(prefs.accountBalance) : undefined,
                riskMode: prefs.riskMode,
                riskPercent: prefs.riskPercent ? Number(prefs.riskPercent) : undefined,
                riskAmount: prefs.riskAmount ? Number(prefs.riskAmount) : undefined,
                pipValuePerLot: prefs.pipValuePerLot ? Number(prefs.pipValuePerLot) : undefined,
                maxDailyLossAmount: prefs.maxDailyLossAmount ? Number(prefs.maxDailyLossAmount) : undefined,
                maxDailyLossPercent: prefs.maxDailyLossPercent ? Number(prefs.maxDailyLossPercent) : undefined,
                maxTradesPerDay: prefs.maxTradesPerDay ? Number(prefs.maxTradesPerDay) : undefined,
                stopAfterLosses: prefs.stopAfterLosses ? Number(prefs.stopAfterLosses) : undefined,
                enforcement: prefs.enforcement,

                fundedReadOnlyEnabled: prefs.fundedReadOnlyEnabled,
                fundedProvider: prefs.fundedProvider || undefined,
                fundedTerminalType: prefs.fundedTerminalType,
                fundedAccountId: prefs.fundedAccountId || undefined,
                fundedServer: prefs.fundedServer || undefined,
                // Always keep execution disabled in this phase.
                fundedExecutionEnabled: false,
            }

            // Remove undefined so backend can merge cleanly
            Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k])

            await api.put('/user/preferences', payload)
        } catch (err: any) {
            const msg = err?.response?.data?.error
            setError(typeof msg === 'string' ? msg : 'Failed to save preferences')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="space-y-6">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <h1 className="text-3xl font-bold mb-2">Settings</h1>
                <p className="text-neutral-400">Customize your trading journal experience</p>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <AnimatedCard delay={0.1}>
                    <h3 className="text-lg font-semibold mb-4">Appearance</h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-neutral-300">Theme</span>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={toggleTheme}
                                className="px-4 py-2 bg-neutral-200/70 dark:bg-neutral-800 rounded-lg border border-neutral-300 dark:border-neutral-700"
                            >
                                {theme === 'dark' ? 'Dark 🌙' : 'Light ☀️'}
                            </motion.button>
                        </div>
                    </div>
                </AnimatedCard>

                <AnimatedCard delay={0.2}>
                    <h3 className="text-lg font-semibold mb-4">Trading Preferences</h3>
                    <div className="space-y-4">
                        {prefLoading ? (
                            <div className="text-sm text-neutral-400">Loading…</div>
                        ) : (
                            <>
                                {error ? <div className="text-sm text-red-400">{error}</div> : null}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm text-neutral-300 mb-2">Account Balance ($)</label>
                                        <input
                                            type="number"
                                            value={prefs.accountBalance}
                                            onChange={(e) => setPrefs({ ...prefs, accountBalance: e.target.value })}
                                            className="w-full px-3 py-2 bg-neutral-200/60 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:outline-none focus:border-brand"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-neutral-300 mb-2">Sizing Mode</label>
                                        <select
                                            value={prefs.riskMode}
                                            onChange={(e) => setPrefs({ ...prefs, riskMode: e.target.value as any })}
                                            className="w-full px-3 py-2 bg-neutral-200/60 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:outline-none focus:border-brand"
                                        >
                                            <option value="percent">Percent</option>
                                            <option value="fixed">Fixed $</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm text-neutral-300 mb-2">Risk % per Trade</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={prefs.riskPercent}
                                            onChange={(e) => setPrefs({ ...prefs, riskPercent: e.target.value })}
                                            disabled={showRiskAmount}
                                            className="w-full px-3 py-2 bg-neutral-200/60 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:outline-none focus:border-brand disabled:opacity-50"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm text-neutral-300 mb-2">Risk Amount ($)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={prefs.riskAmount}
                                            onChange={(e) => setPrefs({ ...prefs, riskAmount: e.target.value })}
                                            disabled={!showRiskAmount}
                                            className="w-full px-3 py-2 bg-neutral-200/60 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:outline-none focus:border-brand disabled:opacity-50"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm text-neutral-300 mb-2">Pip Value / Lot ($)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={prefs.pipValuePerLot}
                                            onChange={(e) => setPrefs({ ...prefs, pipValuePerLot: e.target.value })}
                                            className="w-full px-3 py-2 bg-neutral-200/60 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:outline-none focus:border-brand"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm text-neutral-300 mb-2">Enforcement</label>
                                        <select
                                            value={prefs.enforcement}
                                            onChange={(e) => setPrefs({ ...prefs, enforcement: e.target.value as any })}
                                            className="w-full px-3 py-2 bg-neutral-200/60 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:outline-none focus:border-brand"
                                        >
                                            <option value="block">Block</option>
                                            <option value="warn">Warn</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm text-neutral-300 mb-2">Max Daily Loss ($)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={prefs.maxDailyLossAmount}
                                            onChange={(e) => setPrefs({ ...prefs, maxDailyLossAmount: e.target.value })}
                                            className="w-full px-3 py-2 bg-neutral-200/60 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:outline-none focus:border-brand"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm text-neutral-300 mb-2">Max Daily Loss (%)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={prefs.maxDailyLossPercent}
                                            onChange={(e) => setPrefs({ ...prefs, maxDailyLossPercent: e.target.value })}
                                            className="w-full px-3 py-2 bg-neutral-200/60 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:outline-none focus:border-brand"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm text-neutral-300 mb-2">Max Trades / Day</label>
                                        <input
                                            type="number"
                                            value={prefs.maxTradesPerDay}
                                            onChange={(e) => setPrefs({ ...prefs, maxTradesPerDay: e.target.value })}
                                            className="w-full px-3 py-2 bg-neutral-200/60 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:outline-none focus:border-brand"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm text-neutral-300 mb-2">Stop After Losses (per day)</label>
                                        <input
                                            type="number"
                                            value={prefs.stopAfterLosses}
                                            onChange={(e) => setPrefs({ ...prefs, stopAfterLosses: e.target.value })}
                                            className="w-full px-3 py-2 bg-neutral-200/60 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:outline-none focus:border-brand"
                                        />
                                    </div>
                                </div>

                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={savePrefs}
                                    disabled={saving}
                                    className="mt-2 w-full px-4 py-2 rounded-lg bg-brand/20 border border-brand/40 text-brand hover:bg-brand/25 disabled:opacity-50"
                                >
                                    {saving ? 'Saving…' : 'Save Preferences'}
                                </motion.button>
                            </>
                        )}
                    </div>
                </AnimatedCard>

                <AnimatedCard delay={0.3}>
                    <h3 className="text-lg font-semibold mb-4">Funded Account (Read-only)</h3>
                    <div className="space-y-4">
                        <div className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                            Execution is disabled by design. This stores only read-only terminal/account mapping for upcoming safe sync.
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-neutral-300">Enable Read-only Bridge</span>
                            <button
                                type="button"
                                onClick={() => setPrefs({ ...prefs, fundedReadOnlyEnabled: !prefs.fundedReadOnlyEnabled })}
                                className={`px-3 py-1.5 rounded-lg border text-sm ${prefs.fundedReadOnlyEnabled
                                    ? 'bg-brand/20 border-brand/50 text-brand'
                                    : 'bg-neutral-200/60 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 text-neutral-300'
                                    }`}
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
                                    className="w-full px-3 py-2 bg-neutral-200/60 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:outline-none focus:border-brand"
                                    placeholder="Goat Funded Trader"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-neutral-300 mb-2">Terminal</label>
                                <select
                                    value={prefs.fundedTerminalType}
                                    onChange={(e) => setPrefs({ ...prefs, fundedTerminalType: e.target.value as any })}
                                    className="w-full px-3 py-2 bg-neutral-200/60 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:outline-none focus:border-brand"
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
                                    className="w-full px-3 py-2 bg-neutral-200/60 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:outline-none focus:border-brand"
                                    placeholder="e.g. 12345678"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-neutral-300 mb-2">Server</label>
                                <input
                                    type="text"
                                    value={prefs.fundedServer}
                                    onChange={(e) => setPrefs({ ...prefs, fundedServer: e.target.value })}
                                    className="w-full px-3 py-2 bg-neutral-200/60 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:outline-none focus:border-brand"
                                    placeholder="e.g. Broker-Server-01"
                                />
                            </div>
                        </div>

                        <div className="text-xs text-neutral-500">
                            No password/API key is stored here. Keep execution disabled until guarded bridge module is implemented.
                        </div>

                        <div className="text-xs text-neutral-400 bg-neutral-900/40 border border-neutral-800 rounded-lg p-3 leading-relaxed">
                            Bridge endpoint for auto trade sync:
                            <div className="mt-1 font-mono text-[11px] break-all">POST /api/funded/sync-readonly</div>
                            <div className="mt-2">Header: <span className="font-mono">x-bridge-token: FUNDED_BRIDGE_TOKEN</span></div>
                            <div className="mt-1">Body includes: <span className="font-mono">accountId, server, provider, trades[]</span> (ticket, symbol, side, openTime, openPrice, closeTime, closePrice, volume, sl, tp, profit).</div>
                        </div>
                    </div>
                </AnimatedCard>
            </div>
        </div>
    )
}
