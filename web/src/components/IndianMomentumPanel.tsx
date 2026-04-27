import { useCallback, useEffect, useState } from 'react'
import { Activity, ArrowDownRight, ArrowUpRight } from 'lucide-react'
import AnimatedCard from './AnimatedCard'
import { api } from '../lib/api'

type MomentumSignal = 'bullish' | 'bearish' | 'neutral'

type MomentumStock = {
    symbol: string
    tradingViewSymbol: string
    name: string
    exchange: string
    price: number
    changePercent: number
    volumeRatio: number
    momentumScore: number
    previousHigh: number
    previousLow: number
    rsi14: number | null
    vwap: number | null
    gapPercent: number | null
    signalAt: string
    momentumFromAt: string
    signal: MomentumSignal
    reasons: string[]
}

type MomentumRules = {
    lookbackMinutes: number
    momentumPercent: number
    volumeRatio: number
    breakoutFilter: 'previous-high-low'
    strictMode: boolean
    relaxedMode: boolean
    rvolThreshold: number
    rsiBullishThreshold: number
    rsiBearishThreshold: number
    gapPercentThreshold: number
}

type MomentumResponse = {
    ok: true
    asOf: string
    universeCount: number
    bullish: MomentumStock[]
    bearish: MomentumStock[]
    nearMissBullish: MomentumStock[]
    nearMissBearish: MomentumStock[]
    ranked: RankedMomentumStock[]
    neutralCount: number
    marketState: string
    signalSource: 'live' | 'previous-session'
    rules: MomentumRules
}

type RankedMomentumStock = MomentumStock & {
    direction: 'bullish' | 'bearish'
    criteriaPassed: number
    criteriaTotal: number
    missingCriteria: string[]
    tier: 'full' | 'one-miss' | 'two-plus-miss'
    fulfillmentPercent: number
}

type IndianMomentumPanelProps = {
    delay?: number
    limit?: number
}

function formatInrPrice(value: number) {
    return `INR ${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatPercent(value: number) {
    const sign = value > 0 ? '+' : ''
    return `${sign}${value.toFixed(2)}%`
}

function buildErrorMessage(err: any) {
    const apiError = err?.response?.data?.error
    if (typeof apiError === 'string' && apiError.trim()) return apiError
    if (typeof err?.message === 'string' && err.message.trim()) return err.message
    return 'Momentum screener load nahi ho paya.'
}

function formatSignalTime(signalAt?: string) {
    if (!signalAt) return '--'
    const d = new Date(signalAt)
    if (Number.isNaN(d.getTime())) return '--'

    const time = d.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
    })
    const date = d.toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
    })

    return `${time} IST • ${date}`
}

function formatIstTime(signalAt?: string) {
    if (!signalAt) return '--'
    const d = new Date(signalAt)
    if (Number.isNaN(d.getTime())) return '--'

    return d.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
    }) + ' IST'
}

function openTradingViewChart(tvSymbol: string) {
    const target = String(tvSymbol || '').trim().toUpperCase() || 'NSE:NIFTY'
    const url = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(target)}`
    window.open(url, '_blank', 'noopener,noreferrer')
}

