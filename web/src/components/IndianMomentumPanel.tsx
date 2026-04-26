import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Activity, ArrowDownRight, ArrowUpRight, RefreshCw } from 'lucide-react'
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
    neutralCount: number
    marketState: string
    signalSource: 'live' | 'previous-session'
    rules: MomentumRules
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

function MomentumList({
    title,
    items,
    tone,
    icon,
    emptyText,
    onOpenChart,
}: {
    title: string
    items: MomentumStock[]
    tone: 'bullish' | 'bearish'
    icon: ReactNode
    emptyText: string
    onOpenChart: (tvSymbol: string) => void
}) {
    const cardClass = tone === 'bullish'
        ? 'border-emerald-700/45 bg-emerald-500/8'
        : 'border-rose-700/45 bg-rose-500/8'

    const textClass = tone === 'bullish' ? 'text-emerald-300' : 'text-rose-300'

    return (
        <div className={`rounded-xl border ${cardClass} p-3`}>
            <div className="mb-3 flex items-center justify-between">
                <div className={`inline-flex items-center gap-2 text-sm font-semibold ${textClass}`}>
                    {icon}
                    {title}
                </div>
                <span className="text-xs text-slate-400">{items.length} picks</span>
            </div>

            {items.length > 0 ? (
                <div className="space-y-2">
                    {items.map((stock) => {
                        const positive = stock.changePercent >= 0
                        return (
                            <div
                                key={`${stock.symbol}-${stock.signalAt}`}
                                className="rounded-lg border border-slate-700/60 bg-slate-950/45 px-3 py-2 cursor-pointer hover:border-cyan-500/50 hover:bg-slate-900/65 transition-colors"
                                onClick={() => onOpenChart(stock.tradingViewSymbol || stock.symbol)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault()
                                        onOpenChart(stock.tradingViewSymbol || stock.symbol)
                                    }
                                }}
                                role="button"
                                tabIndex={0}
                                title={`Open ${stock.tradingViewSymbol || stock.symbol} on TradingView`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="text-sm font-semibold text-slate-100 truncate">{stock.symbol}</div>
                                        <div className="text-[11px] text-slate-400 truncate">{stock.name}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-semibold text-slate-100">{formatInrPrice(stock.price)}</div>
                                        <div className={`text-xs font-medium ${positive ? 'text-emerald-300' : 'text-rose-300'}`}>
                                            {formatPercent(stock.changePercent)}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                                    <span className="rounded-full border border-cyan-700/60 bg-cyan-900/20 px-2 py-0.5 text-cyan-200">
                                        {stock.tradingViewSymbol || stock.symbol}
                                    </span>
                                    <span className="rounded-full border border-indigo-700/60 bg-indigo-900/20 px-2 py-0.5 text-indigo-200">
                                        {formatSignalTime(stock.signalAt)}
                                    </span>
                                    <span className="rounded-full border border-slate-600/70 bg-slate-800/65 px-2 py-0.5 text-slate-200">
                                        Score {stock.momentumScore > 0 ? '+' : ''}{stock.momentumScore.toFixed(2)}
                                    </span>
                                    <span className="rounded-full border border-slate-600/70 bg-slate-800/65 px-2 py-0.5 text-slate-300">
                                        Vol {stock.volumeRatio.toFixed(2)}x
                                    </span>
                                    <span className="rounded-full border border-slate-600/70 bg-slate-800/65 px-2 py-0.5 text-slate-300">
                                        {stock.exchange}
                                    </span>
                                    <span className="rounded-full border border-slate-600/70 bg-slate-800/65 px-2 py-0.5 text-slate-300">
                                        BH {stock.previousHigh.toFixed(2)}
                                    </span>
                                    <span className="rounded-full border border-slate-600/70 bg-slate-800/65 px-2 py-0.5 text-slate-300">
                                        BL {stock.previousLow.toFixed(2)}
                                    </span>
                                    {stock.rsi14 != null ? (
                                        <span className="rounded-full border border-slate-600/70 bg-slate-800/65 px-2 py-0.5 text-slate-300">
                                            RSI {stock.rsi14.toFixed(1)}
                                        </span>
                                    ) : null}
                                    {stock.vwap != null ? (
                                        <span className="rounded-full border border-slate-600/70 bg-slate-800/65 px-2 py-0.5 text-slate-300">
                                            VWAP {stock.vwap.toFixed(2)}
                                        </span>
                                    ) : null}
                                    {stock.gapPercent != null ? (
                                        <span className="rounded-full border border-slate-600/70 bg-slate-800/65 px-2 py-0.5 text-slate-300">
                                            Gap {stock.gapPercent > 0 ? '+' : ''}{stock.gapPercent.toFixed(2)}%
                                        </span>
                                    ) : null}
                                </div>

                                <div className="mt-2 grid grid-cols-1 gap-1 text-[11px] text-slate-300 md:grid-cols-2">
                                    <div className="rounded-md border border-slate-700/60 bg-slate-900/45 px-2 py-1">
                                        Signal At: <span className="text-cyan-200 font-medium">{formatIstTime(stock.signalAt)}</span>
                                    </div>
                                    <div className="rounded-md border border-slate-700/60 bg-slate-900/45 px-2 py-1">
                                        Momentum Window: <span className="text-amber-200 font-medium">{formatIstTime(stock.momentumFromAt)} {'->'} {formatIstTime(stock.signalAt)}</span>
                                    </div>
                                </div>

                                {stock.reasons?.length ? (
                                    <div className="mt-2 text-[11px] text-slate-400 leading-relaxed">
                                        {stock.reasons.join(' | ')}
                                    </div>
                                ) : null}
                            </div>
                        )
                    })}
                </div>
            ) : (
                <div className="rounded-lg border border-slate-700/55 bg-slate-900/35 px-3 py-5 text-center text-xs text-slate-400">
                    {emptyText}
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

    const fetchMomentum = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const { data } = await api.get<MomentumResponse>('/market/indian-momentum', {
                params: { limit, strict: strictMode, relaxed: relaxedMode },
            })
            setData(data)
        } catch (err: any) {
            setError(buildErrorMessage(err))
        } finally {
            setLoading(false)
        }
    }, [limit, strictMode, relaxedMode])

    useEffect(() => {
        fetchMomentum()
    }, [fetchMomentum])

    const updatedAt = data?.asOf ? new Date(data.asOf).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--'

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
                    <button
                        type="button"
                        onClick={fetchMomentum}
                        disabled={loading}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-blue-700/60 px-3 py-1.5 text-slate-100 transition-colors hover:bg-blue-900/35 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
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
                    Signal Count: <span className="font-semibold text-slate-200">{(data?.bullish.length || 0) + (data?.bearish.length || 0)}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                <MomentumList
                    title="Strong Bullish"
                    items={data?.bullish || []}
                    tone="bullish"
                    icon={<ArrowUpRight size={14} />}
                    emptyText={loading ? 'Scanning bullish momentum...' : 'No strong bullish setup right now.'}
                    onOpenChart={openTradingViewChart}
                />
                <MomentumList
                    title="Strong Bearish"
                    items={data?.bearish || []}
                    tone="bearish"
                    icon={<ArrowDownRight size={14} />}
                    emptyText={loading ? 'Scanning bearish momentum...' : 'No strong bearish setup right now.'}
                    onOpenChart={openTradingViewChart}
                />
            </div>
        </AnimatedCard>
    )
}
