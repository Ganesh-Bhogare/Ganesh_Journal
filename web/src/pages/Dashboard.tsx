import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme, type AccentTheme } from '../contexts/ThemeContext'
import { TrendingUp, Target, Award, TrendingDown, Clock, Calendar as CalendarIcon, Layers, Activity, Sparkles, ArrowUpRight, ShieldCheck, AlertTriangle } from 'lucide-react'
import StatCard from '../components/StatCard'
import AnimatedCard from '../components/AnimatedCard'
import GradientButton from '../components/GradientButton'
import ICTTradeForm from '../components/ICTTradeForm'
import EquityCurve from '../components/charts/EquityCurve'
import WinLossPie from '../components/charts/WinLossPie'
import { api } from '../lib/api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts'

export default function Dashboard() {
    const { user } = useAuth()
    const { accentTheme, setAccentTheme } = useTheme()
    const [showTradeForm, setShowTradeForm] = useState(false)
    const [kpis, setKpis] = useState<any>(null)
    const [recentTrades, setRecentTrades] = useState<any[]>([])
    const [allTrades, setAllTrades] = useState<any[]>([])
    const [distributions, setDistributions] = useState<any>(null)
    const [fundedStatus, setFundedStatus] = useState<any>(null)

    const getTradeSortTime = (trade: any) => {
        const created = trade?.createdAt ? new Date(trade.createdAt).getTime() : NaN
        if (Number.isFinite(created)) return created

        const dated = trade?.date ? new Date(trade.date).getTime() : NaN
        if (Number.isFinite(dated)) return dated

        // Mongo ObjectId fallback (first 8 hex chars = seconds timestamp)
        const id = typeof trade?._id === 'string' ? trade._id : ''
        const hex = id.slice(0, 8)
        const sec = Number.parseInt(hex, 16)
        return Number.isFinite(sec) ? sec * 1000 : 0
    }

    const fetchData = async () => {
        try {
            const [kpisRes, tradesRes, allTradesRes, distRes, fundedRes] = await Promise.all([
                api.get('/analytics/kpis').catch(e => ({ data: null })),
                api.get('/trades?limit=100').catch(e => ({ data: { items: [] } })),
                api.get('/trades?limit=1000').catch(e => ({ data: { items: [] } })),
                api.get('/analytics/distributions').catch(e => ({ data: null })),
                api.get('/funded/status').catch(e => ({ data: null }))
            ])
            const recentSorted = [...(tradesRes.data?.items || [])]
                .sort((a, b) => getTradeSortTime(b) - getTradeSortTime(a))
                .slice(0, 5)

            setKpis(kpisRes.data)
            setRecentTrades(recentSorted)
            setAllTrades(allTradesRes.data?.items || [])
            setDistributions(distRes.data)
            setFundedStatus(fundedRes.data)
        } catch (err) {
            console.error('Failed to fetch data:', err)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    useEffect(() => {
        const onFocus = () => { fetchData() }
        const onVisibility = () => {
            if (document.visibilityState === 'visible') fetchData()
        }

        window.addEventListener('focus', onFocus)
        document.addEventListener('visibilitychange', onVisibility)

        return () => {
            window.removeEventListener('focus', onFocus)
            document.removeEventListener('visibilitychange', onVisibility)
        }
    }, [])

    const winLossData = kpis ? [
        { name: 'Wins', value: Math.round((kpis.winRate || 0) * 100) },
        { name: 'Losses', value: Math.round((1 - (kpis.winRate || 0)) * 100) }
    ] : []

    // Calculate comprehensive statistics
    const stats = allTrades.reduce((acc, trade) => {
        const pnl = trade.pnl || 0
        acc.totalPnl += pnl
        acc.totalTrades++

        if (trade.outcome === 'win' || (!trade.outcome && pnl > 0)) {
            acc.wins++
            acc.grossWin += Math.abs(pnl)
        } else if (trade.outcome === 'loss' || (!trade.outcome && pnl < 0)) {
            acc.losses++
            acc.grossLoss += Math.abs(pnl)
        } else {
            acc.breakeven++
        }

        // Long/Short tracking
        if (trade.direction === 'long') {
            acc.longs++
            if (trade.outcome === 'win' || (!trade.outcome && pnl > 0)) acc.longWins++
        } else if (trade.direction === 'short') {
            acc.shorts++
            if (trade.outcome === 'win' || (!trade.outcome && pnl > 0)) acc.shortWins++
        }

        return acc
    }, {
        totalTrades: 0,
        wins: 0,
        losses: 0,
        breakeven: 0,
        totalPnl: 0,
        grossWin: 0,
        grossLoss: 0,
        longs: 0,
        shorts: 0,
        longWins: 0,
        shortWins: 0
    })

    const winRate = stats.totalTrades > 0 ? (stats.wins / stats.totalTrades) * 100 : 0
    const profitFactor = stats.grossLoss > 0 ? stats.grossWin / stats.grossLoss : 0

    // Performance by hour (UTC)
    const hourlyPerformance = allTrades.reduce((acc, trade) => {
        if (!trade.entryTime) return acc
        const hour = new Date(trade.entryTime).getUTCHours()
        const hourKey = `${hour.toString().padStart(2, '0')}:00`
        if (!acc[hourKey]) acc[hourKey] = 0
        acc[hourKey] += trade.pnl || 0
        return acc
    }, {} as Record<string, number>)

    const hourlyData = Object.entries(hourlyPerformance)
        .map(([hour, pnl]) => ({ hour, pnl }))
        .sort((a, b) => a.hour.localeCompare(b.hour))

    // Gross Daily P&L
    const dailyPnL = allTrades.reduce((acc, trade) => {
        const date = new Date(trade.date).toISOString().split('T')[0]
        if (!acc[date]) acc[date] = { win: 0, loss: 0, trades: 0, netPnl: 0 }
        const pnl = trade.pnl || 0
        acc[date].trades++
        acc[date].netPnl += pnl
        if (pnl > 0) {
            acc[date].win += pnl
        } else {
            acc[date].loss += Math.abs(pnl)
        }
        return acc
    }, {} as Record<string, { win: number; loss: number; trades: number; netPnl: number }>)

    const dailyPnLData = Object.keys(dailyPnL)
        .map((date) => ({ date, ...dailyPnL[date] }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-7) // Last 7 days

    // Best and worst days
    const dailyEntries = Object.keys(dailyPnL).map((date) => ({ date, ...dailyPnL[date] }))
    const bestDay = dailyEntries.reduce((best, day) => day.netPnl > (best?.netPnl || -Infinity) ? day : best, dailyEntries[0])
    const worstDay = dailyEntries.reduce((worst, day) => day.netPnl < (worst?.netPnl || Infinity) ? day : worst, dailyEntries[0])

    // Calculate win/loss streaks
    const sortedTrades = [...allTrades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    let currentWinStreak = 0
    let currentLossStreak = 0
    let maxWinStreak = 0
    let maxLossStreak = 0

    sortedTrades.forEach(trade => {
        const pnl = trade.pnl || 0
        const isWin = trade.outcome === 'win' || (!trade.outcome && pnl > 0)

        if (isWin) {
            currentWinStreak++
            currentLossStreak = 0
            maxWinStreak = Math.max(maxWinStreak, currentWinStreak)
        } else if (trade.outcome === 'loss' || (!trade.outcome && pnl < 0)) {
            currentLossStreak++
            currentWinStreak = 0
            maxLossStreak = Math.max(maxLossStreak, currentLossStreak)
        }
    })

    // Calculate average win/loss amounts and duration
    const winTrades = allTrades.filter(t => t.outcome === 'win' || (!t.outcome && (t.pnl || 0) > 0))
    const lossTrades = allTrades.filter(t => t.outcome === 'loss' || (!t.outcome && (t.pnl || 0) < 0))

    const avgWin = winTrades.length > 0
        ? winTrades.reduce((sum, t) => sum + Math.abs(t.pnl || 0), 0) / winTrades.length
        : 0
    const avgLoss = lossTrades.length > 0
        ? lossTrades.reduce((sum, t) => sum + Math.abs(t.pnl || 0), 0) / lossTrades.length
        : 0

    const bestWin = winTrades.length > 0
        ? Math.max(...winTrades.map(t => t.pnl || 0))
        : 0
    const worstLoss = lossTrades.length > 0
        ? Math.min(...lossTrades.map(t => t.pnl || 0))
        : 0

    // Trade duration
    const tradesWithDuration = allTrades.filter(t => t.entryTime && t.exitTime)
    const avgWinDuration = winTrades
        .filter(t => t.entryTime && t.exitTime)
        .reduce((sum, t) => {
            const duration = new Date(t.exitTime!).getTime() - new Date(t.entryTime!).getTime()
            return sum + duration
        }, 0) / (winTrades.filter(t => t.entryTime && t.exitTime).length || 1)

    const avgLossDuration = lossTrades
        .filter(t => t.entryTime && t.exitTime)
        .reduce((sum, t) => {
            const duration = new Date(t.exitTime!).getTime() - new Date(t.entryTime!).getTime()
            return sum + duration
        }, 0) / (lossTrades.filter(t => t.entryTime && t.exitTime).length || 1)

    const formatDuration = (ms: number) => {
        const hours = Math.floor(ms / (1000 * 60 * 60))
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
        return `${hours}h ${minutes}m`
    }

    // Daily cumulative P&L for wins and losses separately
    const cumulativeWinData: { date: string; cumulative: number }[] = []
    const cumulativeLossData: { date: string; cumulative: number }[] = []
    let cumulativeWin = 0
    let cumulativeLoss = 0

    sortedTrades.forEach(trade => {
        const date = new Date(trade.date).toISOString().split('T')[0]
        const pnl = trade.pnl || 0

        if (pnl > 0) {
            cumulativeWin += pnl
            cumulativeWinData.push({ date, cumulative: cumulativeWin })
        } else if (pnl < 0) {
            cumulativeLoss += pnl
            cumulativeLossData.push({ date, cumulative: cumulativeLoss })
        }
    })

    // Trade distribution by day of week
    const dayOfWeekDistribution = allTrades.reduce((acc, trade) => {
        const day = new Date(trade.date).toLocaleDateString('en-US', { weekday: 'short' })
        if (!acc[day]) acc[day] = { win: 0, loss: 0 }
        const pnl = trade.pnl || 0
        if (pnl > 0) acc[day].win++
        else if (pnl < 0) acc[day].loss++
        return acc
    }, {} as Record<string, { win: number; loss: number }>)

    const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const dayDistData = dayOrder.map(day => ({
        day,
        win: dayOfWeekDistribution[day]?.win || 0,
        loss: dayOfWeekDistribution[day]?.loss || 0
    }))

    const utcHour = new Date().getUTCHours()
    const sessionLabel = utcHour >= 12 && utcHour <= 16
        ? 'London - New York Overlap'
        : utcHour >= 7 && utcHour < 12
            ? 'London Session'
            : utcHour >= 17 && utcHour < 22
                ? 'New York Session'
                : 'Asia Session'

    const todayNet = dailyPnLData.length > 0 ? (dailyPnLData[dailyPnLData.length - 1].netPnl || 0) : 0
    const openTrades = recentTrades.filter((trade) => !trade.exitPrice).length

    const livePulse = [
        {
            label: 'Session',
            value: sessionLabel,
            tone: 'text-cyan-300 border-cyan-400/40 bg-cyan-500/10'
        },
        {
            label: 'Today Net',
            value: `${todayNet >= 0 ? '+' : ''}$${todayNet.toFixed(2)}`,
            tone: todayNet >= 0 ? 'text-green-300 border-green-400/40 bg-green-500/10' : 'text-red-300 border-red-400/40 bg-red-500/10'
        },
        {
            label: 'Open Trades',
            value: `${openTrades}`,
            tone: 'text-amber-300 border-amber-400/40 bg-amber-500/10'
        },
        {
            label: 'Win Rate',
            value: `${winRate.toFixed(1)}%`,
            tone: 'text-violet-300 border-violet-400/40 bg-violet-500/10'
        }
    ]

    const themeOptions: Array<{ key: AccentTheme; label: string; swatch: string }> = [
        { key: 'neo-blue', label: 'Neo Blue', swatch: 'linear-gradient(135deg,#2563eb,#22d3ee)' },
        { key: 'neo-orange', label: 'Neo Orange', swatch: 'linear-gradient(135deg,#c2410c,#fb923c)' },
        { key: 'neo-black', label: 'Neo Black', swatch: 'linear-gradient(135deg,#3f3f46,#a1a1aa)' },
    ]

    const funded = fundedStatus?.funded
    const fundedSync = fundedStatus?.sync
    const fundedEnabled = Boolean(funded?.enabled)
    const fundedRecent = Array.isArray(fundedSync?.recent) ? fundedSync.recent : []
    const fundedLastSync = fundedSync?.lastSyncedAt ? new Date(fundedSync.lastSyncedAt).toLocaleString() : 'Never'

    return (
        <div className="space-y-6">
            <AnimatedCard delay={0.02} className="p-4 md:p-5">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <div className="text-sm font-semibold text-slate-100">Dashboard Theme Presets</div>
                        <div className="text-xs text-slate-400 mt-1">Switch between Neo Black, Neo Orange, and Neo Blue instantly.</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {themeOptions.map((opt) => {
                            const active = accentTheme === opt.key
                            return (
                                <button
                                    key={opt.key}
                                    type="button"
                                    onClick={() => setAccentTheme(opt.key)}
                                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${active ? 'text-white' : 'text-slate-300 hover:text-white'}`}
                                    style={{
                                        borderColor: active ? 'var(--accent-strong)' : 'var(--border-strong)',
                                        backgroundColor: active ? 'color-mix(in srgb, var(--accent) 22%, transparent)' : 'transparent'
                                    }}
                                >
                                    <span className="w-3 h-3 rounded-full" style={{ background: opt.swatch }} />
                                    {opt.label}
                                </button>
                            )
                        })}
                    </div>
                </div>
            </AnimatedCard>

            <motion.div
                className="relative overflow-hidden rounded-3xl border border-neutral-800/70 min-h-[300px]"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55 }}
            >
                <video
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="absolute inset-0 h-full w-full object-cover"
                >
                    <source src="/stock-trading.3840x2160.mp4" type="video/mp4" />
                </video>

                <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/70 to-black/30" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(14,165,233,0.22),transparent_45%),radial-gradient(circle_at_70%_80%,rgba(37,99,235,0.22),transparent_45%)]" />

                <motion.div
                    className="absolute top-8 right-8 w-32 h-32 rounded-full bg-cyan-400/20 blur-3xl"
                    animate={{ x: [0, 25, 0], y: [0, -12, 0] }}
                    transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                    className="absolute bottom-6 left-1/3 w-36 h-36 rounded-full bg-blue-500/20 blur-3xl"
                    animate={{ x: [0, -18, 0], y: [0, 10, 0] }}
                    transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
                />

                <div className="relative z-10 p-6 md:p-8 lg:p-10 grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-6 items-end">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-900/35 border border-blue-700/60 text-xs text-neutral-100 mb-4 backdrop-blur">
                            <Activity size={14} className="text-green-300" />
                            Live market pulse enabled
                        </div>
                        <h1 className="text-3xl md:text-4xl font-bold mb-3 leading-tight text-white">
                            Welcome Back, {user?.name || 'Trader'}
                        </h1>
                        <p className="text-neutral-200 max-w-xl text-sm md:text-base">
                            Professional command center for execution, risk and performance. Track live momentum and act fast with high-conviction decisions.
                        </p>

                        <div className="mt-5 flex flex-wrap gap-2">
                            {livePulse.map((item) => (
                                <div key={item.label} className={`px-3 py-2 rounded-xl border backdrop-blur text-xs ${item.tone}`}>
                                    <div className="text-neutral-300/90 uppercase tracking-wide text-[10px]">{item.label}</div>
                                    <div className="font-semibold text-sm mt-0.5">{item.value}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2, duration: 0.5 }}
                        className="rounded-2xl border border-white/15 bg-black/45 backdrop-blur-md p-5"
                    >
                        <div className="flex items-center justify-between text-neutral-200 text-xs mb-3">
                            <span className="inline-flex items-center gap-2">
                                <Sparkles size={14} className="text-brand-yellow" />
                                Professional Overview
                            </span>
                            <span className="inline-flex items-center gap-1 text-green-300">
                                <span className="w-2 h-2 rounded-full bg-green-300 animate-pulse" />
                                live
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                            <div className="rounded-xl border border-blue-800/60 p-3 bg-blue-900/25">
                                <div className="text-neutral-400 text-xs">Profit Factor</div>
                                <div className="text-lg font-semibold mt-1">{profitFactor.toFixed(2)}</div>
                            </div>
                            <div className="rounded-xl border border-blue-800/60 p-3 bg-blue-900/25">
                                <div className="text-neutral-400 text-xs">Total Trades</div>
                                <div className="text-lg font-semibold mt-1">{stats.totalTrades}</div>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <GradientButton onClick={() => setShowTradeForm(true)}>
                                + Add New
                            </GradientButton>
                            <button
                                onClick={fetchData}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-blue-700/60 text-white hover:bg-blue-900/35 transition-colors"
                            >
                                Refresh Feed <ArrowUpRight size={14} />
                            </button>
                        </div>
                    </motion.div>
                </div>
            </motion.div>

            <AnimatedCard delay={0.08} className="p-4 md:p-5">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div>
                        <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-100">
                            <ShieldCheck size={16} className="text-cyan-300" />
                            Funded Account Link
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                            Read-only sync health, latest import timestamp, and recent funded trades.
                        </div>
                    </div>
                    <button
                        onClick={fetchData}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-blue-700/60 text-white hover:bg-blue-900/35 transition-colors text-sm"
                    >
                        Refresh Feed <ArrowUpRight size={14} />
                    </button>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-sm">
                    <div className="rounded-xl border border-blue-800/60 bg-blue-900/20 p-3">
                        <div className="text-slate-400 text-xs">Link Status</div>
                        <div className="mt-1 font-semibold inline-flex items-center gap-2">
                            {fundedEnabled ? <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /> : <AlertTriangle size={14} className="text-amber-300" />}
                            {fundedEnabled ? 'Connected (Read-only)' : 'Not linked'}
                        </div>
                    </div>
                    <div className="rounded-xl border border-blue-800/60 bg-blue-900/20 p-3">
                        <div className="text-slate-400 text-xs">Provider / Terminal</div>
                        <div className="mt-1 font-semibold">{funded?.provider || 'N/A'} / {(funded?.terminalType || 'mt5').toUpperCase()}</div>
                    </div>
                    <div className="rounded-xl border border-blue-800/60 bg-blue-900/20 p-3">
                        <div className="text-slate-400 text-xs">Total Synced Trades</div>
                        <div className="mt-1 font-semibold">{fundedSync?.totalSynced ?? 0}</div>
                    </div>
                    <div className="rounded-xl border border-blue-800/60 bg-blue-900/20 p-3">
                        <div className="text-slate-400 text-xs">Last Sync</div>
                        <div className="mt-1 font-semibold">{fundedLastSync}</div>
                    </div>
                </div>

                <div className="mt-4 rounded-xl border border-neutral-800/70 bg-neutral-950/40 p-3">
                    <div className="flex items-center justify-between mb-2">
                        <div className="text-xs uppercase tracking-wide text-slate-400">Recent Funded Imports</div>
                        <div className="text-xs text-slate-500">Account: {funded?.accountId || 'N/A'}</div>
                    </div>
                    {fundedRecent.length > 0 ? (
                        <div className="space-y-2">
                            {fundedRecent.map((trade: any) => (
                                <div key={trade.externalTradeId || trade._id} className="flex items-center justify-between rounded-lg border border-neutral-800/80 px-3 py-2 text-xs">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-slate-200">{trade.instrument || 'N/A'}</span>
                                        <span className={`px-1.5 py-0.5 rounded ${trade.direction === 'long' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                                            {(trade.direction || 'na').toUpperCase()}
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
                        <div className="text-xs text-slate-500">No funded trades synced yet. Configure funded link in Settings and run the bridge script.</div>
                    )}
                </div>
            </AnimatedCard>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Net P&L"
                    value={`${stats.totalPnl >= 0 ? '+' : ''}$${stats.totalPnl.toFixed(2)}`}
                    icon={<TrendingUp />}
                    trend={stats.totalPnl > 0 ? 'up' : stats.totalPnl < 0 ? 'down' : 'neutral'}
                    delay={0.1}
                />
                <StatCard
                    title="Trade Win Rate"
                    value={`${winRate.toFixed(2)}%`}
                    icon={<Award />}
                    trend={winRate > 50 ? 'up' : winRate < 50 ? 'down' : 'neutral'}
                    delay={0.2}
                    subtitle={`W:${stats.wins} BE:${stats.breakeven} L:${stats.losses}`}
                />
                <StatCard
                    title="Average R:R"
                    value={kpis && kpis.avgRR != null ? kpis.avgRR.toFixed(2) : '0.00'}
                    icon={<Target />}
                    trend="neutral"
                    delay={0.3}
                />
                <StatCard
                    title="Profit Factor"
                    value={profitFactor.toFixed(2)}
                    icon={<TrendingDown />}
                    trend={profitFactor > 1 ? 'up' : 'down'}
                    delay={0.4}
                />
            </div>

            {/* Performance by Hour and Daily P&L */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <AnimatedCard delay={0.5}>
                    <div className="flex items-center gap-2 mb-4">
                        <Clock size={20} className="text-brand-yellow" />
                        <h3 className="text-lg font-semibold">Performance by Hour (UTC)</h3>
                    </div>
                    <div className="h-64">
                        {hourlyData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={hourlyData} layout="horizontal">
                                    <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
                                    <XAxis type="number" stroke="#888" tick={{ fill: '#888' }} />
                                    <YAxis dataKey="hour" type="category" stroke="#888" tick={{ fill: '#888' }} width={60} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#171717',
                                            border: '1px solid #404040',
                                            borderRadius: '8px',
                                            color: '#fff'
                                        }}
                                        formatter={(value: any) => [`$${Number(value || 0).toFixed(2)}`, 'P&L']}
                                    />
                                    <Bar dataKey="pnl" fill="#10b981" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-neutral-500">
                                <p>No hourly data yet</p>
                            </div>
                        )}
                    </div>
                </AnimatedCard>

                <AnimatedCard delay={0.6}>
                    <div className="flex items-center gap-2 mb-4">
                        <CalendarIcon size={20} className="text-brand-orange" />
                        <h3 className="text-lg font-semibold">Gross Daily P&L (Last 7 Days)</h3>
                    </div>
                    <div className="h-64">
                        {dailyPnLData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={dailyPnLData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
                                    <XAxis dataKey="date" stroke="#888" tick={{ fill: '#888' }} />
                                    <YAxis stroke="#888" tick={{ fill: '#888' }} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#171717',
                                            border: '1px solid #404040',
                                            borderRadius: '8px',
                                            color: '#fff'
                                        }}
                                        formatter={(value: any) => `$${Number(value || 0).toFixed(2)}`}
                                    />
                                    <Bar dataKey="win" fill="#10b981" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="loss" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-neutral-500">
                                <p>No daily data yet</p>
                            </div>
                        )}
                    </div>
                </AnimatedCard>
            </div>

            {/* Trade Distribution by Day of Week + Long/Short Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <AnimatedCard delay={0.7}>
                    <h3 className="text-lg font-semibold mb-4">Trade Distribution by Day of Week</h3>
                    <div className="h-64">
                        {dayDistData.some(d => d.win > 0 || d.loss > 0) ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={dayDistData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
                                    <XAxis dataKey="day" stroke="#888" tick={{ fill: '#888' }} />
                                    <YAxis stroke="#888" tick={{ fill: '#888' }} allowDecimals={false} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#171717',
                                            border: '1px solid #404040',
                                            borderRadius: '8px',
                                            color: '#fff'
                                        }}
                                    />
                                    <Bar dataKey="win" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="loss" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-neutral-500">
                                <p>No day distribution data yet</p>
                            </div>
                        )}
                    </div>
                </AnimatedCard>

                {/* Long/Short + Advanced Stats */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <AnimatedCard delay={0.8}>
                        <div className="flex items-center gap-2 mb-4">
                            <Layers size={20} className="text-brand-yellow" />
                            <h3 className="text-lg font-semibold">Long/Short</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-4 bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/20 rounded-lg">
                                <div className="text-green-400 text-xs mb-1">Long</div>
                                <div className="text-2xl font-bold mb-1">{stats.longs}</div>
                                <div className="text-xs text-neutral-400">
                                    {stats.longs > 0 ? ((stats.longWins / stats.longs) * 100).toFixed(0) : 0}% WR
                                </div>
                            </div>
                            <div className="p-4 bg-gradient-to-br from-red-500/10 to-red-500/5 border border-red-500/20 rounded-lg">
                                <div className="text-red-400 text-xs mb-1">Short</div>
                                <div className="text-2xl font-bold mb-1">{stats.shorts}</div>
                                <div className="text-xs text-neutral-400">
                                    {stats.shorts > 0 ? ((stats.shortWins / stats.shorts) * 100).toFixed(0) : 0}% WR
                                </div>
                            </div>
                        </div>
                    </AnimatedCard>

                    <AnimatedCard delay={0.85}>
                        <h3 className="text-lg font-semibold mb-4">Trade Performance</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-neutral-400">Best Win</span>
                                <span className="text-sm font-semibold text-green-500">${bestWin.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-neutral-400">Worst Loss</span>
                                <span className="text-sm font-semibold text-red-500">${worstLoss.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-neutral-400">Average Win</span>
                                <span className="text-sm font-semibold text-green-400">${avgWin.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-neutral-400">Average Loss</span>
                                <span className="text-sm font-semibold text-red-400">-${avgLoss.toFixed(2)}</span>
                            </div>
                        </div>
                    </AnimatedCard>

                    <AnimatedCard delay={0.9}>
                        <h3 className="text-lg font-semibold mb-4">Streaks & Duration</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-neutral-400">Max Win Streak</span>
                                <span className="text-sm font-semibold">{maxWinStreak}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-neutral-400">Max Loss Streak</span>
                                <span className="text-sm font-semibold">{maxLossStreak}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-neutral-400">Avg Win Duration</span>
                                <span className="text-sm font-semibold text-green-400">{formatDuration(avgWinDuration)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-neutral-400">Avg Loss Duration</span>
                                <span className="text-sm font-semibold text-red-400">{formatDuration(avgLossDuration)}</span>
                            </div>
                        </div>
                    </AnimatedCard>
                </div>

                {/* Daily NET Cumulative P&L - Wins vs Losses */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <AnimatedCard delay={0.95}>
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-3 h-3 rounded-full bg-green-500"></div>
                            <h3 className="text-lg font-semibold">Daily NET Cumulative P&L - Wins</h3>
                        </div>
                        <div className="h-64">
                            {cumulativeWinData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={cumulativeWinData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
                                        <XAxis
                                            dataKey="date"
                                            stroke="#888"
                                            tick={{ fill: '#888' }}
                                            tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        />
                                        <YAxis stroke="#888" tick={{ fill: '#888' }} />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: '#171717',
                                                border: '1px solid #404040',
                                                borderRadius: '8px',
                                                color: '#fff'
                                            }}
                                            labelFormatter={(date) => new Date(date).toLocaleDateString()}
                                            formatter={(value: any) => [`$${Number(value || 0).toFixed(2)}`, 'Cumulative']}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="cumulative"
                                            stroke="#10b981"
                                            strokeWidth={2}
                                            dot={{ fill: '#10b981', r: 3 }}
                                            activeDot={{ r: 5 }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-neutral-500">
                                    <p>No win data yet</p>
                                </div>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-4">
                            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                                <div className="text-green-400 text-xs mb-1">Total P&L</div>
                                <div className="text-xl font-bold text-green-500">${stats.grossWin.toFixed(2)}</div>
                            </div>
                            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                                <div className="text-green-400 text-xs mb-1">Winning Trades</div>
                                <div className="text-xl font-bold">{stats.wins}</div>
                            </div>
                        </div>
                    </AnimatedCard>

                    <AnimatedCard delay={1.0}>
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-3 h-3 rounded-full bg-red-500"></div>
                            <h3 className="text-lg font-semibold">Daily NET Cumulative P&L - Losses</h3>
                        </div>
                        <div className="h-64">
                            {cumulativeLossData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={cumulativeLossData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
                                        <XAxis
                                            dataKey="date"
                                            stroke="#888"
                                            tick={{ fill: '#888' }}
                                            tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        />
                                        <YAxis stroke="#888" tick={{ fill: '#888' }} />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: '#171717',
                                                border: '1px solid #404040',
                                                borderRadius: '8px',
                                                color: '#fff'
                                            }}
                                            labelFormatter={(date) => new Date(date).toLocaleDateString()}
                                            formatter={(value: any) => [`$${Number(value || 0).toFixed(2)}`, 'Cumulative']}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="cumulative"
                                            stroke="#ef4444"
                                            strokeWidth={2}
                                            dot={{ fill: '#ef4444', r: 3 }}
                                            activeDot={{ r: 5 }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-neutral-500">
                                    <p>No loss data yet</p>
                                </div>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-4">
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                                <div className="text-red-400 text-xs mb-1">Total P&L</div>
                                <div className="text-xl font-bold text-red-500">-${stats.grossLoss.toFixed(2)}</div>
                            </div>
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                                <div className="text-red-400 text-xs mb-1">Losing Trades</div>
                                <div className="text-xl font-bold">{stats.losses}</div>
                            </div>
                        </div>
                    </AnimatedCard>
                </div>

                {/* Best/Worst Days */}
                {dailyEntries.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <AnimatedCard delay={1.05}>
                            <h3 className="text-lg font-semibold mb-4">Best Trading Day</h3>
                            <div className="p-6 bg-gradient-to-br from-green-500/20 to-green-500/5 border border-green-500/30 rounded-lg">
                                <div className="text-green-400 text-sm mb-2">{new Date(bestDay.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</div>
                                <div className="text-4xl font-bold text-green-500 mb-3">${bestDay.netPnl.toFixed(2)}</div>
                                <div className="flex gap-4 text-sm text-neutral-300">
                                    <div>
                                        <span className="text-neutral-400">Trades:</span> {bestDay.trades}
                                    </div>
                                    <div>
                                        <span className="text-neutral-400">Wins:</span> ${bestDay.win.toFixed(2)}
                                    </div>
                                    <div>
                                        <span className="text-neutral-400">Losses:</span> -${bestDay.loss.toFixed(2)}
                                    </div>
                                </div>
                            </div>
                        </AnimatedCard>

                        <AnimatedCard delay={1.1}>
                            <h3 className="text-lg font-semibold mb-4">Worst Trading Day</h3>
                            <div className="p-6 bg-gradient-to-br from-red-500/20 to-red-500/5 border border-red-500/30 rounded-lg">
                                <div className="text-red-400 text-sm mb-2">{new Date(worstDay.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</div>
                                <div className="text-4xl font-bold text-red-500 mb-3">${worstDay.netPnl.toFixed(2)}</div>
                                <div className="flex gap-4 text-sm text-neutral-300">
                                    <div>
                                        <span className="text-neutral-400">Trades:</span> {worstDay.trades}
                                    </div>
                                    <div>
                                        <span className="text-neutral-400">Wins:</span> ${worstDay.win.toFixed(2)}
                                    </div>
                                    <div>
                                        <span className="text-neutral-400">Losses:</span> -${worstDay.loss.toFixed(2)}
                                    </div>
                                </div>
                            </div>
                        </AnimatedCard>
                    </div>
                )}
            </div>

            {/* Equity Curve */}
            <AnimatedCard delay={0.9}>
                <h3 className="text-lg font-semibold mb-4">Equity Curve</h3>
                <div className="h-64">
                    {kpis?.equityCurve?.length > 0 ? (
                        <EquityCurve data={kpis.equityCurve} />
                    ) : (
                        <div className="h-full flex items-center justify-center text-neutral-500">
                            <p>No equity data yet</p>
                        </div>
                    )}
                </div>
            </AnimatedCard>

            {/* Recent Trades */}
            <AnimatedCard delay={1.2}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Recent Trades</h3>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => window.location.href = '/trades'}
                        className="text-brand text-sm hover:underline"
                    >
                        View All →
                    </motion.button>
                </div>

                {recentTrades.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-left text-neutral-400 text-sm border-b border-neutral-800">
                                    <th className="pb-3">Date</th>
                                    <th className="pb-3">Pair</th>
                                    <th className="pb-3">Direction</th>
                                    <th className="pb-3">Entry</th>
                                    <th className="pb-3">Exit</th>
                                    <th className="pb-3">P&L</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentTrades.map((trade, i) => (
                                    <motion.tr
                                        key={trade._id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.1 }}
                                        className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors"
                                    >
                                        <td className="py-3">{new Date(trade.date).toLocaleDateString()}</td>
                                        <td className="py-3 font-medium">{trade.instrument}</td>
                                        <td className="py-3">
                                            <span className={`px-2 py-1 rounded text-xs ${trade.direction === 'long' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
                                                }`}>
                                                {trade.direction.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="py-3">{trade.entryPrice?.toFixed(5)}</td>
                                        <td className="py-3">{trade.exitPrice?.toFixed(5) || '-'}</td>
                                        <td className={`py-3 font-semibold ${(trade.pnl || 0) >= 0 ? 'text-green-500' : 'text-red-500'
                                            }`}>
                                            {trade.pnl ? `$${trade.pnl.toFixed(2)}` : '-'}
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-neutral-500 text-center py-8">
                        <p>No trades yet. Add your first trade to start tracking.</p>
                    </div>
                )}
            </AnimatedCard>

            {showTradeForm && (
                <ICTTradeForm
                    onClose={() => setShowTradeForm(false)}
                    onSuccess={fetchData}
                />
            )}
        </div>
    )
}
