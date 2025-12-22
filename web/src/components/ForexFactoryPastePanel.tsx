import { useMemo, useState } from 'react'
import AnimatedCard from './AnimatedCard'
import GradientButton from './GradientButton'
import { api } from '../lib/api'

type ParsedEvent = {
    id: number
    date: string // ISO
    timeLabel: string
    currency?: string
    event?: string
    actual?: string
    forecast?: string
    previous?: string
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

const DISPLAY_TIMEZONE = 'Asia/Kolkata'

function normalizePair(raw: string) {
    const s = raw.replace('/', '').toUpperCase().replace(/[^A-Z]/g, '')
    return s.length === 6 ? s : ''
}

function ymdInTimeZone(timeZone: string) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date())

    const yyyy = parts.find((p) => p.type === 'year')?.value
    const mm = parts.find((p) => p.type === 'month')?.value
    const dd = parts.find((p) => p.type === 'day')?.value
    if (!yyyy || !mm || !dd) {
        const d = new Date()
        return { yyyy: d.getFullYear(), mm: d.getMonth() + 1, dd: d.getDate() }
    }

    return { yyyy: Number(yyyy), mm: Number(mm), dd: Number(dd) }
}

function parseTimeLabelToMinutes(label: string): number | null {
    const s = label.trim().toLowerCase().replace(/\s+/g, '')
    const m = s.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)$/)
    if (!m) return null
    let hh = Number(m[1])
    const mm = Number(m[2] || '0')
    const ampm = m[3]
    if (hh === 12) hh = 0
    if (ampm === 'pm') hh += 12
    return hh * 60 + mm
}

function isoFromIstToday(timeLabel: string) {
    const minutes = parseTimeLabelToMinutes(timeLabel)
    const { yyyy, mm, dd } = ymdInTimeZone(DISPLAY_TIMEZONE)
    if (minutes === null) return new Date().toISOString()

    // Convert IST -> UTC by subtracting 330 minutes.
    const totalUtcMinutes = minutes - 330
    const utcHour = Math.floor(totalUtcMinutes / 60)
    const utcMin = ((totalUtcMinutes % 60) + 60) % 60

    // Date.UTC normalizes hour under/overflow.
    const utcMs = Date.UTC(yyyy, mm - 1, dd, utcHour, utcMin, 0, 0)
    return new Date(utcMs).toISOString()
}

function splitColumns(line: string) {
    // FF copy/paste often includes tabs between actual/forecast/previous.
    const tabbed = line.split(/\t+/).map((s) => s.trim()).filter(Boolean)
    if (tabbed.length >= 3) return tabbed.slice(0, 3)

    // Fallback: try 3 values separated by multiple spaces.
    const spaced = line.split(/\s{2,}/).map((s) => s.trim()).filter(Boolean)
    if (spaced.length >= 3) return spaced.slice(0, 3)

    return []
}

function parseForexFactoryText(raw: string): ParsedEvent[] {
    const lines = raw
        .split(/\r?\n/)
        .map((l) => l.replace(/\u00A0/g, ' ').trim())
        .filter((l) => l.length > 0)

    let currentTime: string | null = null
    let currentCurrency: string | null = null
    let pendingEventTitle: string | null = null

    const events: ParsedEvent[] = []
    let id = 1

    for (const line of lines) {
        const timeMatch = line.toLowerCase().replace(/\s+/g, '').match(/^(\d{1,2})(?::\d{2})?(am|pm)$/)
        if (timeMatch) {
            currentTime = line.replace(/\s+/g, '').toLowerCase()
            currentCurrency = null
            pendingEventTitle = null
            continue
        }

        const cur = line.toUpperCase().trim()
        if (/^[A-Z]{3}$/.test(cur)) {
            currentCurrency = cur
            pendingEventTitle = null
            continue
        }

        // Sometimes FF has a blank/— currency or country lines; skip obvious noise.
        if (line === '—' || line.toLowerCase() === 'actual' || line.toLowerCase() === 'forecast' || line.toLowerCase() === 'previous') {
            continue
        }

        // If we already have a title pending, this line may be the values row.
        if (pendingEventTitle && currentTime) {
            const cols = splitColumns(line)
            if (cols.length === 3) {
                events.push({
                    id: id++,
                    date: isoFromIstToday(currentTime),
                    timeLabel: currentTime,
                    currency: currentCurrency || undefined,
                    event: pendingEventTitle,
                    actual: cols[0],
                    forecast: cols[1],
                    previous: cols[2],
                })
                pendingEventTitle = null
                continue
            }

            // If no 3 cols, treat as a continuation/notes; ignore and keep waiting.
            continue
        }

        // Otherwise treat this as the event title (if we have time).
        if (currentTime) {
            pendingEventTitle = line
        }
    }

    // If there are titles without a values line, still include them.
    if (pendingEventTitle && currentTime) {
        events.push({
            id: id++,
            date: isoFromIstToday(currentTime),
            timeLabel: currentTime,
            currency: currentCurrency || undefined,
            event: pendingEventTitle,
        })
    }

    return events
}

