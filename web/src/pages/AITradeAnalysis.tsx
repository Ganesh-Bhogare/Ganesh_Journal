import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import AnimatedCard from '../components/AnimatedCard'
import { api } from '../lib/api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const PIE_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#6b7280', '#a855f7']

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
        // Round to avoid floating point precision issues, then format
        const rounded = Math.round(n * Math.pow(10, decimals)) / Math.pow(10, decimals)
        const fixed = rounded.toFixed(decimals)
        return fixed.replace(/\.00$/, '').replace(/(\.\d*[1-9])0+$/, '$1')
    }
    return s
}

export default function AITradeAnalysis() {
    const [searchParams] = useSearchParams()
    const [trades, setTrades] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    const [selectedTradeId, setSelectedTradeId] = useState<string>('')
    const [tradeResult, setTradeResult] = useState<any>(null)
    const [tradeLoading, setTradeLoading] = useState(false)

    const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])
    const [chatInput, setChatInput] = useState('')
    const [chatLoading, setChatLoading] = useState(false)

    const [weeklyResult, setWeeklyResult] = useState<any>(null)
    const [weeklyLoading, setWeeklyLoading] = useState(false)

    const [allTradesResult, setAllTradesResult] = useState<any>(null)
    const [allTradesLoading, setAllTradesLoading] = useState(false)

    const [autoResult, setAutoResult] = useState<any>(null)
    const [autoLoading, setAutoLoading] = useState(false)

    useEffect(() => {
        const boot = async () => {
            try {
                const [{ data: t }] = await Promise.all([
                    api.get('/trades?limit=500'),
                ])
                setTrades(t.items || [])
            } catch (err) {
                console.error('Failed to load AI analysis data:', err)
            } finally {
                setLoading(false)
            }
        }
        boot()
    }, [])

    useEffect(() => {
        const qpTradeId = searchParams.get('tradeId')
        if (qpTradeId && trades.some((t) => t._id === qpTradeId)) {
            setSelectedTradeId(qpTradeId)
            return
        }
        if (!selectedTradeId && trades.length) setSelectedTradeId(trades[0]._id)
    }, [trades, selectedTradeId, searchParams])

    const analyzeTrade = async () => {
        if (!selectedTradeId || tradeLoading) return
        setTradeLoading(true)
        setTradeResult(null)
        try {
            // Keep OpenAI usage minimal by default (images increase cost)
            const { data } = await api.post('/ai/analyze-trade', { tradeId: selectedTradeId, includeImages: true })
            setTradeResult(data)
        } catch (err: any) {
            const msg = err?.response?.data?.error || 'Failed to analyze trade'
            alert(msg)
        } finally {
            setTradeLoading(false)
        }
    }

    const sendChat = async () => {
        const text = chatInput.trim()
        if (!selectedTradeId || !text || chatLoading) return

        const nextHistory = [...chatMessages, { role: 'user' as const, content: text }]
        setChatMessages(nextHistory)
        setChatInput('')
        setChatLoading(true)

        try {
            const { data } = await api.post('/ai/chat-trade', {
                tradeId: selectedTradeId,
                message: text,
                history: nextHistory.slice(-12),
                includeImages: true,
            })

            const reply = data?.result?.reply || (typeof data?.result === 'string' ? data.result : '')
            setChatMessages((prev) => [...prev, { role: 'assistant', content: String(reply || 'No reply') }])
        } catch (err: any) {
            const msg = err?.response?.data?.error || 'Failed to chat'
            setChatMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${msg}` }])
        } finally {
            setChatLoading(false)
        }
    }

    const weeklyReview = async () => {
        if (weeklyLoading) return
        setWeeklyLoading(true)
        setWeeklyResult(null)
        try {
            const { data } = await api.post('/ai/weekly-review', { includeImages: true })
            setWeeklyResult(data)
        } catch (err: any) {
            const msg = err?.response?.data?.error || 'Failed to generate weekly review'
            alert(msg)
        } finally {
            setWeeklyLoading(false)
        }
    }

    const autoTradeAnalysis = async () => {
        if (autoLoading) return
        setAutoLoading(true)
        setAutoResult(null)
        try {
            const { data } = await api.get('/analytics/auto-trade-analysis?limit=800')
            setAutoResult(data)
        } catch (err: any) {
            const msg = err?.response?.data?.error || 'Failed to compute auto trade analysis'
            alert(msg)
        } finally {
            setAutoLoading(false)
        }
    }

    const allTradesReport = async () => {
        if (allTradesLoading) return
        setAllTradesLoading(true)
        setAllTradesResult(null)
        try {
            const { data } = await api.post('/ai/all-trades-report', { includeImages: true })
            setAllTradesResult(data)
        } catch (err: any) {
            const msg = err?.response?.data?.error || 'Failed to generate all-trades report'
            alert(msg)
        } finally {
            setAllTradesLoading(false)
        }
    }

    if (loading) {
        return <div className="text-neutral-400">Loading AI analysis...</div>
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
                    <h1 className="text-3xl font-bold mb-2">AI Trade Analysis</h1>
                    <p className="text-neutral-400">GPT-powered coaching in a visual report format (no signals)</p>
                </div>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <AnimatedCard delay={0.05}>
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <h3 className="text-lg font-semibold">Single Trade AI Analysis</h3>
                        <button
                            onClick={analyzeTrade}
                            className="px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg hover:border-brand transition-colors"
                        >
                            {tradeLoading ? 'Analyzing...' : 'Analyze with AI'}
                        </button>
                    </div>

                    <div className="flex gap-3 mb-4">
                        <select
                            value={selectedTradeId}
                            onChange={(e) => setSelectedTradeId(e.target.value)}
                            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none"
                        >
                            {trades.map((t) => (
                                <option key={t._id} value={t._id}>
                                    {t.instrument} • {t.direction} • {new Date(t.date).toLocaleDateString()} • {formatMoney(t.pnl)}
                                </option>
                            ))}
                        </select>
                    </div>

                    {tradeResult?.result ? (
                        <div className="space-y-3">
                            {!tradeResult.ok && (
                                <div className="text-amber-400 text-sm">GPT response didn’t match strict format perfectly. Showing best-effort output.</div>
                            )}
                            {tradeResult.result.verdict ? (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="bg-neutral-800/30 border border-neutral-800 rounded-lg p-4">
                                            <div className="text-neutral-400 text-xs mb-1">Verdict</div>
                                            <div className="text-2xl font-bold">{tradeResult.result.verdict}</div>
                                        </div>
                                        <div className="bg-neutral-800/30 border border-neutral-800 rounded-lg p-4">
                                            <div className="text-neutral-400 text-xs mb-1">Primary Failure</div>
                                            <div className="text-lg font-semibold">{tradeResult.result.primaryFailure || '-'}</div>
                                        </div>
                                    </div>

                                    {tradeResult.result.metrics && (
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            <AnimatedCard delay={0.05}>
                                                <div className="flex items-start justify-between gap-4">
                                                    <div>
                                                        <h3 className="text-lg font-semibold">Automatic Trade Analysis</h3>
                                                        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                                                            Data-driven insights from your trade history (best pairs/sessions/setups + patterns).
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={autoTradeAnalysis}
                                                        disabled={autoLoading}
                                                        className="px-4 py-2 rounded-lg bg-brand/20 border border-brand/40 text-brand hover:bg-brand/25 disabled:opacity-50"
                                                    >
                                                        {autoLoading ? 'Analyzing…' : 'Generate'}
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
                                                            <div className="p-4 rounded-xl border border-neutral-200/60 dark:border-neutral-800/70 bg-white/60 dark:bg-neutral-900/20">
                                                                <div className="font-medium mb-2">Best Pairs</div>
                                                                <div className="h-56">
                                                                    <ResponsiveContainer width="100%" height="100%">
                                                                        <BarChart data={(autoResult.bestPairs || []).slice(0, 6)}>
                                                                            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                                                                            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-20} height={50} />
                                                                            <YAxis tick={{ fontSize: 10 }} />
                                                                            <Tooltip />
                                                                            <Bar dataKey="netPnl" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                                                                        </BarChart>
                                                                    </ResponsiveContainer>
                                                                </div>
                                                            </div>

                                                            <div className="p-4 rounded-xl border border-neutral-200/60 dark:border-neutral-800/70 bg-white/60 dark:bg-neutral-900/20">
                                                                <div className="font-medium mb-2">Best Sessions</div>
                                                                <div className="h-56">
                                                                    <ResponsiveContainer width="100%" height="100%">
                                                                        <BarChart data={(autoResult.bestSessions || []).slice(0, 5)}>
                                                                            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                                                                            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-20} height={50} />
                                                                            <YAxis tick={{ fontSize: 10 }} />
                                                                            <Tooltip />
                                                                            <Bar dataKey="winRate" fill="#22c55e" radius={[6, 6, 0, 0]} />
                                                                        </BarChart>
                                                                    </ResponsiveContainer>
                                                                </div>
                                                                <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">Win rate (0–1)</div>
                                                            </div>

                                                            <div className="p-4 rounded-xl border border-neutral-200/60 dark:border-neutral-800/70 bg-white/60 dark:bg-neutral-900/20">
                                                                <div className="font-medium mb-2">Best Setups</div>
                                                                <div className="h-56">
                                                                    <ResponsiveContainer width="100%" height="100%">
                                                                        <BarChart data={(autoResult.bestSetups || []).slice(0, 6)}>
                                                                            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                                                                            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-20} height={50} />
                                                                            <YAxis tick={{ fontSize: 10 }} />
                                                                            <Tooltip />
                                                                            <Bar dataKey="netPnl" fill="#a855f7" radius={[6, 6, 0, 0]} />
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
                                                        Click Generate to analyze your history.
                                                    </div>
                                                )}
                                            </AnimatedCard>

                                            <div className="bg-neutral-800/30 border border-neutral-800 rounded-lg p-4">
                                                <div className="text-neutral-400 text-xs mb-1">Planned RR</div>
                                                <div className="text-lg font-semibold tabular-nums">{formatMetric(tradeResult.result.metrics.plannedRR)}</div>
                                            </div>
                                            <div className="bg-neutral-800/30 border border-neutral-800 rounded-lg p-4">
                                                <div className="text-neutral-400 text-xs mb-1">Achieved R</div>
                                                <div className="text-lg font-semibold tabular-nums">{formatMetric(tradeResult.result.metrics.achievedR)}</div>
                                            </div>
                                            <div className="bg-neutral-800/30 border border-neutral-800 rounded-lg p-4">
                                                <div className="text-neutral-400 text-xs mb-1">P&L</div>
                                                <div className="text-lg font-semibold tabular-nums">{formatMetric(tradeResult.result.metrics.pnl)}</div>
                                            </div>
                                        </div>
                                    )}

                                    {Array.isArray(tradeResult.result.evidence) && tradeResult.result.evidence.length > 0 && (
                                        <div className="bg-neutral-800/30 border border-neutral-800 rounded-lg p-4">
                                            <div className="text-neutral-400 text-xs mb-2">Evidence (specific)</div>
                                            <div className="space-y-1 text-sm leading-relaxed text-neutral-200 break-words">
                                                {tradeResult.result.evidence.map((v: string, i: number) => (
                                                    <div key={i}>• {v}</div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {Array.isArray(tradeResult.result.deviations) && tradeResult.result.deviations.length > 0 && (
                                        <div className="bg-neutral-800/30 border border-neutral-800 rounded-lg p-4">
                                            <div className="text-neutral-400 text-xs mb-2">Deviations (plan vs execution)</div>
                                            <div className="space-y-1 text-sm leading-relaxed text-neutral-200 break-words">
                                                {tradeResult.result.deviations.map((v: string, i: number) => (
                                                    <div key={i}>• {v}</div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="bg-neutral-800/30 border border-neutral-800 rounded-lg p-4">
                                            <div className="text-neutral-400 text-xs mb-1">Rule To Add</div>
                                            <div className="text-sm leading-relaxed text-neutral-200 whitespace-pre-wrap break-words">{tradeResult.result.ruleToAdd || '-'}</div>
                                        </div>
                                        <div className="bg-neutral-800/30 border border-neutral-800 rounded-lg p-4">
                                            <div className="text-neutral-400 text-xs mb-1">Next Time Action</div>
                                            <div className="text-sm leading-relaxed text-neutral-200 whitespace-pre-wrap break-words">{tradeResult.result.nextTimeAction || '-'}</div>
                                        </div>
                                    </div>

                                    <div className="bg-neutral-800/30 border border-neutral-800 rounded-lg p-4">
                                        <div className="flex items-center justify-between gap-3 mb-2">
                                            <div>
                                                <div className="text-neutral-200 font-semibold">Trade Chat (Selected Trade)</div>
                                                <div className="text-neutral-400 text-xs">Ask follow-ups about execution (no signals/predictions)</div>
                                            </div>
                                            <button
                                                onClick={() => setChatMessages([])}
                                                className="px-3 py-2 text-sm bg-neutral-900 border border-neutral-800 rounded-lg hover:border-neutral-700 transition-colors"
                                                disabled={chatLoading}
                                            >
                                                Clear
                                            </button>
                                        </div>

                                        <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                                            {chatMessages.length === 0 ? (
                                                <div className="text-neutral-500 text-sm">Ask: “Where exactly did I violate the plan?” or “What should I change next time?”</div>
                                            ) : (
                                                chatMessages.map((m, idx) => (
                                                    <div
                                                        key={idx}
                                                        className={
                                                            m.role === 'user'
                                                                ? 'bg-neutral-900 border border-neutral-800 rounded-lg p-3 text-sm text-neutral-200 break-words'
                                                                : 'bg-neutral-900/40 border border-neutral-800 rounded-lg p-3 text-sm text-neutral-200 break-words'
                                                        }
                                                    >
                                                        <div className="text-xs text-neutral-500 mb-1">{m.role === 'user' ? 'You' : 'Coach'}</div>
                                                        <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
                                                    </div>
                                                ))
                                            )}
                                        </div>

                                        <div className="flex gap-2 mt-3">
                                            <textarea
                                                value={chatInput}
                                                onChange={(e) => setChatInput(e.target.value)}
                                                rows={2}
                                                className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg focus:outline-none text-sm text-neutral-200 resize-none"
                                                placeholder="Ask a follow-up about this trade..."
                                            />
                                            <button
                                                onClick={sendChat}
                                                className="px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg hover:border-brand transition-colors text-sm"
                                                disabled={chatLoading || !chatInput.trim()}
                                            >
                                                {chatLoading ? 'Sending...' : 'Send'}
                                            </button>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="bg-neutral-800/30 border border-neutral-800 rounded-lg p-4">
                                        <div className="text-neutral-400 text-xs mb-1">Execution Grade</div>
                                        <div className="text-2xl font-bold">{tradeResult.result.executionGrade || '-'}</div>
                                    </div>
                                    <div className="bg-neutral-800/30 border border-neutral-800 rounded-lg p-4">
                                        <div className="text-neutral-400 text-xs mb-1">Trade Summary</div>
                                        <div className="text-sm text-neutral-200 whitespace-pre-wrap">{tradeResult.result.summary || tradeResult.result.raw}</div>
                                    </div>
                                    <div className="bg-neutral-800/30 border border-neutral-800 rounded-lg p-4">
                                        <div className="text-neutral-400 text-xs mb-1">Technical Assessment (ICT)</div>
                                        <div className="text-sm text-neutral-200 whitespace-pre-wrap">{tradeResult.result.technicalAssessment || '-'}</div>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="text-neutral-500 text-sm">Select a trade and click “Analyze with AI”.</div>
                    )}
                </AnimatedCard>

                <AnimatedCard delay={0.1}>
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <h3 className="text-lg font-semibold">Weekly AI Review</h3>
                        <button
                            onClick={weeklyReview}
                            className="px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg hover:border-brand transition-colors"
                        >
                            {weeklyLoading ? 'Reviewing...' : 'Weekly AI Review'}
                        </button>
                    </div>

                    {weeklyResult?.result ? (
                        <div className="space-y-3">
                            {!weeklyResult.ok && (
                                <div className="text-amber-400 text-sm">GPT response didn’t match strict format perfectly. Showing best-effort output.</div>
                            )}
                            {weeklyResult.result.ruleToEnforce ? (
                                <>
                                    {weeklyResult.stats?.avoidableVsValidLosses && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div className="bg-neutral-800/30 border border-neutral-800 rounded-lg p-4">
                                                <div className="text-neutral-400 text-xs mb-1">Avoidable loss rate</div>
                                                <div className="text-2xl font-bold">{weeklyResult.stats.avoidableVsValidLosses.avoidableLossRatePct}%</div>
                                            </div>
                                            <div className="bg-neutral-800/30 border border-neutral-800 rounded-lg p-4">
                                                <div className="text-neutral-400 text-xs mb-1">Avg R (rules followed vs broken)</div>
                                                <div className="text-sm text-neutral-200">Followed: <span className="font-semibold">{weeklyResult.stats.avgR?.ruleFollowed}</span> • Broken: <span className="font-semibold">{weeklyResult.stats.avgR?.ruleBroken}</span></div>
                                            </div>
                                        </div>
                                    )}
                                    <div className="bg-neutral-800/30 border border-neutral-800 rounded-lg p-4">
                                        <div className="text-neutral-400 text-xs mb-1">Rule to enforce</div>
                                        <div className="text-lg font-semibold">{weeklyResult.result.ruleToEnforce}</div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="bg-neutral-800/30 border border-neutral-800 rounded-lg p-4">
                                            <div className="text-neutral-400 text-xs mb-1">Most repeated mistake</div>
                                            <div className="text-sm text-neutral-200 whitespace-pre-wrap">{weeklyResult.result.mostRepeatedMistake}</div>
                                        </div>
                                        <div className="bg-neutral-800/30 border border-neutral-800 rounded-lg p-4">
                                            <div className="text-neutral-400 text-xs mb-1">Strongest edge</div>
                                            <div className="text-sm text-neutral-200 whitespace-pre-wrap">{weeklyResult.result.strongestEdge}</div>
                                        </div>
                                    </div>
                                    <div className="bg-neutral-800/30 border border-neutral-800 rounded-lg p-4">
                                        <div className="text-neutral-400 text-xs mb-2">Strict rules for next week</div>
                                        <div className="space-y-1 text-sm text-neutral-200">
                                            {(weeklyResult.result.strictRulesForNextWeek || []).map((r: string, i: number) => (
                                                <div key={i}>• {r}</div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="bg-neutral-800/30 border border-neutral-800 rounded-lg p-4">
                                            <div className="text-neutral-400 text-xs mb-1">Best Session</div>
                                            <div className="text-lg font-semibold">{weeklyResult.result.bestSession}</div>
                                        </div>
                                        <div className="bg-neutral-800/30 border border-neutral-800 rounded-lg p-4">
                                            <div className="text-neutral-400 text-xs mb-1">Worst Session</div>
                                            <div className="text-lg font-semibold">{weeklyResult.result.worstSession}</div>
                                        </div>
                                        <div className="bg-neutral-800/30 border border-neutral-800 rounded-lg p-4">
                                            <div className="text-neutral-400 text-xs mb-1">Best Setup</div>
                                            <div className="text-lg font-semibold">{weeklyResult.result.bestSetup}</div>
                                        </div>
                                        <div className="bg-neutral-800/30 border border-neutral-800 rounded-lg p-4">
                                            <div className="text-neutral-400 text-xs mb-1">Most Repeated Mistake</div>
                                            <div className="text-lg font-semibold">{weeklyResult.result.mostRepeatedMistake}</div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="text-neutral-500 text-sm">Click “Weekly AI Review” to get a coaching summary for the last 7 days.</div>
                    )}
                </AnimatedCard>

                <AnimatedCard delay={0.15} className="lg:col-span-2">
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <h3 className="text-lg font-semibold">All Trades Summary Report</h3>
                        <button
                            onClick={allTradesReport}
                            className="px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg hover:border-brand transition-colors"
                        >
                            {allTradesLoading ? 'Generating...' : 'Generate Report'}
                        </button>
                    </div>

                    {allTradesResult?.result ? (
                        <div className="space-y-3">
                            {!allTradesResult.ok && (
                                <div className="text-amber-400 text-sm">GPT response didn’t match strict format perfectly. Showing best-effort output.</div>
                            )}

                            {allTradesResult.stats?.totals && (
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                    <div className="bg-neutral-800/30 border border-neutral-800 rounded-lg p-4">
                                        <div className="text-neutral-400 text-xs mb-1">Trades</div>
                                        <div className="text-2xl font-bold tabular-nums">{allTradesResult.stats.totals.trades}</div>
                                    </div>
                                    <div className="bg-neutral-800/30 border border-neutral-800 rounded-lg p-4">
                                        <div className="text-neutral-400 text-xs mb-1">Win Rate</div>
                                        <div className="text-2xl font-bold tabular-nums">{allTradesResult.stats.totals.winRatePct}%</div>
                                    </div>
                                    <div className="bg-neutral-800/30 border border-neutral-800 rounded-lg p-4">
                                        <div className="text-neutral-400 text-xs mb-1">Net P&L</div>
                                        <div className="text-2xl font-bold tabular-nums">{formatMoney(allTradesResult.stats.totals.netPnl)}</div>
                                    </div>
                                    <div className="bg-neutral-800/30 border border-neutral-800 rounded-lg p-4">
                                        <div className="text-neutral-400 text-xs mb-1">Avoidable Loss Rate</div>
                                        <div className="text-2xl font-bold tabular-nums">{allTradesResult.stats.avoidableVsValidLosses?.avoidableLossRatePct ?? 0}%</div>
                                    </div>
                                </div>
                            )}

                            {allTradesResult.stats && (
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                    <div className="bg-neutral-800/30 border border-neutral-800 rounded-lg p-4">
                                        <div className="text-neutral-400 text-xs mb-2">Avoidable vs Valid Losses</div>
                                        <div className="h-56">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={[
                                                            { name: 'Avoidable', value: allTradesResult.stats.avoidableVsValidLosses?.avoidableLosses || 0 },
                                                            { name: 'Valid', value: allTradesResult.stats.avoidableVsValidLosses?.validLosses || 0 },
                                                        ].filter((x) => x.value > 0)}
                                                        dataKey="value"
                                                        nameKey="name"
                                                        outerRadius={90}
                                                        label
                                                    >
                                                        <Cell fill={PIE_COLORS[0]} />
                                                        <Cell fill={PIE_COLORS[2]} />
                                                    </Pie>
                                                    <Tooltip contentStyle={{ backgroundColor: '#171717', border: '1px solid #404040', borderRadius: '8px', color: '#fff' }} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    <div className="bg-neutral-800/30 border border-neutral-800 rounded-lg p-4">
                                        <div className="text-neutral-400 text-xs mb-2">Losses by Rule Break</div>
                                        <div className="h-56">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart
                                                    data={[
                                                        { rule: 'Risk', value: allTradesResult.stats.lossesByRuleViolation?.riskRespected || 0 },
                                                        { rule: 'Early Exit', value: allTradesResult.stats.lossesByRuleViolation?.noEarlyExit || 0 },
                                                        { rule: 'PD Array', value: allTradesResult.stats.lossesByRuleViolation?.validPDArray || 0 },
                                                        { rule: 'Session', value: allTradesResult.stats.lossesByRuleViolation?.correctSession || 0 },
                                                        { rule: 'HTF Bias', value: allTradesResult.stats.lossesByRuleViolation?.followedHTFBias || 0 },
                                                    ].filter((x) => x.value > 0)}
                                                >
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
                                                    <XAxis dataKey="rule" stroke="#888" tick={{ fill: '#888' }} interval={0} height={40} />
                                                    <YAxis stroke="#888" tick={{ fill: '#888' }} allowDecimals={false} />
                                                    <Tooltip contentStyle={{ backgroundColor: '#171717', border: '1px solid #404040', borderRadius: '8px', color: '#fff' }} />
                                                    <Bar dataKey="value" fill="#ef4444" radius={[8, 8, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    <div className="bg-neutral-800/30 border border-neutral-800 rounded-lg p-4">
                                        <div className="text-neutral-400 text-xs mb-2">Best Setups (Net P&L)</div>
                                        <div className="h-56">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart
                                                    data={(allTradesResult.stats.bestSetups || []).slice(0, 5).map((s: any) => ({ name: s.name, net: s.net }))}
                                                >
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
                                                    <XAxis dataKey="name" stroke="#888" tick={{ fill: '#888' }} interval={0} height={50} />
                                                    <YAxis stroke="#888" tick={{ fill: '#888' }} tickFormatter={(v) => formatMoney(v)} />
                                                    <Tooltip
                                                        contentStyle={{ backgroundColor: '#171717', border: '1px solid #404040', borderRadius: '8px', color: '#fff' }}
                                                        formatter={(v: any) => [formatMoney(v), 'Net']}
                                                    />
                                                    <Bar dataKey="net" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {allTradesResult.result.overview && (
                                <div className="bg-neutral-800/30 border border-neutral-800 rounded-lg p-4">
                                    <div className="text-neutral-400 text-xs mb-2">Overview</div>
                                    <div className="text-sm leading-relaxed text-neutral-200 whitespace-pre-wrap break-words">{allTradesResult.result.overview}</div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="bg-neutral-800/30 border border-neutral-800 rounded-lg p-4">
                                    <div className="text-neutral-400 text-xs mb-1">Rule to enforce</div>
                                    <div className="text-lg font-semibold break-words">{allTradesResult.result.ruleToEnforce || '-'}</div>
                                </div>
                                <div className="bg-neutral-800/30 border border-neutral-800 rounded-lg p-4">
                                    <div className="text-neutral-400 text-xs mb-1">Most repeated mistake</div>
                                    <div className="text-sm leading-relaxed text-neutral-200 break-words">{allTradesResult.result.mostRepeatedMistake || '-'}</div>
                                </div>
                            </div>

                            <div className="bg-neutral-800/30 border border-neutral-800 rounded-lg p-4">
                                <div className="text-neutral-400 text-xs mb-1">Strongest edge</div>
                                <div className="text-sm leading-relaxed text-neutral-200 break-words">{allTradesResult.result.strongestEdge || '-'}</div>
                            </div>

                            {Array.isArray(allTradesResult.result.strictRulesForNext30Days) && allTradesResult.result.strictRulesForNext30Days.length > 0 && (
                                <div className="bg-neutral-800/30 border border-neutral-800 rounded-lg p-4">
                                    <div className="text-neutral-400 text-xs mb-2">Strict rules for next 30 days</div>
                                    <div className="space-y-1 text-sm leading-relaxed text-neutral-200 break-words">
                                        {allTradesResult.result.strictRulesForNext30Days.map((v: string, i: number) => (
                                            <div key={i}>• {v}</div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-neutral-500 text-sm">Click “Generate Report” to summarize your entire journal.</div>
                    )}
                </AnimatedCard>
            </div>
        </div>
    )
}
