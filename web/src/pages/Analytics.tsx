import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import AnimatedCard from '../components/AnimatedCard'
import WinLossPie from '../components/charts/WinLossPie'
import PairPerformance from '../components/charts/PairPerformance'
import { api } from '../lib/api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function Analytics() {
    const [distributions, setDistributions] = useState<any>(null)
    const [ai, setAi] = useState<any>(null)
    const [aiLoading, setAiLoading] = useState(false)
    const [gpt, setGpt] = useState<any>(null)
    const [gptLoading, setGptLoading] = useState(false)

    useEffect(() => {
        const fetchData = async () => {
            try {
                const { data } = await api.get('/analytics/distributions')
                setDistributions(data)
            } catch (err) {
                console.error('Failed to fetch analytics:', err)
            }
        }
        fetchData()
    }, [])

    const pairData = distributions?.byPairPnL?.map((item: any) => ({
        pair: item.pair,
        profit: item.profit,
        loss: item.loss,
        net: item.net
    })) || []

    const outcomeData = distributions?.byOutcome?.map((item: any) => ({
        name: item.label === 'win' ? 'Wins' : item.label === 'loss' ? 'Losses' : 'Breakeven',
        value: item.value
    })) || []

    const refreshData = async () => {
        try {
            const { data } = await api.get('/analytics/distributions')
            setDistributions(data)
        } catch (err) {
            console.error('Failed to fetch analytics:', err)
        }
    }

    const fetchAiInsights = async () => {
        if (aiLoading) return
        setAiLoading(true)
        try {
            const { data } = await api.get('/analytics/ai-insights')
            setAi(data)
        } catch (err) {
            console.error('Failed to fetch AI insights:', err)
            alert('Failed to generate AI insights')
        } finally {
            setAiLoading(false)
        }
    }

    const fetchGptInsights = async () => {
        if (gptLoading) return
        setGptLoading(true)
        try {
            // Keep OpenAI usage minimal by default: fewer trades + no screenshots
            const { data } = await api.get('/analytics/gpt-insights?limit=30&images=false')
            setGpt(data)
        } catch (err: any) {
            const msg = err?.response?.data?.error || 'Failed to generate GPT insights'
            alert(msg)
        } finally {
            setGptLoading(false)
        }
    }

    const formatPct = (v: number) => `${Math.round((v || 0) * 100)}%`
    const formatMoney = (v: number) => {
        const n = typeof v === 'number' && Number.isFinite(v) ? v : 0
        const sign = n < 0 ? '-' : ''
        return `${sign}$${Math.abs(n).toFixed(2)}`
    }

    return (
        <div className="space-y-6">
            <motion.div
                className="flex items-center justify-between"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <div>
                    <h1 className="text-3xl font-bold mb-2">Analytics</h1>
                    <p className="text-neutral-400">Deep dive into your trading performance</p>
                </div>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <AnimatedCard delay={0.1}>
                    <h3 className="text-lg font-semibold mb-4">Win/Loss Distribution</h3>
                    <div className="h-80">
                        {outcomeData.length > 0 ? (
                            <WinLossPie data={outcomeData} />
                        ) : (
                            <div className="h-full flex items-center justify-center text-neutral-500">
                                <p>No outcome data yet</p>
                            </div>
                        )}
                    </div>
                </AnimatedCard>

                <AnimatedCard delay={0.2}>
                    <h3 className="text-lg font-semibold mb-4">Performance by Pair</h3>
                    <div className="h-80">
                        {pairData.length > 0 ? (
                            <PairPerformance data={pairData} />
                        ) : (
                            <div className="h-full flex items-center justify-center text-neutral-500">
                                <p>No pair data yet</p>
                            </div>
                        )}
                    </div>
                </AnimatedCard>

                <AnimatedCard delay={0.3} className="lg:col-span-2">
                    <h3 className="text-lg font-semibold mb-4">Trading Insights</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 bg-neutral-800/50 rounded-lg">
                            <div className="text-neutral-400 text-sm mb-1">Best Trading Session</div>
                            <div className="text-2xl font-bold">{distributions?.bySession?.[0]?.label || 'N/A'}</div>
                        </div>
                        <div className="p-4 bg-neutral-800/50 rounded-lg">
                            <div className="text-neutral-400 text-sm mb-1">Most Traded Pair</div>
                            <div className="text-2xl font-bold">{distributions?.byInstrument?.[0]?.label || 'N/A'}</div>
                        </div>
                        <div className="p-4 bg-neutral-800/50 rounded-lg">
                            <div className="text-neutral-400 text-sm mb-1">Total Trades</div>
                            <div className="text-2xl font-bold">
                                {(distributions?.byOutcome?.reduce((acc: number, item: any) => acc + item.value, 0)) || 0}
                            </div>
                        </div>
                    </div>
                </AnimatedCard>

                <AnimatedCard delay={0.35} className="lg:col-span-2">
                    <div className="flex items-center justify-between gap-4 mb-4">
                        <div>
                            <h3 className="text-lg font-semibold">AI Trade Analysis</h3>
                            <p className="text-neutral-400 text-sm">Find repeated mistakes + good habits from your journal</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={fetchAiInsights}
                                className="px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg hover:border-brand transition-colors"
                            >
                                {aiLoading ? 'Analyzing...' : 'Generate'}
                            </button>
                            <button
                                onClick={fetchGptInsights}
                                className="px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg hover:border-brand transition-colors"
                                title="Requires OPENAI_API_KEY on server"
                            >
                                {gptLoading ? 'GPT...' : 'GPT Analyze'}
                            </button>
                        </div>
                    </div>

                    {ai?.tradesAnalyzed ? (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                                <div className="p-4 bg-neutral-800/40 rounded-lg border border-neutral-800">
                                    <div className="text-neutral-400 text-xs mb-1">Trades analyzed</div>
                                    <div className="text-2xl font-bold">{ai.tradesAnalyzed}</div>
                                </div>
                                <div className="p-4 bg-neutral-800/40 rounded-lg border border-neutral-800">
                                    <div className="text-neutral-400 text-xs mb-1">Net P&L</div>
                                    <div className={`text-2xl font-bold ${(ai.summary?.netPnl || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                        {formatMoney(ai.summary?.netPnl)}
                                    </div>
                                </div>
                                <div className="p-4 bg-neutral-800/40 rounded-lg border border-neutral-800">
                                    <div className="text-neutral-400 text-xs mb-1">Win rate</div>
                                    <div className="text-2xl font-bold">{formatPct(ai.summary?.winRate)}</div>
                                </div>
                                <div className="p-4 bg-neutral-800/40 rounded-lg border border-neutral-800">
                                    <div className="text-neutral-400 text-xs mb-1">Avg RR</div>
                                    <div className="text-2xl font-bold">{(ai.summary?.avgRR || 0).toFixed(2)}</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div>
                                    <div className="font-semibold mb-2">Repeated mistakes</div>
                                    <div className="space-y-2">
                                        {(ai.repeatedMistakes || []).slice(0, 5).map((m: any) => (
                                            <div key={m.key} className="flex items-center justify-between bg-neutral-800/30 border border-neutral-800 rounded-lg px-3 py-2">
                                                <div className="text-sm text-neutral-200">{m.label}</div>
                                                <div className="text-sm text-neutral-400">{m.count} ({formatPct(m.rate)})</div>
                                            </div>
                                        ))}
                                        {(ai.repeatedMistakes || []).length === 0 && (
                                            <div className="text-neutral-500 text-sm">No recurring mistakes detected (from tracked rules)</div>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <div className="font-semibold mb-2">Good habits</div>
                                    <div className="space-y-2">
                                        {(ai.strengths || []).slice(0, 5).map((s: any) => (
                                            <div key={s.key} className="flex items-center justify-between bg-neutral-800/30 border border-neutral-800 rounded-lg px-3 py-2">
                                                <div className="text-sm text-neutral-200">{s.label}</div>
                                                <div className="text-sm text-neutral-400">{s.count} ({formatPct(s.rate)})</div>
                                            </div>
                                        ))}
                                        {(ai.strengths || []).length === 0 && (
                                            <div className="text-neutral-500 text-sm">No strengths detected yet</div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6">
                                <div className="font-semibold mb-2">Action points</div>
                                <div className="bg-neutral-800/30 border border-neutral-800 rounded-lg p-4 text-sm text-neutral-200 space-y-1">
                                    {(ai.recommendations || []).map((r: string, idx: number) => (
                                        <div key={idx}>• {r}</div>
                                    ))}
                                </div>
                            </div>

                            {(ai.charts?.mistakes?.length || 0) > 0 && (
                                <div className="mt-6">
                                    <div className="font-semibold mb-2">Mistake frequency</div>
                                    <div className="h-72">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={ai.charts.mistakes}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
                                                <XAxis dataKey="name" stroke="#888" tick={{ fill: '#888' }} interval={0} height={60} />
                                                <YAxis stroke="#888" tick={{ fill: '#888' }} allowDecimals={false} />
                                                <Tooltip
                                                    contentStyle={{
                                                        backgroundColor: '#171717',
                                                        border: '1px solid #404040',
                                                        borderRadius: '8px',
                                                        color: '#fff'
                                                    }}
                                                />
                                                <Bar dataKey="value" fill="#ef4444" radius={[8, 8, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-neutral-500 text-sm">Click Generate to analyze your latest trades.</div>
                    )}

                    {gpt?.result && (
                        <div className="mt-8">
                            <div className="font-semibold mb-2">GPT Summary</div>
                            <div className="bg-neutral-800/30 border border-neutral-800 rounded-lg p-4 text-sm text-neutral-200 space-y-3">
                                <div>
                                    <div className="text-neutral-400 text-xs mb-1">Model</div>
                                    <div>{gpt.model} • Trades: {gpt.tradesAnalyzed} • Images: {gpt.imagesUsed ?? 0}</div>
                                </div>

                                {gpt.result?.summary?.shortSummary && (
                                    <div>
                                        <div className="text-neutral-400 text-xs mb-1">Overall</div>
                                        <div>{gpt.result.summary.shortSummary}</div>
                                    </div>
                                )}

                                {(gpt.result?.actionPlan?.length || 0) > 0 && (
                                    <div>
                                        <div className="text-neutral-400 text-xs mb-1">Action Plan</div>
                                        <div className="space-y-1">
                                            {gpt.result.actionPlan.slice(0, 6).map((s: string, idx: number) => (
                                                <div key={idx}>• {s}</div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {(gpt.result?.repeatedMistakes?.length || 0) > 0 && (
                                    <div>
                                        <div className="text-neutral-400 text-xs mb-1">Top Mistakes</div>
                                        <div className="space-y-2">
                                            {gpt.result.repeatedMistakes.slice(0, 3).map((m: any, idx: number) => (
                                                <div key={idx} className="border border-neutral-800 rounded-md p-3 bg-neutral-900/30">
                                                    <div className="font-semibold">{m.title}</div>
                                                    {m.evidence && <div className="text-neutral-300">Evidence: {m.evidence}</div>}
                                                    {m.fix && <div className="text-neutral-200">Fix: {m.fix}</div>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </AnimatedCard>
            </div>
        </div>
    )
}
