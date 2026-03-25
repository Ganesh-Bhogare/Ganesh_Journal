import { useEffect, useMemo, useState } from 'react'
import AnimatedCard from './AnimatedCard'
import GradientButton from './GradientButton'
import { api } from '../lib/api'

type NewsItem = {
    id?: string
    title: string
    link?: string
    source: string
    publishedAt?: string
    summary?: string
    currencies?: string[]
    pairs?: string[]
}

type ImpactLevel = 'high' | 'medium' | 'low'
type DirectionBias = 'bullish' | 'bearish' | 'mixed' | 'neutral'
type NewsCategory = 'Macro' | 'Central Bank' | 'Geopolitical' | 'Data Release' | 'Risk Event' | 'General'

type NewsBias = {
    focus: { currency?: string; pair?: string }
    summary: string
    impactedCurrencies: string[]
    currencyImpacts: { currency: string; impact: 'supportive' | 'negative' | 'neutral' | 'mixed'; reasons: string[] }[]
    shortTerm: { bias: 'bullish' | 'bearish' | 'neutral' | 'mixed'; confidence: number; reasons: string[] }
    longTerm: { bias: 'bullish' | 'bearish' | 'neutral' | 'mixed'; confidence: number; reasons: string[] }
    watchlistPairs: string[]
    keyRisks: string[]
}

const currencyOptions = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'NZD', 'CAD', 'CHF'] as const

const categoryOptions: NewsCategory[] = ['Macro', 'Central Bank', 'Geopolitical', 'Data Release', 'Risk Event', 'General']

function textBlob(item: NewsItem) {
    return `${item.title || ''} ${item.summary || ''}`.toLowerCase()
}

function detectCategory(item: NewsItem): NewsCategory {
    const txt = textBlob(item)
    if (/fed|ecb|boe|boj|rba|rbnz|boc|snb|interest rate|fomc|policy/.test(txt)) return 'Central Bank'
    if (/cpi|ppi|nfp|payroll|pmi|inflation|unemployment|gdp|retail sales/.test(txt)) return 'Data Release'
    if (/war|sanction|election|tariff|conflict|diplomatic|ceasefire/.test(txt)) return 'Geopolitical'
    if (/risk|volatility|liquidity|flash crash|default|banking stress/.test(txt)) return 'Risk Event'
    if (/growth|recession|yield|debt|fiscal|budget|macro/.test(txt)) return 'Macro'
    return 'General'
}

function detectImpact(item: NewsItem): ImpactLevel {
    const txt = textBlob(item)
    const highSignals = /breaking|unexpected|surprise|emergency|rate decision|fomc|ecb|nfp|cpi|war|default|intervention/
    const medSignals = /speech|minutes|forecast|guidance|pmi|sentiment|retail/
    if (highSignals.test(txt)) return 'high'
    if (medSignals.test(txt)) return 'medium'
    return 'low'
}

function detectDirection(item: NewsItem): DirectionBias {
    const txt = textBlob(item)
    const bull = /(rises|upbeat|hawkish|strong|beat|surge|supportive|optimism|expansion)/.test(txt)
    const bear = /(falls|dovish|weak|miss|drop|negative|concern|contraction|slowdown)/.test(txt)
    if (bull && bear) return 'mixed'
    if (bull) return 'bullish'
    if (bear) return 'bearish'
    return 'neutral'
}

function impactClasses(level: ImpactLevel) {
    if (level === 'high') return 'bg-red-500/20 text-red-300 border-red-400/40'
    if (level === 'medium') return 'bg-yellow-500/20 text-yellow-300 border-yellow-400/40'
    return 'bg-blue-500/20 text-blue-300 border-blue-400/40'
}

function directionClasses(direction: DirectionBias) {
    if (direction === 'bullish') return 'bg-green-500/20 text-green-300 border-green-400/40'
    if (direction === 'bearish') return 'bg-red-500/20 text-red-300 border-red-400/40'
    if (direction === 'mixed') return 'bg-orange-500/20 text-orange-300 border-orange-400/40'
    return 'bg-neutral-700/60 text-neutral-300 border-neutral-500/40'
}

function fmtDate(iso?: string) {
    if (!iso) return ''
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleString()
}