function UnifiedMomentumBoard({
    items,
    direction,
    loading,
}: {
    items: RankedMomentumStock[]
    direction: 'bullish' | 'bearish'
    loading: boolean
}) {
    const toneClass = direction === 'bullish'
        ? 'border-emerald-700/45 bg-emerald-500/8 text-emerald-200'
        : 'border-rose-700/45 bg-rose-500/8 text-rose-200'

    const title = direction === 'bullish' ? 'Bullish Momentum Leaderboard' : 'Bearish Momentum Leaderboard'

    return (
        <div className={`rounded-xl border p-3 ${toneClass}`}>
            <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold">{title}</div>
                <div className="text-[11px] text-slate-300">{items.length} stocks</div>
            </div>

            {items.length > 0 ? (
                <div className="space-y-2 max-h-[68vh] overflow-y-auto pr-1">
                    {items.map((stock, idx) => (
                        <div
                            key={`ranked-${stock.symbol}-${stock.signalAt}-${direction}`}
                            className="rounded-lg border border-slate-700/60 bg-slate-950/45 px-3 py-2 cursor-pointer hover:border-cyan-500/50 hover:bg-slate-900/65 transition-colors"
                            onClick={() => openTradingViewChart(stock.tradingViewSymbol || stock.symbol)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    openTradingViewChart(stock.tradingViewSymbol || stock.symbol)
                                }
                            }}
                            role="button"
                            tabIndex={0}
                            title={`Open ${stock.tradingViewSymbol || stock.symbol} on TradingView`}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="text-xs text-slate-400">Rank #{idx + 1}</div>
                                    <div className="text-sm font-semibold text-slate-100 truncate">{stock.symbol}</div>
                                    <div className="text-[11px] text-slate-400 truncate">{stock.name}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-slate-300 uppercase">{stock.direction}</div>
                                    <div className="text-xs text-slate-400">{formatInrPrice(stock.price)}</div>
                                    <div className={`text-sm font-semibold ${stock.changePercent >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                                        {formatPercent(stock.changePercent)}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
                                <span className="rounded-full border border-indigo-700/60 bg-indigo-900/20 px-2 py-0.5 text-indigo-200">
                                    Criteria {stock.criteriaPassed}/{stock.criteriaTotal}
                                </span>
                                <span className="rounded-full border border-cyan-700/60 bg-cyan-900/20 px-2 py-0.5 text-cyan-200">
                                    Fulfill {stock.fulfillmentPercent.toFixed(0)}%
                                </span>
                                <span className="rounded-full border border-slate-600/70 bg-slate-800/65 px-2 py-0.5">
                                    Vol {stock.volumeRatio.toFixed(2)}x
                                </span>
                                <span className="rounded-full border border-slate-600/70 bg-slate-800/65 px-2 py-0.5">
                                    Signal {formatIstTime(stock.signalAt)}
                                </span>
                                <span className="rounded-full border border-slate-600/70 bg-slate-800/65 px-2 py-0.5">
                                    Window {formatIstTime(stock.momentumFromAt)} {'->'} {formatIstTime(stock.signalAt)}
                                </span>
                            </div>

                            {stock.missingCriteria.length > 0 ? (
                                <div className="mt-2 text-[11px] text-amber-200/90">
                                    Missing: {stock.missingCriteria.join(' | ')}
                                </div>
                            ) : (
                                <div className="mt-2 text-[11px] text-emerald-300">All active criteria passed</div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="rounded-lg border border-slate-700/55 bg-slate-900/35 px-3 py-4 text-center text-xs text-slate-400">
                    {loading ? `Scanning ${direction} momentum...` : `No ${direction} momentum stocks right now.`}
                </div>
            )}
        </div>
    )
}

export default function IndianMomentumPanel({ delay = 0.1, limit = 8 }: IndianMomentumPanelProps) {
    const [data, setData] = useState<MomentumResponse | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [strictMode, setStrictMode] = useState(false)
    const [relaxedMode, setRelaxedMode] = useState(false)
    const [direction, setDirection] = useState<'bullish' | 'bearish'>('bullish')

    const fetchMomentum = useCallback(async (opts?: { silent?: boolean }) => {
        const silent = opts?.silent ?? false
        if (!silent) {
            setLoading(true)
            setError('')
        }
        try {
            const { data } = await api.get<MomentumResponse>('/market/indian-momentum', {
                params: { limit, strict: strictMode, relaxed: relaxedMode },
            })
            setData(data)
        } catch (err: any) {
            if (!silent) {
                setError(buildErrorMessage(err))
            }
        } finally {
            if (!silent) {
                setLoading(false)
            }
        }
    }, [limit, strictMode, relaxedMode])

    useEffect(() => {
        fetchMomentum()
    }, [fetchMomentum])

    useEffect(() => {
        const timer = window.setInterval(() => {
            void fetchMomentum({ silent: true })
        }, 15000)

        return () => window.clearInterval(timer)
    }, [fetchMomentum])

    const signalCount = (data?.bullish.length || 0) + (data?.bearish.length || 0)
    const ranked = data?.ranked || []
    const rankedDirection = ranked.filter((x) => x.direction === direction)
    const fullCount = rankedDirection.filter((x) => x.tier === 'full').length
    const oneMissCount = rankedDirection.filter((x) => x.tier === 'one-miss').length
    const twoPlusCount = rankedDirection.filter((x) => x.tier === 'two-plus-miss').length

    const updatedAt = data?.asOf
        ? new Date(data.asOf).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : '--'

    return (
        <AnimatedCard delay={delay} className="p-4 md:p-5">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-100">
                        <Activity size={16} className="text-cyan-300" />
                        Indian Momentum Screener
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                        TradeStorm style bullish and bearish momentum picks from liquid NSE symbols.
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-300">
                        <span className="rounded-full border border-blue-700/60 bg-blue-900/20 px-2 py-0.5">
                            Momentum {'>='} {data?.rules?.momentumPercent ?? 2}%
                        </span>
                        <span className="rounded-full border border-blue-700/60 bg-blue-900/20 px-2 py-0.5">
                            Volume {'>='} {data?.rules?.volumeRatio ?? 1.5}x
                        </span>
                        <span className="rounded-full border border-blue-700/60 bg-blue-900/20 px-2 py-0.5">
                            Breakout: Prev High/Low
                        </span>
                        <span className="rounded-full border border-blue-700/60 bg-blue-900/20 px-2 py-0.5">
                            Window: {data?.rules?.lookbackMinutes ?? 15}m
                        </span>
                        {data?.rules?.relaxedMode ? (
                            <span className="rounded-full border border-amber-700/60 bg-amber-900/25 px-2 py-0.5 text-amber-300">
                                Relaxed ON
                            </span>
                        ) : null}
                        {data?.rules?.strictMode ? (
                            <>
                                <span className="rounded-full border border-emerald-700/60 bg-emerald-900/25 px-2 py-0.5 text-emerald-300">
                                    Strict ON
                                </span>
                                <span className="rounded-full border border-emerald-700/60 bg-emerald-900/25 px-2 py-0.5">
                                    RVOL {'>='} {data.rules.rvolThreshold}x
                                </span>
                                <span className="rounded-full border border-emerald-700/60 bg-emerald-900/25 px-2 py-0.5">
                                    RSI Bull {'>='} {data.rules.rsiBullishThreshold}
                                </span>
                                <span className="rounded-full border border-emerald-700/60 bg-emerald-900/25 px-2 py-0.5">
                                    Gap {'>='} {data.rules.gapPercentThreshold}%
                                </span>
                            </>
                        ) : null}
                    </div>
                </div>

                <div className="flex items-center gap-2 text-xs">
                    <button
                        type="button"
                        onClick={() => setStrictMode((prev) => !prev)}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 transition-colors ${strictMode
                            ? 'border-emerald-600/70 bg-emerald-600/15 text-emerald-200'
                            : 'border-slate-700/70 bg-slate-900/55 text-slate-300 hover:bg-slate-800/60'
                            }`}
                    >
                        {strictMode ? 'Strict Mode: ON' : 'Strict Mode: OFF'}
                    </button>
                    <button
                        type="button"
                        onClick={() => setRelaxedMode((prev) => !prev)}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 transition-colors ${relaxedMode
                            ? 'border-amber-600/70 bg-amber-600/15 text-amber-200'
                            : 'border-slate-700/70 bg-slate-900/55 text-slate-300 hover:bg-slate-800/60'
                            }`}
                    >
                        {relaxedMode ? 'Relaxed Mode: ON' : 'Relaxed Mode: OFF'}
                    </button>
                    <span className="rounded-lg border border-slate-700/70 bg-slate-900/55 px-2 py-1 text-slate-300">
                        State: {data?.marketState || 'LIVE'}
                    </span>
                    <span className="rounded-lg border border-slate-700/70 bg-slate-900/55 px-2 py-1 text-slate-300">
                        Source: {data?.signalSource === 'previous-session' ? 'Previous Session' : 'Live'}
                    </span>
                    <span className="rounded-lg border border-slate-700/70 bg-slate-900/55 px-2 py-1 text-slate-300">
                        Updated: {updatedAt}
                    </span>
                    <span className="rounded-lg border border-cyan-700/60 bg-cyan-900/20 px-2 py-1 text-cyan-200">
                        Auto Live: 15s
                    </span>
                </div>
            </div>

            {error ? (
                <div className="mb-3 rounded-lg border border-rose-700/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                    {error}
                </div>
            ) : null}

            <div className="mb-3 grid grid-cols-1 gap-2 text-xs text-slate-400 md:grid-cols-3">
                <div className="rounded-lg border border-slate-700/60 bg-slate-900/45 px-3 py-2">
                    Universe: <span className="font-semibold text-slate-200">{data?.universeCount ?? '--'}</span>
                </div>
                <div className="rounded-lg border border-slate-700/60 bg-slate-900/45 px-3 py-2">
                    Neutral: <span className="font-semibold text-slate-200">{data?.neutralCount ?? '--'}</span>
                </div>
                <div className="rounded-lg border border-slate-700/60 bg-slate-900/45 px-3 py-2">
                    Signal Count: <span className="font-semibold text-slate-200">{signalCount}</span>
                </div>
            </div>

            <div className="mb-3 rounded-xl border border-cyan-700/35 bg-cyan-500/5 p-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-semibold tracking-wide text-cyan-200 uppercase">
                        Single Momentum Board
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setDirection('bullish')}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 transition-colors ${direction === 'bullish'
                                ? 'border-emerald-600/70 bg-emerald-600/15 text-emerald-200'
                                : 'border-slate-700/70 bg-slate-900/55 text-slate-300 hover:bg-slate-800/60'
                                }`}
                        >
                            <ArrowUpRight size={13} />
                            Bullish
                        </button>
                        <button
                            type="button"
                            onClick={() => setDirection('bearish')}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 transition-colors ${direction === 'bearish'
                                ? 'border-rose-600/70 bg-rose-600/15 text-rose-200'
                                : 'border-slate-700/70 bg-slate-900/55 text-slate-300 hover:bg-slate-800/60'
                                }`}
                        >
                            <ArrowDownRight size={13} />
                            Bearish
                        </button>
                    </div>
                </div>
                <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
                    <span className="rounded-full border border-emerald-700/50 bg-emerald-900/20 px-2 py-0.5">
                        Full: {fullCount}
                    </span>
                    <span className="rounded-full border border-amber-700/50 bg-amber-900/20 px-2 py-0.5">
                        1 Missing: {oneMissCount}
                    </span>
                    <span className="rounded-full border border-slate-600/70 bg-slate-800/65 px-2 py-0.5">
                        2+ Missing: {twoPlusCount}
                    </span>
                    <span className="rounded-full border border-cyan-700/60 bg-cyan-900/20 px-2 py-0.5 text-cyan-200">
                        Sorted high to low by criteria then momentum
                    </span>
                </div>
                <UnifiedMomentumBoard items={rankedDirection} direction={direction} loading={loading} />
            </div>
        </AnimatedCard>
    )
}
