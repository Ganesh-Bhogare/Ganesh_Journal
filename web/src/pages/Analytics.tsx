import { motion } from 'framer-motion'
import { useMemo, useState, useEffect } from 'react'
import AnimatedCard from '../components/AnimatedCard'
import WinLossPie from '../components/charts/WinLossPie'
import PairPerformance from '../components/charts/PairPerformance'
import EquityCurve from '../components/charts/EquityCurve'
import { api } from '../lib/api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'

type TradeItem = {
    _id: string
    date: string
    instrument?: string
    direction?: 'long' | 'short'
    session?: 'Asia' | 'London' | 'New York'
    setupType?: string
    outcome?: 'win' | 'loss' | 'breakeven'
    pnl?: number
    rr?: number
    rMultiple?: number
    riskRespected?: boolean
    noEarlyExit?: boolean
    validPDArray?: boolean
    correctSession?: boolean
    followedHTFBias?: boolean
}

type RangePreset = '7d' | '30d' | '90d' | 'all' | 'custom'

function asNum(v: unknown) {
    const n = typeof v === 'number' ? v : Number(v)
    return Number.isFinite(n) ? n : 0
}

function tradeOutcome(t: TradeItem) {
    if (t.outcome) return t.outcome
    const pnl = asNum(t.pnl)
    if (pnl > 0) return 'win'
    if (pnl < 0) return 'loss'
    return 'breakeven'
}

function pct(v: number) {
    return `${(v * 100).toFixed(1)}%`
}

function money(v: number) {
    const sign = v < 0 ? '-' : ''
    return `${sign}$${Math.abs(v).toFixed(2)}`
}

function fmtInputDate(d: Date) {
    return d.toISOString().slice(0, 10)
}