export default function NewsPanel({ defaultPair, days = 7, title = 'News' }: { defaultPair?: string; days?: number; title?: string }) {
    const [items, setItems] = useState<NewsItem[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [pair, setPair] = useState((defaultPair || '').toUpperCase())
    const [currency, setCurrency] = useState<string>('')
    const [selectedCategory, setSelectedCategory] = useState<NewsCategory | 'All'>('All')
    const [searchText, setSearchText] = useState('')
    const [highImpactOnly, setHighImpactOnly] = useState(false)

    const [biasLoading, setBiasLoading] = useState(false)
    const [biasError, setBiasError] = useState<string | null>(null)
    const [bias, setBias] = useState<NewsBias | null>(null)

    useEffect(() => {
        setPair((defaultPair || '').toUpperCase())
    }, [defaultPair])

    const queryParams = useMemo(() => {
        const p = pair.replace('/', '').trim().toUpperCase()
        const c = currency.trim().toUpperCase()
        return {
            limit: 200,
            days,
            ...(p.length === 6 ? { pair: p } : {}),
            ...(c.length === 3 ? { currency: c } : {}),
        }
    }, [pair, currency, days])

    const refresh = async () => {
        try {
            setLoading(true)
            setError(null)
            const { data } = await api.get('/news', { params: queryParams })
            if (data?.ok === false) {
                setItems([])
                setError(String(data?.error || 'News not configured on server'))
                return
            }
            setItems(Array.isArray(data?.items) ? data.items : [])
        } catch (e: any) {
            setError(e?.response?.data?.error || e?.message || 'Failed to load news')
            setItems([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        refresh()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [queryParams.pair, queryParams.currency])

    const analyze = async () => {
        try {
            setBiasLoading(true)
            setBiasError(null)
            setBias(null)

            const p = pair.replace('/', '').trim().toUpperCase()
            const c = currency.trim().toUpperCase()

            const payload = {
                ...(c.length === 3 ? { currency: c } : {}),
                ...(p.length === 6 ? { pair: p } : {}),
                items: items.slice(0, 80),
            }

            const { data } = await api.post('/news/analyze', payload)
            if (data?.ok) {
                setBias(data.result)
            } else {
                setBiasError('AI output did not validate. Try again or reduce feeds/items.')
            }
        } catch (e: any) {
            setBiasError(e?.response?.data?.error || e?.message || 'Failed to analyze news')
        } finally {
            setBiasLoading(false)
        }
    }

    const enrichedItems = useMemo(() => {
        return items.map((item) => ({
            ...item,
            category: detectCategory(item),
            impact: detectImpact(item),
            direction: detectDirection(item),
        }))
    }, [items])

    const filteredItems = useMemo(() => {
        const q = searchText.trim().toLowerCase()
        return enrichedItems.filter((item) => {
            if (selectedCategory !== 'All' && item.category !== selectedCategory) return false
            if (highImpactOnly && item.impact !== 'high') return false
            if (!q) return true
            return (`${item.title} ${item.summary || ''} ${item.source || ''}`.toLowerCase().includes(q))
        })
    }, [enrichedItems, selectedCategory, highImpactOnly, searchText])

    const bigPicture = useMemo(() => {
        const top = filteredItems
            .slice()
            .sort((a, b) => {
                const score = (i: typeof a) => (i.impact === 'high' ? 3 : i.impact === 'medium' ? 2 : 1)
                const timeA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0
                const timeB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0
                return score(b) - score(a) || timeB - timeA
            })
            .slice(0, 3)

        return top.map((item) => {
            const focus = item.pairs?.[0] || item.currencies?.[0] || 'FX'
            return `${item.category}: ${item.title} (${focus}, ${item.direction})`
        })
    }, [filteredItems])

    return (
        <AnimatedCard disableHover>
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
                <div>
                    <div className="text-lg font-semibold">{title}</div>
                    <div className="text-xs text-neutral-500">Chronological feed + AI impact + bias</div>
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
                            <option value="">All currencies</option>
                            {currencyOptions.map((c) => (
                                <option key={c} value={c}>
                                    {c}
                                </option>
                            ))}
                        </select>
                    </div>
                    <input
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        placeholder="Search headline/source"
                        className="px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-sm w-[220px]"
                    />
                    <div className="flex gap-2">
                        <button
                            onClick={() => setHighImpactOnly((v) => !v)}
                            className={`px-3 py-2 rounded-lg border text-sm transition-colors ${highImpactOnly ? 'bg-red-500/20 border-red-400/50 text-red-200' : 'bg-neutral-800 border-neutral-700 hover:border-neutral-500'}`}
                        >
                            High impact only
                        </button>
                        <button
                            onClick={refresh}
                            className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg hover:border-neutral-500 transition-colors text-sm"
                            disabled={loading}
                        >
                            {loading ? 'Refreshing…' : 'Refresh'}
                        </button>
                        <GradientButton onClick={analyze} disabled={biasLoading || items.length === 0}>
                            {biasLoading ? 'Analyzing…' : 'AI bias'}
                        </GradientButton>
                    </div>
                </div>
            </div>

            {error && <div className="mt-3 text-sm text-red-300">{error}</div>}

            {biasError && <div className="mt-3 text-sm text-red-300">{biasError}</div>}

            <div className="mt-4 p-4 rounded-xl border border-neutral-800 bg-neutral-950">
                <div className="text-sm font-semibold">Today's Big Picture</div>
                {bigPicture.length > 0 ? (
                    <ul className="mt-2 text-sm text-neutral-300 list-disc pl-5 space-y-1">
                        {bigPicture.map((line, idx) => (
                            <li key={`${line}-${idx}`}>{line}</li>
                        ))}
                    </ul>
                ) : (
                    <div className="mt-2 text-sm text-neutral-500">No narrative available for current filters.</div>
                )}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
                <button
                    onClick={() => setSelectedCategory('All')}
                    className={`px-3 py-1.5 rounded-full border text-xs ${selectedCategory === 'All' ? 'bg-neutral-200 text-neutral-900 border-neutral-200' : 'bg-neutral-900 border-neutral-700 text-neutral-300'}`}
                >
                    All
                </button>
                {categoryOptions.map((cat) => (
                    <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3 py-1.5 rounded-full border text-xs ${selectedCategory === cat ? 'bg-neutral-200 text-neutral-900 border-neutral-200' : 'bg-neutral-900 border-neutral-700 text-neutral-300'}`}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {bias && (
                <div className="mt-4 p-4 rounded-xl border border-neutral-800 bg-neutral-950">
                    <div className="text-sm font-semibold">AI Bias</div>
                    <div className="text-xs text-neutral-500 mt-1">
                        Focus: {bias.focus?.pair || bias.focus?.currency || 'General FX'}
                    </div>

                    <div className="mt-3 text-sm text-neutral-200 leading-relaxed">
                        {bias.summary}
                    </div>

                    {!!bias.currencyImpacts?.length && (
                        <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
                            {bias.currencyImpacts.slice(0, 6).map((ci) => (
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
                                Bias: <span className="font-semibold">{bias.shortTerm.bias}</span> · Conf: {(bias.shortTerm.confidence * 100).toFixed(0)}%
                            </div>
                            <ul className="text-xs text-neutral-300 mt-2 list-disc pl-5 space-y-1">
                                {bias.shortTerm.reasons.map((r, idx) => (
                                    <li key={idx}>{r}</li>
                                ))}
                            </ul>
                        </div>
                        <div className="p-3 rounded-lg border border-neutral-800 bg-neutral-900">
                            <div className="text-sm font-semibold">Long-term (2–8 weeks)</div>
                            <div className="text-sm text-neutral-200 mt-1">
                                Bias: <span className="font-semibold">{bias.longTerm.bias}</span> · Conf: {(bias.longTerm.confidence * 100).toFixed(0)}%
                            </div>
                            <ul className="text-xs text-neutral-300 mt-2 list-disc pl-5 space-y-1">
                                {bias.longTerm.reasons.map((r, idx) => (
                                    <li key={idx}>{r}</li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {!!bias.watchlistPairs?.length && (
                        <div className="mt-3 text-xs text-neutral-300">
                            <span className="text-neutral-500">Watchlist pairs:</span> {bias.watchlistPairs.join(', ')}
                        </div>
                    )}
                    {!!bias.keyRisks?.length && (
                        <div className="mt-2 text-xs text-neutral-300">
                            <span className="text-neutral-500">Key risks:</span> {bias.keyRisks.join(' · ')}
                        </div>
                    )}
                </div>
            )}

            <div className="mt-4 border border-neutral-800 rounded-xl overflow-hidden">
                <div className="max-h-[520px] overflow-auto">
                    {loading && filteredItems.length === 0 ? (
                        <div className="p-4 text-sm text-neutral-500">Loading news…</div>
                    ) : filteredItems.length === 0 ? (
                        <div className="p-4 text-sm text-neutral-500">No news items.</div>
                    ) : (
                        <div className="divide-y divide-neutral-800">
                            {filteredItems.map((it, idx) => (
                                <div key={(it.id || it.link || it.title) + ':' + idx} className="p-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                                        <div className="text-xs text-neutral-500">
                                            {fmtDate(it.publishedAt)} {it.source ? `• ${it.source}` : ''}
                                        </div>
                                        <div className="text-xs text-neutral-500">
                                            {(it.pairs || []).slice(0, 4).join(', ')}
                                            {(it.currencies || []).length ? (it.pairs?.length ? ' • ' : '') + (it.currencies || []).slice(0, 4).join(', ') : ''}
                                        </div>
                                    </div>
                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded-full border text-[11px] uppercase tracking-wide ${impactClasses(it.impact)}`}>
                                            {it.impact} impact
                                        </span>
                                        <span className="px-2 py-0.5 rounded-full border border-neutral-600/60 text-[11px] text-neutral-300 uppercase tracking-wide">
                                            {it.category}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded-full border text-[11px] uppercase tracking-wide ${directionClasses(it.direction)}`}>
                                            {it.direction}
                                        </span>
                                    </div>
                                    {it.link ? (
                                        <a href={it.link} target="_blank" rel="noreferrer" className="block mt-1 text-sm font-semibold hover:underline">
                                            {it.title}
                                        </a>
                                    ) : (
                                        <div className="mt-1 text-sm font-semibold">{it.title}</div>
                                    )}
                                    {it.summary && <div className="mt-1 text-xs text-neutral-300 line-clamp-3">{it.summary}</div>}
                                    <div className="mt-2 text-xs text-neutral-500">
                                        Why it matters: {it.direction === 'neutral' ? 'Directional signal is unclear, monitor follow-up data.' : `Signals appear ${it.direction} for related FX instruments.`}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-2 text-xs text-neutral-500">
                Tip: configure feeds via <span className="font-mono">NEWS_FEEDS</span> on the server.
            </div>
        </AnimatedCard>
    )
}
