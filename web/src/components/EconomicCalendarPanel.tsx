import { useEffect, useMemo, useState } from 'react'
import AnimatedCard from './AnimatedCard'
import GradientButton from './GradientButton'
import { api } from '../lib/api'

type CalendarEvent = {
    id: number
    date: string
    country?: string
    currency?: string
    category?: string
    event?: string
    importance?: 1 | 2 | 3
    actual?: string
    forecast?: string
    previous?: string
    unit?: string
    source?: string
    link?: string
}

type CalendarImpact = {
    focus: { currency?: string; pair?: string }
    summary: string
    impactedCurrencies: string[]
    currencyImpacts: { currency: string; impact: 'supportive' | 'negative' | 'neutral' | 'mixed'; reasons: string[] }[]
    shortTerm: { bias: 'bullish' | 'bearish' | 'neutral' | 'mixed'; confidence: number; reasons: string[] }
    longTerm: { bias: 'bullish' | 'bearish' | 'neutral' | 'mixed'; confidence: number; reasons: string[] }
    keyEvents: string[]
    keyRisks: string[]
}

const currencyOptions = ['', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'NZD', 'CAD', 'CHF', 'CNY'] as const

const DISPLAY_TIMEZONE = 'Asia/Kolkata'
const DISPLAY_TZ_LABEL = 'IST'

type ImportanceFilter = '' | '3' | '2' | '1'

function normalizePair(raw: string) {
    const s = raw.replace('/', '').toUpperCase().replace(/[^A-Z]/g, '')
    return s.length === 6 ? s : ''
}

function fmtTime(iso: string) {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
        .format(d)
        .replace(/\s+/g, '')
        .toLowerCase()
}

function fmtTimeIST(iso: string) {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    return new Intl.DateTimeFormat('en-US', {
        timeZone: DISPLAY_TIMEZONE,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    })
        .format(d)
        .replace(/\s+/g, '')
        .toLowerCase()
}

function importanceLabel(i?: number) {
    if (i === 3) return 'High'
    if (i === 2) return 'Med'
    if (i === 1) return 'Low'
    return ''
}

const MAJOR_PAIRS = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'NZDUSD', 'USDCAD'] as const

function majorPairsForCurrency(currency?: string) {
    const c = (currency || '').trim().toUpperCase()
    if (!c) return [] as string[]
    return MAJOR_PAIRS.filter((p) => p.includes(c)) as unknown as string[]
}

function ImpactDots({ importance }: { importance?: 1 | 2 | 3 }) {
    const level = importance || 0
    const activeClass = level === 3 ? 'bg-red-400' : level === 2 ? 'bg-yellow-400' : level === 1 ? 'bg-neutral-400' : 'bg-neutral-800'
    return (
        <div className="flex items-center gap-1" aria-label={importanceLabel(level)}>
            {[1, 2, 3].map((i) => (
                <span
                    key={i}
                    className={`inline-block h-2 w-2 rounded-full border border-neutral-800 ${i <= level ? activeClass : 'bg-neutral-900'}`}
                />
            ))}
        </div>
    )
}

