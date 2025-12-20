import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CandlestickSeries, createChart, createSeriesMarkers, type CandlestickData, type IChartApi, type SeriesMarker, type Time, type UTCTimestamp } from 'lightweight-charts'
import AnimatedCard from '../components/AnimatedCard'
import GradientButton from '../components/GradientButton'
import { api } from '../lib/api'

type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h'

function toUtcSeconds(d: Date): UTCTimestamp {
    return Math.floor(d.getTime() / 1000) as UTCTimestamp
}

function safeNumber(v: any): number | undefined {
    const n = typeof v === 'number' ? v : Number(v)
    return Number.isFinite(n) ? n : undefined
}

function parseCsvCandles(csvText: string): CandlestickData[] {
    const lines = csvText
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(Boolean)

    if (lines.length === 0) return []

    const header = lines[0].split(',').map(h => h.trim().toLowerCase())
    const hasHeader = header.some(h => ['time', 'date', 'datetime', 'open', 'high', 'low', 'close'].includes(h))

    const idx = (name: string) => header.indexOf(name)

    const timeIndex = hasHeader ? (idx('time') !== -1 ? idx('time') : idx('date') !== -1 ? idx('date') : idx('datetime')) : 0
    const openIndex = hasHeader ? idx('open') : 1
    const highIndex = hasHeader ? idx('high') : 2
    const lowIndex = hasHeader ? idx('low') : 3
    const closeIndex = hasHeader ? idx('close') : 4

    const start = hasHeader ? 1 : 0

    const out: CandlestickData[] = []
    for (let i = start; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim())
        if (cols.length < 5) continue

        const rawTime = cols[timeIndex]
        let time: UTCTimestamp | undefined

        if (/^\d+$/.test(rawTime)) {
            const n = Number(rawTime)
            // Heuristic: ms timestamps are much larger
            time = Math.floor(n > 2_000_000_000 ? n / 1000 : n) as UTCTimestamp
        } else {
            const d = new Date(rawTime)
            if (!Number.isNaN(d.getTime())) time = toUtcSeconds(d)
        }

        const open = safeNumber(cols[openIndex])
        const high = safeNumber(cols[highIndex])
        const low = safeNumber(cols[lowIndex])
        const close = safeNumber(cols[closeIndex])

        if (!time || open === undefined || high === undefined || low === undefined || close === undefined) continue
        out.push({ time, open, high, low, close })
    }

    return out.sort((a, b) => Number(a.time) - Number(b.time))
}

