import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import AnimatedCard from '../components/AnimatedCard'
import { api } from '../lib/api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

function formatMoney(v: any) {
    const n = typeof v === 'number' && Number.isFinite(v) ? v : Number(v)
    const x = Number.isFinite(n) ? n : 0
    const sign = x < 0 ? '-' : ''
    return `${sign}$${Math.abs(x).toFixed(2)}`
}

function formatMetric(v: any, decimals = 2) {
    if (v === null || v === undefined || v === '') return '-'
    const s = String(v)
    const n = typeof v === 'number' ? v : Number(s)
    if (Number.isFinite(n)) {
        const rounded = Math.round(n * Math.pow(10, decimals)) / Math.pow(10, decimals)
        const fixed = rounded.toFixed(decimals)
        return fixed.replace(/\.00$/, '').replace(/(\.\d*[1-9])0+$/, '$1')
    }
    return s
}

export default function AITradeAnalysis() {
    const [diagnostics, setDiagnostics] = useState<any>(null)
    const [diagnosticsLoading, setDiagnosticsLoading] = useState(false)

    const [autoResult, setAutoResult] = useState<any>(null)
    const [autoLoading, setAutoLoading] = useState(false)

    const [loading, setLoading] = useState(true)

    const loadDiagnostics = async () => {
        if (diagnosticsLoading) return
        setDiagnosticsLoading(true)
        try {
            const { data } = await api.get('/analytics/ai-insights?limit=400')
            setDiagnostics(data)
        } catch (err: any) {
            const msg = err?.response?.data?.error || 'Failed to load diagnostics'
            alert(msg)
        } finally {
            setDiagnosticsLoading(false)
            setLoading(false)
        }
    }

    const autoTradeAnalysis = async () => {
        if (autoLoading) return
        setAutoLoading(true)
        try {
            const { data } = await api.get('/analytics/auto-trade-analysis?limit=2000')
            setAutoResult(data)
        } catch (err: any) {
            const msg = err?.response?.data?.error || 'Failed to compute auto trade analysis'
            alert(msg)
        } finally {
            setAutoLoading(false)
        }
    }

    useEffect(() => {
        const boot = async () => {
            await loadDiagnostics()
            await autoTradeAnalysis()
        }
        boot()
        // run once on mount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const playbook = useMemo(() => {
        const topMistake = (diagnostics?.repeatedMistakes || [])[0]
        const secondMistake = (diagnostics?.repeatedMistakes || [])[1]
        const topStrength = (diagnostics?.strengths || [])[0]
        const bestSetup = (diagnostics?.setupPerformance || [])[0]

        const rules = [] as string[]

        if (topMistake) {
            rules.push(`Primary fix: ${topMistake.label} ko reduce karo (currently ${formatMetric((topMistake.rate || 0) * 100, 0)}%).`)
        }
        if (secondMistake) {
            rules.push(`Secondary fix: ${secondMistake.label} ko pre-trade checklist me mandatory karo.`)
        }
        if (topStrength) {
            rules.push(`Keep edge: ${topStrength.label} repeat karo (${formatMetric((topStrength.rate || 0) * 100, 0)}% consistency).`)
        }
        if (bestSetup?.setup) {
            rules.push(`A-setups only: ${bestSetup.setup} pe focus karo (${bestSetup.trades} trades, expectancy ${formatMoney(bestSetup.expectancy)}).`)
        }

        return {
            rules,
            leakEstimate: (diagnostics?.repeatedMistakes || [])
                .slice(0, 3)
                .reduce((sum: number, m: any) => sum + (Number(m?.estimatedLeak) || 0), 0),
        }
    }, [diagnostics])

    if (loading) {
        return <div className="text-neutral-400">Loading diagnostics...</div>
    }

    return (
        <div className="space-y-6">
            <motion.div
                className="flex items-center justify-between"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
            >
                <div>
                    <h1 className="text-3xl font-bold mb-2">Trade Diagnostics</h1>
                    <p className="text-neutral-400">Rule-based performance diagnostics with practical next actions.</p>
                </div>
                <button
                    onClick={loadDiagnostics}
                    className="px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg hover:border-brand transition-colors"
                >
                    {diagnosticsLoading ? 'Refreshing...' : 'Refresh Diagnostics'}
                </button>
            </motion.div>

            <AnimatedCard delay={0.03}>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="bg-neutral-800/30 border border-neutral-800 rounded-lg p-3">
                        <div className="text-neutral-400 text-xs">Trades analyzed</div>
                        <div className="text-xl font-semibold mt-1">{diagnostics?.tradesAnalyzed || 0}</div>
                    </div>
                    <div className="bg-neutral-800/30 border border-neutral-800 rounded-lg p-3">
                        <div className="text-neutral-400 text-xs">Net P&L</div>
                        <div className={`text-xl font-semibold mt-1 ${(diagnostics?.summary?.netPnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {formatMoney(diagnostics?.summary?.netPnl)}
                        </div>
                    </div>
                    <div className="bg-neutral-800/30 border border-neutral-800 rounded-lg p-3">
                        <div className="text-neutral-400 text-xs">Win Rate</div>
                        <div className="text-xl font-semibold mt-1">{formatMetric((diagnostics?.summary?.winRate || 0) * 100, 1)}%</div>
                    </div>
                    <div className="bg-neutral-800/30 border border-neutral-800 rounded-lg p-3">
                        <div className="text-neutral-400 text-xs">Avg RR</div>
                        <div className="text-xl font-semibold mt-1">{formatMetric(diagnostics?.summary?.avgRR || 0, 2)}</div>
                    </div>
                </div>
            </AnimatedCard>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <AnimatedCard delay={0.06}>
                    <div className="font-semibold mb-3">Top Mistakes</div>
                    <div className="space-y-2">
                        {(diagnostics?.repeatedMistakes || []).slice(0, 5).map((m: any) => (
                            <div key={m.key} className="bg-neutral-800/30 border border-neutral-800 rounded-lg px-3 py-2 flex items-center justify-between">
                                <div>
                                    <div className="text-sm text-neutral-200">{m.label}</div>
                                    <div className="text-[11px] text-neutral-400">Confidence: {formatMetric((m.confidence || 0) * 100, 0)}%</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm text-neutral-300">{m.count} ({formatMetric((m.rate || 0) * 100, 0)}%)</div>
                                    <div className="text-xs text-red-300">Leak: {formatMoney(m.estimatedLeak)}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </AnimatedCard>

                <AnimatedCard delay={0.08}>
                    <div className="font-semibold mb-3">Actionable Playbook (New)</div>
                    <div className="space-y-2 text-sm text-neutral-200">
                        {(playbook.rules || []).length ? (
                            playbook.rules.map((rule, i) => (
                                <div key={i} className="bg-neutral-800/30 border border-neutral-800 rounded-lg px-3 py-2">• {rule}</div>
                            ))
                        ) : (
                            <div className="text-neutral-500">Not enough data yet. Add more trades for a stronger playbook.</div>
                        )}
                    </div>
                    <div className="mt-3 text-xs text-neutral-400">
                        Estimated leak (top-3 mistakes): <span className="text-red-300 font-semibold">{formatMoney(playbook.leakEstimate)}</span>
                    </div>
                </AnimatedCard>
            </div>

            <AnimatedCard delay={0.1}>
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h3 className="text-lg font-semibold">Automatic Trade Analysis</h3>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                            Best pairs/sessions/setups and repeatable patterns from full journal history.
                        </p>
                    </div>
                    <button
                        onClick={autoTradeAnalysis}
                        disabled={autoLoading}
                        className="px-4 py-2 rounded-lg bg-brand/20 border border-brand/40 text-brand hover:bg-brand/25 disabled:opacity-50"
                    >
                        {autoLoading ? 'Analyzing…' : 'Recompute'}
                    </button>
                </div>

                {autoResult ? (
                    <div className="mt-6 space-y-6">
                        {Array.isArray(autoResult?.patterns) && autoResult.patterns.length ? (
                            <div className="p-4 rounded-xl border border-neutral-200/60 dark:border-neutral-800/70 bg-neutral-50/60 dark:bg-neutral-900/30">
                                <div className="font-medium mb-2">Patterns</div>
                                <ul className="list-disc pl-5 space-y-1 text-sm text-neutral-700 dark:text-neutral-300">
                                    {autoResult.patterns.map((p: any, i: number) => (
                                        <li key={p?.key || i}>{String(p?.message || '')}</li>
                                    ))}
                                </ul>
                            </div>
                        ) : null}

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="p-4 rounded-xl border border-blue-900/70 bg-[#0b162e]/80">
                                <div className="font-medium mb-2">Best Pairs</div>
                                <div className="h-56">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={(autoResult.bestPairs || []).slice(0, 6)}>
                                            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                                            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-20} height={50} />
                                            <YAxis tick={{ fontSize: 10 }} />
                                            <Tooltip />
                                            <Bar dataKey="netPnl" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="p-4 rounded-xl border border-blue-900/70 bg-[#0b162e]/80">
                                <div className="font-medium mb-2">Best Sessions</div>
                                <div className="h-56">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={(autoResult.bestSessions || []).slice(0, 5)}>
                                            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                                            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-20} height={50} />
                                            <YAxis tick={{ fontSize: 10 }} />
                                            <Tooltip />
                                            <Bar dataKey="winRate" fill="#22d3ee" radius={[6, 6, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="p-4 rounded-xl border border-blue-900/70 bg-[#0b162e]/80">
                                <div className="font-medium mb-2">Best Setups</div>
                                <div className="h-56">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={(autoResult.bestSetups || []).slice(0, 6)}>
                                            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                                            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-20} height={50} />
                                            <YAxis tick={{ fontSize: 10 }} />
                                            <Tooltip />
                                            <Bar dataKey="netPnl" fill="#2563eb" radius={[6, 6, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        <div className="text-xs text-neutral-500 dark:text-neutral-400">
                            Trades analyzed: {autoResult.tradesAnalyzed ?? '-'}
                        </div>
                    </div>
                ) : (
                    <div className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
                        Computing automatic analysis...
                    </div>
                )}
            </AnimatedCard>
        </div>
    )
}