function weekKey(iso: string) {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return 'Unknown week'
    const temp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    const dayNum = temp.getUTCDay() || 7
    temp.setUTCDate(temp.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1))
    const weekNo = Math.ceil((((temp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
    return `${temp.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

export default function Analytics() {
    const [distributions, setDistributions] = useState<any>(null)
    const [kpis, setKpis] = useState<any>(null)
    const [allTrades, setAllTrades] = useState<TradeItem[]>([])
    const [loading, setLoading] = useState(false)
    const [fetchError, setFetchError] = useState<string | null>(null)

    const [rangePreset, setRangePreset] = useState<RangePreset>('all')
    const [fromDate, setFromDate] = useState('')
    const [toDate, setToDate] = useState('')
    const [pairFilter, setPairFilter] = useState('All')
    const [sessionFilter, setSessionFilter] = useState('All')
    const [setupFilter, setSetupFilter] = useState('All')
    const [directionFilter, setDirectionFilter] = useState('All')
    const [drillPair, setDrillPair] = useState<string | null>(null)

    const [ai, setAi] = useState<any>(null)
    const [aiLoading, setAiLoading] = useState(false)
    const [aiAutoRequested, setAiAutoRequested] = useState(false)
    const [gpt, setGpt] = useState<any>(null)
    const [gptLoading, setGptLoading] = useState(false)

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true)
            setFetchError(null)
            try {
                const [dRes, kpiRes, tradesRes] = await Promise.all([
                    api.get('/analytics/distributions'),
                    api.get('/analytics/kpis').catch(() => ({ data: null })),
                    api.get('/trades?limit=1000').catch(() => ({ data: { items: [] } }))
                ])
                setDistributions(dRes.data)
                setKpis(kpiRes.data)
                setAllTrades((tradesRes.data?.items || []) as TradeItem[])
            } catch (err) {
                console.error('Failed to fetch analytics:', err)
                setFetchError('Failed to fetch analytics data. Please refresh and verify login.')
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [])

    useEffect(() => {
        if (rangePreset === 'custom') return
        if (rangePreset === 'all') {
            setFromDate('')
            setToDate('')
            return
        }
        const now = new Date()
        const from = new Date(now)
        const days = rangePreset === '7d' ? 7 : rangePreset === '30d' ? 30 : 90
        from.setDate(now.getDate() - days)
        setFromDate(fmtInputDate(from))
        setToDate(fmtInputDate(now))
    }, [rangePreset])

    const filteredTrades = useMemo(() => {
        const fromTs = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null
        const toTs = toDate ? new Date(`${toDate}T23:59:59`).getTime() : null
        return allTrades.filter((t) => {
            const ts = new Date(t.date).getTime()
            if (fromTs && ts < fromTs) return false
            if (toTs && ts > toTs) return false
            if (pairFilter !== 'All' && (t.instrument || 'Unknown') !== pairFilter) return false
            if (sessionFilter !== 'All' && (t.session || 'Unknown') !== sessionFilter) return false
            if (setupFilter !== 'All' && (t.setupType || 'Unknown') !== setupFilter) return false
            if (directionFilter !== 'All' && (t.direction || 'Unknown') !== directionFilter) return false
            if (drillPair && t.instrument !== drillPair) return false
            return true
        })
    }, [allTrades, fromDate, toDate, pairFilter, sessionFilter, setupFilter, directionFilter, drillPair])

    const metrics = useMemo(() => {
        const sorted = [...filteredTrades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        const total = sorted.length
        let wins = 0
        let losses = 0
        let breakeven = 0
        let netPnl = 0
        let grossProfit = 0
        let grossLoss = 0
        let rrSum = 0
        let rrCount = 0

        let equity = 0
        let peak = 0
        let maxDrawdown = 0
        let currentWinStreak = 0
        let currentLossStreak = 0
        let maxWinStreak = 0
        let maxLossStreak = 0

        const equityCurve: { date: string; equity: number }[] = []
        const rollingWinRate: { date: string; value: number }[] = []
        const outcomeWindow: ('win' | 'loss' | 'breakeven')[] = []

        const byPairMap: Record<string, { pair: string; profit: number; loss: number; net: number; trades: number }> = {}
        const bySessionMap: Record<string, { label: string; trades: number; net: number; wins: number; losses: number }> = {}
        const byWeekdayMap: Record<string, { day: string; trades: number; net: number; wins: number; losses: number }> = {
            Mon: { day: 'Mon', trades: 0, net: 0, wins: 0, losses: 0 },
            Tue: { day: 'Tue', trades: 0, net: 0, wins: 0, losses: 0 },
            Wed: { day: 'Wed', trades: 0, net: 0, wins: 0, losses: 0 },
            Thu: { day: 'Thu', trades: 0, net: 0, wins: 0, losses: 0 },
            Fri: { day: 'Fri', trades: 0, net: 0, wins: 0, losses: 0 },
            Sat: { day: 'Sat', trades: 0, net: 0, wins: 0, losses: 0 },
            Sun: { day: 'Sun', trades: 0, net: 0, wins: 0, losses: 0 },
        }

        for (const t of sorted) {
            const pnl = asNum(t.pnl)
            const outcome = tradeOutcome(t)
            const pair = t.instrument || 'Unknown'
            const session = t.session || 'Unknown'

            netPnl += pnl
            equity += pnl
            peak = Math.max(peak, equity)
            maxDrawdown = Math.max(maxDrawdown, peak - equity)
            equityCurve.push({ date: t.date, equity })

            if (outcome === 'win') {
                wins++
                grossProfit += pnl
                currentWinStreak++
                currentLossStreak = 0
            } else if (outcome === 'loss') {
                losses++
                grossLoss += Math.abs(pnl)
                currentLossStreak++
                currentWinStreak = 0
            } else {
                breakeven++
                currentWinStreak = 0
                currentLossStreak = 0
            }
            maxWinStreak = Math.max(maxWinStreak, currentWinStreak)
            maxLossStreak = Math.max(maxLossStreak, currentLossStreak)

            const rr = asNum(t.rr || t.rMultiple)
            if (rr > 0) {
                rrSum += rr
                rrCount++
            }

            if (!byPairMap[pair]) byPairMap[pair] = { pair, profit: 0, loss: 0, net: 0, trades: 0 }
            byPairMap[pair].trades += 1
            byPairMap[pair].net += pnl
            if (pnl >= 0) byPairMap[pair].profit += pnl
            else byPairMap[pair].loss += Math.abs(pnl)

            if (!bySessionMap[session]) bySessionMap[session] = { label: session, trades: 0, net: 0, wins: 0, losses: 0 }
            bySessionMap[session].trades += 1
            bySessionMap[session].net += pnl
            if (outcome === 'win') bySessionMap[session].wins += 1
            if (outcome === 'loss') bySessionMap[session].losses += 1

            const weekday = new Date(t.date).toLocaleDateString('en-US', { weekday: 'short' })
            if (byWeekdayMap[weekday]) {
                byWeekdayMap[weekday].trades += 1
                byWeekdayMap[weekday].net += pnl
                if (outcome === 'win') byWeekdayMap[weekday].wins += 1
                if (outcome === 'loss') byWeekdayMap[weekday].losses += 1
            }

            outcomeWindow.push(outcome)
            if (outcomeWindow.length > 20) outcomeWindow.shift()
            const relevant = outcomeWindow.filter((o) => o !== 'breakeven')
            const wr = relevant.length ? relevant.filter((o) => o === 'win').length / relevant.length : 0
            rollingWinRate.push({ date: t.date, value: wr * 100 })
        }

        const avgWin = wins ? grossProfit / wins : 0
        const avgLoss = losses ? grossLoss / losses : 0
        const winRate = (wins + losses) ? wins / (wins + losses) : 0
        const lossRate = (wins + losses) ? losses / (wins + losses) : 0
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? Infinity : 0)
        const expectancy = (winRate * avgWin) - (lossRate * avgLoss)

        return {
            total,
            wins,
            losses,
            breakeven,
            winRate,
            netPnl,
            grossProfit,
            grossLoss,
            avgWin,
            avgLoss,
            avgRR: rrCount ? rrSum / rrCount : 0,
            profitFactor,
            expectancy,
            maxDrawdown,
            maxWinStreak,
            maxLossStreak,
            pairData: Object.values(byPairMap).sort((a, b) => b.trades - a.trades),
            sessionData: Object.values(bySessionMap).sort((a, b) => b.trades - a.trades),
            weekdayData: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => byWeekdayMap[d]),
            equityCurve,
            rollingWinRate,
        }
    }, [filteredTrades])

    const outcomeData = useMemo(() => ([
        { name: 'Wins', value: metrics.wins },
        { name: 'Losses', value: metrics.losses },
        { name: 'Breakeven', value: metrics.breakeven }
    ]), [metrics.wins, metrics.losses, metrics.breakeven])

    const availablePairs = useMemo(() => ['All', ...Array.from(new Set(allTrades.map((t) => t.instrument || 'Unknown')))], [allTrades])
    const availableSessions = useMemo(() => ['All', ...Array.from(new Set(allTrades.map((t) => t.session || 'Unknown')))], [allTrades])
    const availableSetups = useMemo(() => ['All', ...Array.from(new Set(allTrades.map((t) => t.setupType || 'Unknown')))], [allTrades])

    const refreshData = async () => {
        setLoading(true)
        setFetchError(null)
        try {
            const [dRes, kpiRes, tradesRes] = await Promise.all([
                api.get('/analytics/distributions'),
                api.get('/analytics/kpis').catch(() => ({ data: null })),
                api.get('/trades?limit=1000').catch(() => ({ data: { items: [] } }))
            ])
            setDistributions(dRes.data)
            setKpis(kpiRes.data)
            setAllTrades((tradesRes.data?.items || []) as TradeItem[])
        } catch (err) {
            console.error('Failed to fetch analytics:', err)
            setFetchError('Failed to fetch analytics data. Please refresh and verify login.')
        } finally {
            setLoading(false)
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

    useEffect(() => {
        if (aiAutoRequested) return
        if (allTrades.length === 0) return
        setAiAutoRequested(true)
        fetchAiInsights()
        // intentionally run once after trades load
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allTrades.length, aiAutoRequested])

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

    const weeklyReview = useMemo(() => {
        const sorted = [...filteredTrades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        const weeks: Record<string, { trades: number; net: number; wins: number; losses: number }> = {}
        for (const t of sorted) {
            const w = weekKey(t.date)
            if (!weeks[w]) weeks[w] = { trades: 0, net: 0, wins: 0, losses: 0 }
            const outcome = tradeOutcome(t)
            const pnl = asNum(t.pnl)
            weeks[w].trades += 1
            weeks[w].net += pnl
            if (outcome === 'win') weeks[w].wins += 1
            if (outcome === 'loss') weeks[w].losses += 1
        }
        const ordered = Object.entries(weeks).sort((a, b) => a[0].localeCompare(b[0]))
        const current = ordered[ordered.length - 1]?.[1]
        const previous = ordered[ordered.length - 2]?.[1]
        if (!current) return null
        const currentWinRate = (current.wins + current.losses) ? current.wins / (current.wins + current.losses) : 0
        const prevWinRate = previous && (previous.wins + previous.losses) ? previous.wins / (previous.wins + previous.losses) : 0
        return {
            current,
            previous,
            currentWinRate,
            prevWinRate,
            deltaNet: previous ? current.net - previous.net : current.net,
            deltaWinRate: currentWinRate - prevWinRate,
            weekLabel: ordered[ordered.length - 1]?.[0],
        }
    }, [filteredTrades])

    const downloadWeeklyReview = () => {
        if (!weeklyReview) return
        const md = [
            `# Weekly Review (${weeklyReview.weekLabel})`,
            '',
            `- Trades: ${weeklyReview.current.trades}`,
            `- Net P&L: ${money(weeklyReview.current.net)}`,
            `- Win Rate: ${pct(weeklyReview.currentWinRate)}`,
            `- Delta Net vs Previous: ${money(weeklyReview.deltaNet)}`,
            `- Delta Win Rate vs Previous: ${(weeklyReview.deltaWinRate * 100).toFixed(1)}%`,
            '',
            '## Next Week Focus',
            `- Protect drawdown under ${money(metrics.maxDrawdown)}.`,
            `- Keep expectancy above ${money(metrics.expectancy)} per trade.`,
            `- Focus on top pair performance and avoid low-edge sessions.`,
        ].join('\n')

        const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `weekly-review-${weeklyReview.weekLabel}.md`
        a.click()
        URL.revokeObjectURL(url)
    }

    const avgLosingTrade = metrics.losses > 0 ? metrics.grossLoss / metrics.losses : 0
    const aiLeakEstimate = useMemo(() => {
        if (!ai?.repeatedMistakes?.length) return []
        return ai.repeatedMistakes.slice(0, 3).map((m: any) => ({
            ...m,
            monthlyLeak: asNum(m.estimatedLeak) || (asNum(m.count) * avgLosingTrade)
        }))
    }, [ai, avgLosingTrade])

    const drillTrades = useMemo(() => {
        return [...filteredTrades]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 25)
    }, [filteredTrades])

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
                    <p className="text-neutral-400">Deep dive into your trading performance with pro metrics and weekly intelligence</p>
                </div>
                <button
                    onClick={refreshData}
                    className="px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg hover:border-brand transition-colors"
                >
                    {loading ? 'Refreshing...' : 'Refresh'}
                </button>
            </motion.div>

            {fetchError && (
                <div className="text-sm text-red-300 border border-red-500/30 bg-red-500/10 rounded-lg px-3 py-2">
                    {fetchError}
                </div>
            )}

            <AnimatedCard delay={0.05}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
                    <select value={rangePreset} onChange={(e) => setRangePreset(e.target.value as RangePreset)} className="px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-sm">
                        <option value="7d">Last 7 days</option>
                        <option value="30d">Last 30 days</option>
                        <option value="90d">Last 90 days</option>
                        <option value="all">All time</option>
                        <option value="custom">Custom</option>
                    </select>

                    <input type="date" value={fromDate} onChange={(e) => { setRangePreset('custom'); setFromDate(e.target.value) }} className="px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-sm" />
                    <input type="date" value={toDate} onChange={(e) => { setRangePreset('custom'); setToDate(e.target.value) }} className="px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-sm" />

                    <select value={pairFilter} onChange={(e) => setPairFilter(e.target.value)} className="px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-sm">
                        {availablePairs.map((pair) => <option key={pair} value={pair}>{pair}</option>)}
                    </select>
                    <select value={sessionFilter} onChange={(e) => setSessionFilter(e.target.value)} className="px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-sm">
                        {availableSessions.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select value={setupFilter} onChange={(e) => setSetupFilter(e.target.value)} className="px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-sm">
                        {availableSetups.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                    {['All', 'long', 'short'].map((d) => (
                        <button
                            key={d}
                            onClick={() => setDirectionFilter(d)}
                            className={`px-3 py-1.5 rounded-full text-xs border ${directionFilter === d ? 'bg-brand/20 border-brand/40 text-brand' : 'bg-neutral-800 border-neutral-700 text-neutral-300'}`}
                        >
                            {d === 'All' ? 'All directions' : d.toUpperCase()}
                        </button>
                    ))}

                    <button
                        onClick={() => {
                            setRangePreset('all')
                            setFromDate('')
                            setToDate('')
                            setPairFilter('All')
                            setSessionFilter('All')
                            setSetupFilter('All')
                            setDirectionFilter('All')
                            setDrillPair(null)
                        }}
                        className="px-3 py-1.5 rounded-full text-xs border bg-neutral-800 border-neutral-700 text-neutral-300 hover:border-neutral-500"
                    >
                        Reset filters
                    </button>

                    {drillPair && (
                        <button
                            onClick={() => setDrillPair(null)}
                            className="px-3 py-1.5 rounded-full text-xs border bg-red-500/10 border-red-500/30 text-red-300"
                        >
                            Clear pair drill: {drillPair}
                        </button>
                    )}
                </div>

                <div className="mt-3 text-xs text-neutral-500">
                    Loaded trades: {allTrades.length} • Filtered trades: {filteredTrades.length}
                </div>
            </AnimatedCard>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <AnimatedCard delay={0.08}>
                    <div className="text-neutral-400 text-xs mb-1">Net P&L</div>
                    <div className={`text-2xl font-bold ${metrics.netPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{money(metrics.netPnl)}</div>
                    <div className="text-xs text-neutral-500 mt-1">Trades: {metrics.total}</div>
                </AnimatedCard>

                <AnimatedCard delay={0.1}>
                    <div className="text-neutral-400 text-xs mb-1">Expectancy / Trade</div>
                    <div className={`text-2xl font-bold ${metrics.expectancy >= 0 ? 'text-green-400' : 'text-red-400'}`}>{money(metrics.expectancy)}</div>
                    <div className="text-xs text-neutral-500 mt-1">Avg RR: {metrics.avgRR.toFixed(2)}</div>
                </AnimatedCard>

                <AnimatedCard delay={0.12}>
                    <div className="text-neutral-400 text-xs mb-1">Profit Factor</div>
                    <div className="text-2xl font-bold">{Number.isFinite(metrics.profitFactor) ? metrics.profitFactor.toFixed(2) : 'Inf'}</div>
                    <div className="text-xs text-neutral-500 mt-1">Win Rate: {pct(metrics.winRate)}</div>
                </AnimatedCard>

                <AnimatedCard delay={0.14}>
                    <div className="text-neutral-400 text-xs mb-1">Max Drawdown</div>
                    <div className="text-2xl font-bold text-red-400">{money(metrics.maxDrawdown)}</div>
                    <div className="text-xs text-neutral-500 mt-1">Streaks: W{metrics.maxWinStreak} / L{metrics.maxLossStreak}</div>
                </AnimatedCard>
            </div>

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
                        {metrics.pairData.length > 0 ? (
                            <PairPerformance
                                data={metrics.pairData}
                                onPairClick={(pair) => setDrillPair(pair)}
                                activePair={drillPair || undefined}
                            />
                        ) : (
                            <div className="h-full flex items-center justify-center text-neutral-500">
                                <p>No pair data yet</p>
                            </div>
                        )}
                    </div>
                </AnimatedCard>

                <AnimatedCard delay={0.22} className="lg:col-span-2">
                    <h3 className="text-lg font-semibold mb-4">Equity Curve + Rolling Win Rate (20 trades)</h3>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <div className="h-72">
                            {metrics.equityCurve.length > 0 ? (
                                <EquityCurve data={metrics.equityCurve} />
                            ) : (
                                <div className="h-full flex items-center justify-center text-neutral-500">No equity data</div>
                            )}
                        </div>
                        <div className="h-72">
                            {metrics.rollingWinRate.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={metrics.rollingWinRate}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
                                        <XAxis dataKey="date" stroke="#888" tick={{ fill: '#888' }} tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
                                        <YAxis stroke="#888" tick={{ fill: '#888' }} domain={[0, 100]} />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: '#171717',
                                                border: '1px solid #404040',
                                                borderRadius: '8px',
                                                color: '#fff'
                                            }}
                                            formatter={(value: any) => [`${asNum(value).toFixed(1)}%`, 'Rolling WR']}
                                        />
                                        <Line type="monotone" dataKey="value" stroke="#22d3ee" strokeWidth={2.5} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-neutral-500">No rolling data</div>
                            )}
                        </div>
                    </div>
                </AnimatedCard>

                <AnimatedCard delay={0.3} className="lg:col-span-2">
                    <h3 className="text-lg font-semibold mb-4">Trading Insights</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 bg-neutral-800/50 rounded-lg">
                            <div className="text-neutral-400 text-sm mb-1">Best Trading Session</div>
                            <div className="text-2xl font-bold">{metrics.sessionData?.[0]?.label || distributions?.bySession?.[0]?.label || 'N/A'}</div>
                        </div>
                        <div className="p-4 bg-neutral-800/50 rounded-lg">
                            <div className="text-neutral-400 text-sm mb-1">Most Traded Pair</div>
                            <div className="text-2xl font-bold">{metrics.pairData?.[0]?.pair || distributions?.byInstrument?.[0]?.label || 'N/A'}</div>
                        </div>
                        <div className="p-4 bg-neutral-800/50 rounded-lg">
                            <div className="text-neutral-400 text-sm mb-1">Total Trades</div>
                            <div className="text-2xl font-bold">
                                {metrics.total}
                            </div>
                        </div>
                    </div>
                </AnimatedCard>

                <AnimatedCard delay={0.32} className="lg:col-span-2">
                    <h3 className="text-lg font-semibold mb-4">Session Performance + Weekday Heatmap</h3>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            {metrics.sessionData.map((s) => {
                                const wr = (s.wins + s.losses) ? s.wins / (s.wins + s.losses) : 0
                                return (
                                    <div key={s.label} className="flex items-center justify-between bg-neutral-800/30 border border-neutral-800 rounded-lg px-3 py-2">
                                        <div>
                                            <div className="text-sm font-medium">{s.label}</div>
                                            <div className="text-xs text-neutral-400">Trades: {s.trades} • WR: {pct(wr)}</div>
                                        </div>
                                        <div className={`text-sm font-semibold ${s.net >= 0 ? 'text-green-400' : 'text-red-400'}`}>{money(s.net)}</div>
                                    </div>
                                )
                            })}
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {metrics.weekdayData.map((d) => (
                                <div key={d.day} className={`rounded-lg border p-3 ${d.net >= 0 ? 'bg-green-500/10 border-green-500/25' : 'bg-red-500/10 border-red-500/25'}`}>
                                    <div className="text-xs text-neutral-400">{d.day}</div>
                                    <div className="text-sm font-semibold mt-1">{money(d.net)}</div>
                                    <div className="text-[11px] text-neutral-500 mt-1">{d.trades} trades</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </AnimatedCard>

                <AnimatedCard delay={0.34} className="lg:col-span-2">
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <h3 className="text-lg font-semibold">Weekly Review Mode</h3>
                        <button
                            onClick={downloadWeeklyReview}
                            disabled={!weeklyReview}
                            className="px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg hover:border-brand transition-colors disabled:opacity-50"
                        >
                            Export Weekly Review
                        </button>
                    </div>

                    {weeklyReview ? (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <div className="p-3 rounded-lg border border-neutral-800 bg-neutral-800/30">
                                <div className="text-xs text-neutral-400">Week</div>
                                <div className="text-lg font-semibold mt-1">{weeklyReview.weekLabel}</div>
                            </div>
                            <div className="p-3 rounded-lg border border-neutral-800 bg-neutral-800/30">
                                <div className="text-xs text-neutral-400">Current Net</div>
                                <div className={`text-lg font-semibold mt-1 ${weeklyReview.current.net >= 0 ? 'text-green-400' : 'text-red-400'}`}>{money(weeklyReview.current.net)}</div>
                            </div>
                            <div className="p-3 rounded-lg border border-neutral-800 bg-neutral-800/30">
                                <div className="text-xs text-neutral-400">Delta Net</div>
                                <div className={`text-lg font-semibold mt-1 ${weeklyReview.deltaNet >= 0 ? 'text-green-400' : 'text-red-400'}`}>{money(weeklyReview.deltaNet)}</div>
                            </div>
                            <div className="p-3 rounded-lg border border-neutral-800 bg-neutral-800/30">
                                <div className="text-xs text-neutral-400">Delta Win Rate</div>
                                <div className={`text-lg font-semibold mt-1 ${weeklyReview.deltaWinRate >= 0 ? 'text-green-400' : 'text-red-400'}`}>{(weeklyReview.deltaWinRate * 100).toFixed(1)}%</div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-neutral-500 text-sm">Not enough weekly data yet.</div>
                    )}
                </AnimatedCard>

                <AnimatedCard delay={0.36} className="lg:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">Drill-down Trades</h3>
                        <div className="text-xs text-neutral-500">Showing latest 25 filtered trades</div>
                    </div>

                    {drillTrades.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-neutral-400 border-b border-neutral-800">
                                        <th className="pb-2">Date</th>
                                        <th className="pb-2">Pair</th>
                                        <th className="pb-2">Session</th>
                                        <th className="pb-2">Setup</th>
                                        <th className="pb-2">Outcome</th>
                                        <th className="pb-2">P&L</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {drillTrades.map((t) => {
                                        const out = tradeOutcome(t)
                                        const pnl = asNum(t.pnl)
                                        return (
                                            <tr key={t._id} className="border-b border-neutral-800/60">
                                                <td className="py-2">{new Date(t.date).toLocaleDateString()}</td>
                                                <td className="py-2">{t.instrument || 'N/A'}</td>
                                                <td className="py-2">{t.session || 'N/A'}</td>
                                                <td className="py-2">{t.setupType || 'N/A'}</td>
                                                <td className="py-2">
                                                    <span className={`px-2 py-0.5 rounded text-xs ${out === 'win' ? 'bg-green-500/20 text-green-300' : out === 'loss' ? 'bg-red-500/20 text-red-300' : 'bg-neutral-700/40 text-neutral-300'}`}>
                                                        {out}
                                                    </span>
                                                </td>
                                                <td className={`py-2 font-semibold ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{money(pnl)}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-neutral-500 text-sm">No trades for selected filters.</div>
                    )}
                </AnimatedCard>

                <AnimatedCard delay={0.35} className="lg:col-span-2">
                    <div className="flex items-center justify-between gap-4 mb-4">
                        <div>
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                Trade Diagnostics
                                <span className="px-2 py-0.5 rounded-full text-[11px] bg-brand/15 border border-brand/40 text-brand">v2</span>
                            </h3>
                            <p className="text-neutral-400 text-sm">Find repeated mistakes + good habits from your journal</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={fetchAiInsights}
                                className="px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg hover:border-brand transition-colors"
                            >
                                {aiLoading ? 'Analyzing...' : 'Generate'}
                            </button>
                        </div>
                    </div>

                    {ai?.tradesAnalyzed ? (
                        <>
                            {!ai?.setupPerformance && (
                                <div className="mb-4 text-xs text-yellow-200 border border-yellow-500/30 bg-yellow-500/10 rounded-lg px-3 py-2">
                                    Enhanced AI blocks are missing from server response. Restart backend or rebuild `server/dist` to load latest AI analytics.
                                </div>
                            )}

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

                            {Number(ai?.tradesAnalyzed || 0) < 15 && (
                                <div className="mb-6 text-xs text-yellow-200 border border-yellow-500/30 bg-yellow-500/10 rounded-lg px-3 py-2">
                                    Low sample size ({ai?.tradesAnalyzed || 0} trades). Confidence scores are directional; journal at least 15-20 trades for stable diagnostics.
                                </div>
                            )}

                            {aiLeakEstimate.length > 0 && (
                                <div className="mb-6">
                                    <div className="font-semibold mb-2">Estimated leakage from repeated mistakes</div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        {aiLeakEstimate.map((m: any) => (
                                            <div key={m.key} className="p-3 rounded-lg border border-red-500/30 bg-red-500/10">
                                                <div className="text-sm text-red-200">{m.label}</div>
                                                <div className="text-xs text-red-300/90 mt-1">Count: {m.count} ({formatPct(m.rate)})</div>
                                                <div className="text-sm font-semibold text-red-200 mt-2">Potential leak: {money(m.monthlyLeak)}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div>
                                    <div className="font-semibold mb-2">Repeated mistakes</div>
                                    <div className="space-y-2">
                                        {(ai.repeatedMistakes || []).slice(0, 5).map((m: any) => (
                                            <div key={m.key} className="flex items-center justify-between bg-neutral-800/30 border border-neutral-800 rounded-lg px-3 py-2">
                                                <div>
                                                    <div className="text-sm text-neutral-200">{m.label}</div>
                                                    <div className="text-[11px] text-neutral-400">
                                                        Confidence: {formatPct(m.confidence || 0)} • Evidence: {m.evidenceTrades || m.count}
                                                    </div>
                                                </div>
                                                <div className="text-sm text-neutral-400 text-right">
                                                    <div>{m.count} ({formatPct(m.rate)})</div>
                                                    <div className="text-red-300/90 text-xs">Leak: {money(asNum(m.estimatedLeak))}</div>
                                                </div>
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
                                                <div>
                                                    <div className="text-sm text-neutral-200">{s.label}</div>
                                                    <div className="text-[11px] text-neutral-400">Confidence: {formatPct(s.confidence || 0)} • Evidence: {s.evidenceTrades || s.count}</div>
                                                </div>
                                                <div className="text-sm text-neutral-400">{s.count} ({formatPct(s.rate)})</div>
                                            </div>
                                        ))}
                                        {(ai.strengths || []).length === 0 && (
                                            <div className="text-neutral-500 text-sm">No strengths detected yet</div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {(ai.setupPerformance || []).length > 0 && (
                                <div className="mt-6">
                                    <div className="font-semibold mb-2">Setup Expectancy Engine</div>
                                    <div className="overflow-x-auto border border-neutral-800 rounded-lg">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="text-left text-neutral-400 border-b border-neutral-800 bg-neutral-900/40">
                                                    <th className="px-3 py-2">Setup</th>
                                                    <th className="px-3 py-2">Trades</th>
                                                    <th className="px-3 py-2">Win Rate</th>
                                                    <th className="px-3 py-2">Expectancy</th>
                                                    <th className="px-3 py-2">Avg RR</th>
                                                    <th className="px-3 py-2">Confidence</th>
                                                    <th className="px-3 py-2">Sample</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(ai.setupPerformance || []).slice(0, 8).map((s: any) => (
                                                    <tr key={s.setup} className="border-b border-neutral-800/70">
                                                        <td className="px-3 py-2 font-medium">{s.setup}</td>
                                                        <td className="px-3 py-2">{s.trades}</td>
                                                        <td className="px-3 py-2">{formatPct(s.winRate || 0)}</td>
                                                        <td className={`px-3 py-2 font-semibold ${(s.expectancy || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>{money(asNum(s.expectancy))}</td>
                                                        <td className="px-3 py-2">{asNum(s.avgRR).toFixed(2)}</td>
                                                        <td className="px-3 py-2">{formatPct(s.confidence || 0)}</td>
                                                        <td className="px-3 py-2">
                                                            <span className={`px-2 py-0.5 rounded text-xs ${(s.sampleTag === 'high') ? 'bg-green-500/20 text-green-300' : (s.sampleTag === 'medium') ? 'bg-yellow-500/20 text-yellow-300' : 'bg-red-500/20 text-red-300'}`}>
                                                                {s.sampleTag}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

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
                        <div className="text-neutral-500 text-sm">Click Generate to refresh diagnostics from your latest trades.</div>
                    )}

                </AnimatedCard>
            </div>
        </div>
    )
}