export default function TradeChart() {
    const navigate = useNavigate()
    const [params] = useSearchParams()

    const tradeId = params.get('tradeId') || ''

    const [loading, setLoading] = useState(true)
    const [trade, setTrade] = useState<any>(null)
    const [timeframe, setTimeframe] = useState<Timeframe>('5m')
    const [candles, setCandles] = useState<CandlestickData[]>([])
    const [uploadingSnapshot, setUploadingSnapshot] = useState(false)
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    const storageKey = useMemo(() => {
        const instrument = String(trade?.instrument || 'unknown')
        return `candles:${instrument}:${timeframe}`
    }, [trade?.instrument, timeframe])

    const chartContainerRef = useRef<HTMLDivElement | null>(null)
    const chartRef = useRef<IChartApi | null>(null)

    const fileUrl = (path: string | undefined) => {
        if (!path) return undefined
        if (/^https?:\/\//i.test(path)) return path
        const base = (api.defaults.baseURL || '').replace(/\/api\/?$/, '')
        return `${base}${path}`
    }

    useEffect(() => {
        const fetchTrade = async () => {
            if (!tradeId) {
                setLoading(false)
                return
            }
            try {
                setLoading(true)
                const { data } = await api.get(`/trades/${encodeURIComponent(tradeId)}`)
                setTrade(data)
            } catch (err) {
                console.error('Failed to load trade', err)
                setTrade(null)
            } finally {
                setLoading(false)
            }
        }

        fetchTrade()
    }, [tradeId])

    useEffect(() => {
        // load saved candles for this instrument + timeframe
        try {
            const raw = localStorage.getItem(storageKey)
            if (!raw) {
                setCandles([])
                return
            }
            const parsed = JSON.parse(raw) as CandlestickData[]
            if (Array.isArray(parsed)) setCandles(parsed)
            else setCandles([])
        } catch {
            setCandles([])
        }
    }, [storageKey])

    useEffect(() => {
        const el = chartContainerRef.current
        if (!el) return

        let disposed = false

        const chart = createChart(el, {
            height: 520,
            layout: {
                background: { color: 'transparent' },
                textColor: '#a3a3a3',
            },
            grid: {
                vertLines: { color: 'rgba(255,255,255,0.04)' },
                horzLines: { color: 'rgba(255,255,255,0.04)' },
            },
            timeScale: {
                rightOffset: 6,
                borderColor: 'rgba(255,255,255,0.08)',
                timeVisible: true,
                secondsVisible: false,
            },
            rightPriceScale: {
                borderColor: 'rgba(255,255,255,0.08)',
            },
            crosshair: {
                vertLine: { color: 'rgba(255,255,255,0.15)' },
                horzLine: { color: 'rgba(255,255,255,0.15)' },
            },
        })

        chartRef.current = chart

        const series = chart.addSeries(CandlestickSeries, {
            upColor: '#22c55e',
            downColor: '#ef4444',
            wickUpColor: '#22c55e',
            wickDownColor: '#ef4444',
            borderVisible: false,
        })

        if (candles.length) {
            series.setData(candles)
        }

        const direction = String(trade?.direction || '').toLowerCase()
        const entryPrice = safeNumber(trade?.entryPrice)
        const stopLoss = safeNumber(trade?.stopLoss)
        const takeProfit = safeNumber(trade?.takeProfit)
        const exitPrice = safeNumber(trade?.exitPrice)

        if (entryPrice !== undefined) {
            series.createPriceLine({
                price: entryPrice,
                color: 'rgba(250, 204, 21, 0.9)',
                lineWidth: 2,
                lineStyle: 0,
                axisLabelVisible: true,
                title: 'Entry',
            })
        }
        if (stopLoss !== undefined) {
            series.createPriceLine({
                price: stopLoss,
                color: 'rgba(239, 68, 68, 0.9)',
                lineWidth: 2,
                lineStyle: 2,
                axisLabelVisible: true,
                title: 'SL',
            })
        }
        if (takeProfit !== undefined) {
            series.createPriceLine({
                price: takeProfit,
                color: 'rgba(34, 197, 94, 0.9)',
                lineWidth: 2,
                lineStyle: 2,
                axisLabelVisible: true,
                title: 'TP',
            })
        }

        const entryTime = trade?.entryTime ? new Date(trade.entryTime) : trade?.date ? new Date(trade.date) : undefined
        const exitTime = trade?.exitTime ? new Date(trade.exitTime) : undefined

        const markers: SeriesMarker<Time>[] = []

        if (entryTime && !Number.isNaN(entryTime.getTime())) {
            markers.push({
                time: toUtcSeconds(entryTime),
                position: direction === 'short' ? 'aboveBar' : 'belowBar',
                color: direction === 'short' ? '#ef4444' : '#22c55e',
                shape: direction === 'short' ? 'arrowDown' : 'arrowUp',
                text: 'Entry',
            })
        }

        if (exitTime && !Number.isNaN(exitTime.getTime())) {
            const outcome = String(trade?.outcome || '').toLowerCase()
            const color = outcome === 'win' ? '#22c55e' : outcome === 'loss' ? '#ef4444' : '#a3a3a3'
            markers.push({
                time: toUtcSeconds(exitTime),
                position: direction === 'short' ? 'belowBar' : 'aboveBar',
                color,
                shape: 'circle',
                text: 'Exit',
            })
        }

        if (markers.length) {
            createSeriesMarkers(series, markers)
        }

        if (exitPrice !== undefined) {
            const outcome = String(trade?.outcome || '').toLowerCase()
            const color = outcome === 'win' ? 'rgba(34,197,94,0.85)' : outcome === 'loss' ? 'rgba(239,68,68,0.85)' : 'rgba(163,163,163,0.85)'
            series.createPriceLine({
                price: exitPrice,
                color,
                lineWidth: 2,
                lineStyle: 3,
                axisLabelVisible: true,
                title: 'Exit',
            })
        }

        if (candles.length) {
            chart.timeScale().fitContent()
        }

        const ro = new ResizeObserver(() => {
            if (disposed) return
            chart.resize(el.clientWidth, 520)
        })
        ro.observe(el)

        return () => {
            disposed = true
            ro.disconnect()
            if (chartRef.current === chart) chartRef.current = null
            chart.remove()
        }
    }, [candles, trade])

    const onPickCsv = async (file: File) => {
        const text = await file.text()
        const parsed = parseCsvCandles(text)
        setCandles(parsed)
        localStorage.setItem(storageKey, JSON.stringify(parsed))
    }

    const clearCandles = () => {
        localStorage.removeItem(storageKey)
        setCandles([])
    }

    const uploadChartSnapshot = async () => {
        if (!tradeId) return
        const chart = chartRef.current
        if (!chart) return

        try {
            setUploadingSnapshot(true)
            const canvas = chart.takeScreenshot()
            const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
            if (!blob) throw new Error('Failed to create screenshot')

            const form = new FormData()
            form.append('chart', blob, `chart-${tradeId}.png`)

            const { data } = await api.post(`/trades/${encodeURIComponent(tradeId)}/screenshots`, form, {
                headers: { 'Content-Type': 'multipart/form-data' },
            })
            setTrade(data)
        } catch (err) {
            console.error('Failed to upload chart snapshot', err)
        } finally {
            setUploadingSnapshot(false)
        }
    }

    const chartScreenshotUrl = fileUrl(trade?.chartScreenshot)
    const entryScreenshotUrl = fileUrl(trade?.entryScreenshot)

    const useEntryScreenshotAsChart = async () => {
        if (!tradeId) return
        try {
            const { data } = await api.post(`/trades/${encodeURIComponent(tradeId)}/chart-from-entry`)
            setTrade(data)
        } catch (err) {
            console.error('Failed to set chart screenshot from entry screenshot', err)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <div className="text-2xl font-bold">Trade Chart</div>
                    <div className="text-neutral-500 text-sm">
                        {trade?.instrument ? `${trade.instrument} • ${String(trade.direction || '').toUpperCase()}` : 'Load a trade to view chart'}
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => navigate('/trades')}
                        className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg hover:border-neutral-500 transition-colors"
                    >
                        Back
                    </button>
                    <GradientButton onClick={uploadChartSnapshot} disabled={!candles.length || uploadingSnapshot}>
                        {uploadingSnapshot ? 'Saving…' : 'Save chart snapshot'}
                    </GradientButton>
                </div>
            </div>

            <AnimatedCard disableHover>
                <div className="flex flex-col lg:flex-row lg:items-end gap-3 lg:gap-4">
                    <div className="flex-1">
                        <div className="text-sm font-semibold mb-2">Timeframe</div>
                        <div className="flex flex-wrap gap-2">
                            {(['1m', '5m', '15m', '1h', '4h'] as Timeframe[]).map(tf => (
                                <button
                                    key={tf}
                                    onClick={() => setTimeframe(tf)}
                                    className={`px-3 py-2 rounded-lg border transition-colors ${timeframe === tf
                                        ? 'bg-neutral-900 border-brand text-white'
                                        : 'bg-neutral-800 border-neutral-700 hover:border-neutral-500 text-neutral-200'
                                        }`}
                                >
                                    {tf.toUpperCase()}
                                </button>
                            ))}
                        </div>
                        <div className="text-xs text-neutral-500 mt-2">
                            Upload your OHLC CSV for this timeframe. Supported columns: time/date + open, high, low, close.
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv,text/csv"
                            className="hidden"
                            onChange={(e) => {
                                const f = e.target.files?.[0]
                                if (f) onPickCsv(f)
                                e.currentTarget.value = ''
                            }}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg hover:border-neutral-500 transition-colors"
                        >
                            Upload CSV
                        </button>
                        <button
                            onClick={clearCandles}
                            className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg hover:border-neutral-500 transition-colors"
                        >
                            Clear
                        </button>
                        {entryScreenshotUrl && !candles.length && (
                            <button
                                onClick={useEntryScreenshotAsChart}
                                className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg hover:border-neutral-500 transition-colors"
                            >
                                Use Entry Screenshot
                            </button>
                        )}
                    </div>
                </div>

                <div className="mt-4 border border-neutral-800 rounded-xl overflow-hidden">
                    {candles.length ? (
                        <div ref={chartContainerRef} className="w-full" />
                    ) : entryScreenshotUrl ? (
                        <a href={entryScreenshotUrl} target="_blank" rel="noreferrer" className="block">
                            <img
                                src={entryScreenshotUrl}
                                alt="Entry timeframe screenshot"
                                className="w-full h-[520px] object-contain bg-neutral-900"
                            />
                        </a>
                    ) : (
                        <div ref={chartContainerRef} className="w-full" />
                    )}
                </div>

                {!candles.length && (
                    <div className="mt-3 text-sm text-neutral-500">
                        {entryScreenshotUrl
                            ? 'Showing your Entry TF screenshot. Upload CSV for real candlesticks + overlays.'
                            : 'No candle data loaded yet. Upload CSV to see candlesticks + your entry/SL/TP overlays.'}
                    </div>
                )}
            </AnimatedCard>

            <AnimatedCard disableHover>
                <div className="text-sm font-semibold mb-3">Saved Chart Snapshot</div>
                {chartScreenshotUrl ? (
                    <a href={chartScreenshotUrl} target="_blank" rel="noreferrer" className="block">
                        <img
                            src={chartScreenshotUrl}
                            alt="Chart snapshot"
                            className="w-full max-h-[480px] object-contain rounded-lg border border-neutral-800 bg-neutral-900"
                        />
                        <div className="text-xs text-neutral-500 mt-2">Open full size</div>
                    </a>
                ) : (
                    <div className="text-sm text-neutral-500">No chart snapshot saved yet.</div>
                )}
            </AnimatedCard>

            {loading && <div className="text-sm text-neutral-500">Loading…</div>}
            {!loading && !trade && <div className="text-sm text-neutral-500">Trade not found or you don’t have access.</div>}
        </div>
    )
}