export default function EconomicCalendarPanel() {
    const [events, setEvents] = useState<CalendarEvent[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [currency, setCurrency] = useState<string>('')
    const [importance, setImportance] = useState<ImportanceFilter>('')
    const [pair, setPair] = useState<string>('')

    const [aiLoading, setAiLoading] = useState(false)
    const [aiError, setAiError] = useState<string | null>(null)
    const [ai, setAi] = useState<CalendarImpact | null>(null)

    const params = useMemo(() => {
        return {
            ...(currency ? { currency } : {}),
            ...(importance ? { importance: Number(importance) } : {}),
        }
    }, [currency, importance])

    const groupedByTime = useMemo(() => {
        const groups: { timeLabel: string; items: CalendarEvent[] }[] = []
        let lastKey: string | null = null

        for (const event of events) {
            const timeLabel = fmtTimeIST(event.date) || '—'
            if (timeLabel !== lastKey) {
                groups.push({ timeLabel, items: [event] })
                lastKey = timeLabel
            } else {
                groups[groups.length - 1].items.push(event)
            }
        }

        return groups
    }, [events])

    const refresh = async () => {
        try {
            setLoading(true)
            setError(null)
            const { data } = await api.get('/calendar/today', { params })
            setEvents(Array.isArray(data?.events) ? data.events : [])
        } catch (e: any) {
            setError(e?.response?.data?.error || e?.message || 'Failed to load calendar')
            setEvents([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        refresh()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currency, importance])

    const analyze = async () => {
        try {
            setAiLoading(true)
            setAiError(null)
            setAi(null)
            const p = normalizePair(pair)
            const payload = {
                ...(currency ? { currency } : {}),
                ...(p ? { pair: p } : {}),
                events: events.slice(0, 250),
            }
            const { data } = await api.post('/calendar/analyze', payload)
            if (data?.ok) setAi(data.result)
            else setAiError('AI output did not validate. Try again.')
        } catch (e: any) {
            setAiError(e?.response?.data?.error || e?.message || 'Failed to analyze calendar')
        } finally {
            setAiLoading(false)
        }
    }

    return (
        <AnimatedCard disableHover>
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
                <div>
                    <div className="text-2xl font-bold">Economic Calendar (Today)</div>
                    <div className="text-sm text-neutral-500">ForexFactory-style view using TradingEconomics (free guest access) · Timezone: {DISPLAY_TZ_LABEL}</div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                    <div className="flex gap-2">
                        <input
                            value={pair}
                            onChange={(e) => setPair(e.target.value)}
                            placeholder="Pair (e.g. EURUSD)"
                            className="px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-sm w-[170px]"
                        />
                        <select
                            value={currency}
                            onChange={(e) => setCurrency(e.target.value)}
                            className="px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-sm"
                        >
                            {currencyOptions.map((c) => (
                                <option key={c || 'all'} value={c}>
                                    {c ? c : 'All currencies'}
                                </option>
                            ))}
                        </select>
                        <select
                            value={importance}
                            onChange={(e) => setImportance(e.target.value as ImportanceFilter)}
                            className="px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-sm"
                        >
                            <option value="">All impact</option>
                            <option value="3">High</option>
                            <option value="2">Medium</option>
                            <option value="1">Low</option>
                        </select>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={refresh}
                            className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg hover:border-neutral-500 transition-colors text-sm"
                            disabled={loading}
                        >
                            {loading ? 'Refreshing…' : 'Refresh'}
                        </button>
                        <GradientButton onClick={analyze} disabled={aiLoading || events.length === 0}>
                            {aiLoading ? 'Analyzing…' : 'AI analysis'}
                        </GradientButton>
                    </div>
                </div>
            </div>

            {error && <div className="mt-3 text-sm text-red-300">{error}</div>}
            {aiError && <div className="mt-3 text-sm text-red-300">{aiError}</div>}

            {ai && (
                <div className="mt-4 p-4 rounded-xl border border-neutral-800 bg-neutral-950">
                    <div className="text-sm font-semibold">AI Summary & Bias</div>
                    <div className="text-xs text-neutral-500 mt-1">
                        Focus: {ai.focus?.pair || ai.focus?.currency || 'General FX'}
                    </div>
                    {!!ai.focus?.currency && !ai.focus?.pair && majorPairsForCurrency(ai.focus.currency).length > 0 && (
                        <div className="text-xs text-neutral-500 mt-1">
                            Major pairs: {majorPairsForCurrency(ai.focus.currency).join(', ')}
                        </div>
                    )}
                    <div className="mt-2 text-sm text-neutral-200 leading-relaxed">{ai.summary}</div>

                    {!!ai.currencyImpacts?.length && (
                        <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
                            {ai.currencyImpacts.slice(0, 6).map((ci) => (
                                <div key={ci.currency} className="p-3 rounded-lg border border-neutral-800 bg-neutral-900">
                                    <div className="text-sm font-semibold">{ci.currency}</div>
                                    <div className="text-xs text-neutral-400 mt-1">Impact: {ci.impact}</div>
                                    <ul className="text-xs text-neutral-300 mt-2 list-disc pl-5 space-y-1">
                                        {ci.reasons.map((r, idx) => (
                                            <li key={idx}>{r}</li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
                        <div className="p-3 rounded-lg border border-neutral-800 bg-neutral-900">
                            <div className="text-sm font-semibold">Short-term (1–3 days)</div>
                            <div className="text-sm text-neutral-200 mt-1">
                                Bias: <span className="font-semibold">{ai.shortTerm.bias}</span> · Conf: {(ai.shortTerm.confidence * 100).toFixed(0)}%
                            </div>
                            <ul className="text-xs text-neutral-300 mt-2 list-disc pl-5 space-y-1">
                                {ai.shortTerm.reasons.map((r, idx) => (
                                    <li key={idx}>{r}</li>
                                ))}
                            </ul>
                        </div>
                        <div className="p-3 rounded-lg border border-neutral-800 bg-neutral-900">
                            <div className="text-sm font-semibold">Long-term (2–8 weeks)</div>
                            <div className="text-sm text-neutral-200 mt-1">
                                Bias: <span className="font-semibold">{ai.longTerm.bias}</span> · Conf: {(ai.longTerm.confidence * 100).toFixed(0)}%
                            </div>
                            <ul className="text-xs text-neutral-300 mt-2 list-disc pl-5 space-y-1">
                                {ai.longTerm.reasons.map((r, idx) => (
                                    <li key={idx}>{r}</li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {!!ai.keyEvents?.length && (
                        <div className="mt-3 text-xs text-neutral-300">
                            <span className="text-neutral-500">Key events:</span> {ai.keyEvents.join(' · ')}
                        </div>
                    )}
                    {!!ai.keyRisks?.length && (
                        <div className="mt-2 text-xs text-neutral-300">
                            <span className="text-neutral-500">Key risks:</span> {ai.keyRisks.join(' · ')}
                        </div>
                    )}
                </div>
            )}

            <div className="mt-4 border border-neutral-800 rounded-xl overflow-hidden">
                <div className="max-h-[520px] overflow-auto">
                    {loading && events.length === 0 ? (
                        <div className="p-4 text-sm text-neutral-500">Loading calendar…</div>
                    ) : events.length === 0 ? (
                        <div className="p-4 text-sm text-neutral-500">No events found.</div>
                    ) : (
                        <div className="divide-y divide-neutral-800">
                            {groupedByTime.map((group, groupIdx) => (
                                <div key={`${group.timeLabel}-${groupIdx}`}>
                                    <div className="px-4 py-2 bg-neutral-950/60 text-xs text-neutral-400 font-semibold">{group.timeLabel}</div>
                                    <div className="divide-y divide-neutral-800">
                                        {group.items.map((e) => {
                                            const t = Date.parse(e.date)
                                            const isFuture = Number.isFinite(t) ? t - Date.now() > 2 * 60 * 1000 : false
                                            const actualValue = isFuture ? undefined : e.actual

                                            return (
                                                <div key={e.id} className="p-4">
                                                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                                                        <div className="flex items-center gap-3">
                                                            <div className="text-xs px-2 py-1 rounded border border-neutral-800 bg-neutral-900 text-neutral-300 w-[56px] text-center">
                                                                {e.currency || '—'}
                                                            </div>
                                                            <ImpactDots importance={e.importance} />
                                                            <div className="text-sm font-semibold">
                                                                {e.link ? (
                                                                    <a href={e.link} target="_blank" rel="noreferrer" className="hover:underline">
                                                                        {e.event || e.category || 'Event'}
                                                                    </a>
                                                                ) : (
                                                                    <span>{e.event || e.category || 'Event'}</span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="text-xs text-neutral-500">{e.country ? `${e.country}` : ''}</div>
                                                    </div>

                                                    {e.category && e.event && e.category !== e.event && (
                                                        <div className="text-xs text-neutral-500 mt-1">{e.category}</div>
                                                    )}

                                                    {majorPairsForCurrency(e.currency).length > 0 && (
                                                        <div className="text-xs text-neutral-500 mt-1">
                                                            Major pairs: {majorPairsForCurrency(e.currency).join(', ')}
                                                        </div>
                                                    )}

                                                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                                        <div className="p-2 rounded border border-neutral-800 bg-neutral-900">
                                                            <div className="text-neutral-500">Actual</div>
                                                            <div className="text-neutral-200 font-semibold">{actualValue || '—'}</div>
                                                        </div>
                                                        <div className="p-2 rounded border border-neutral-800 bg-neutral-900">
                                                            <div className="text-neutral-500">Forecast</div>
                                                            <div className="text-neutral-200 font-semibold">{e.forecast || '—'}</div>
                                                        </div>
                                                        <div className="p-2 rounded border border-neutral-800 bg-neutral-900">
                                                            <div className="text-neutral-500">Previous</div>
                                                            <div className="text-neutral-200 font-semibold">{e.previous || '—'}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-2 text-xs text-neutral-500">
                Source: TradingEconomics calendar (free guest access unless you set <span className="font-mono">TRADING_ECONOMICS_API_KEY</span> in server env).
            </div>
        </AnimatedCard>
    )
}