export default function ForexFactoryPastePanel() {
    const [pair, setPair] = useState('')
    const [currency, setCurrency] = useState('')
    const [text, setText] = useState('')
    const [parseError, setParseError] = useState<string | null>(null)

    const [aiLoading, setAiLoading] = useState(false)
    const [aiError, setAiError] = useState<string | null>(null)
    const [ai, setAi] = useState<CalendarImpact | null>(null)

    const parsed = useMemo(() => {
        try {
            setParseError(null)
            if (!text.trim()) return [] as ParsedEvent[]
            return parseForexFactoryText(text)
        } catch (e: any) {
            setParseError(e?.message || 'Failed to parse pasted ForexFactory text')
            return [] as ParsedEvent[]
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [text])

    const groupedByTime = useMemo(() => {
        const groups: { timeLabel: string; items: ParsedEvent[] }[] = []
        let last: string | null = null
        for (const e of parsed) {
            const key = e.timeLabel || '—'
            if (key !== last) {
                groups.push({ timeLabel: key, items: [e] })
                last = key
            } else {
                groups[groups.length - 1].items.push(e)
            }
        }
        return groups
    }, [parsed])

    const analyze = async () => {
        try {
            setAiLoading(true)
            setAiError(null)
            setAi(null)

            const p = normalizePair(pair)
            const c = currency.trim().toUpperCase()

            const payload = {
                ...(c.length === 3 ? { currency: c } : {}),
                ...(p ? { pair: p } : {}),
                events: parsed.map((e) => ({
                    id: e.id,
                    date: e.date,
                    country: 'ForexFactory',
                    currency: e.currency,
                    event: e.event,
                    category: 'Economic Calendar',
                    actual: e.actual,
                    forecast: e.forecast,
                    previous: e.previous,
                })),
            }

            const { data } = await api.post('/calendar/analyze', payload)
            if (data?.ok) setAi(data.result)
            else setAiError('AI output did not validate. Try again.')
        } catch (e: any) {
            setAiError(e?.response?.data?.error || e?.message || 'Failed to analyze')
        } finally {
            setAiLoading(false)
        }
    }

    return (
        <AnimatedCard disableHover>
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
                <div>
                    <div className="text-2xl font-bold">ForexFactory Calendar (Paste)</div>
                    <div className="text-sm text-neutral-500">Paste today’s FF calendar text here. Timezone: IST</div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                    <input
                        value={pair}
                        onChange={(e) => setPair(e.target.value)}
                        placeholder="Pair (e.g. EURUSD)"
                        className="px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-sm w-[170px]"
                    />
                    <input
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        placeholder="Currency (e.g. USD)"
                        className="px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-sm w-[170px]"
                    />
                    <GradientButton onClick={analyze} disabled={aiLoading || parsed.length === 0}>
                        {aiLoading ? 'Analyzing…' : 'AI analysis'}
                    </GradientButton>
                </div>
            </div>

            <div className="mt-3 flex flex-col gap-2">
                <a
                    href="https://www.forexfactory.com/calendar"
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm underline text-neutral-300 hover:text-neutral-100"
                >
                    Open ForexFactory Calendar
                </a>
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Paste ForexFactory calendar rows here (time, currency, event, actual/forecast/previous)…"
                    className="min-h-[140px] w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-sm"
                />
                <div className="text-xs text-neutral-500">Parsed events: {parsed.length}</div>
                {parseError && <div className="text-sm text-red-300">{parseError}</div>}
            </div>

            {aiError && <div className="mt-3 text-sm text-red-300">{aiError}</div>}
            {ai && (
                <div className="mt-4 p-4 rounded-xl border border-neutral-800 bg-neutral-950">
                    <div className="text-sm font-semibold">AI Summary & Bias</div>
                    <div className="text-xs text-neutral-500 mt-1">Focus: {ai.focus?.pair || ai.focus?.currency || 'General FX'}</div>
                    <div className="mt-2 text-sm text-neutral-200 leading-relaxed">{ai.summary}</div>
                </div>
            )}

            <div className="mt-4 border border-neutral-800 rounded-xl overflow-hidden">
                <div className="max-h-[520px] overflow-auto">
                    {parsed.length === 0 ? (
                        <div className="p-4 text-sm text-neutral-500">Paste ForexFactory calendar text to see events.</div>
                    ) : (
                        <div className="divide-y divide-neutral-800">
                            {groupedByTime.map((g, idx) => (
                                <div key={`${g.timeLabel}-${idx}`}>
                                    <div className="px-4 py-2 bg-neutral-950/60 text-xs text-neutral-400 font-semibold">{g.timeLabel}</div>
                                    <div className="divide-y divide-neutral-800">
                                        {g.items.map((e) => (
                                            <div key={e.id} className="p-4">
                                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                                                    <div className="flex items-center gap-3">
                                                        <div className="text-xs px-2 py-1 rounded border border-neutral-800 bg-neutral-900 text-neutral-300 w-[56px] text-center">
                                                            {e.currency || '—'}
                                                        </div>
                                                        <div className="text-sm font-semibold">{e.event || 'Event'}</div>
                                                    </div>
                                                </div>

                                                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                                    <div className="p-2 rounded border border-neutral-800 bg-neutral-900">
                                                        <div className="text-neutral-500">Actual</div>
                                                        <div className="text-neutral-200 font-semibold">{e.actual || '—'}</div>
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
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </AnimatedCard>
    )
}
