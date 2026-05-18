import { useEffect, useMemo, useState } from 'react'
import { Image as ImageIcon } from 'lucide-react'
import AnimatedCard from '../components/AnimatedCard'
import { api } from '../lib/api'

export default function Screenshots() {
    const [trades, setTrades] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [imageUrls, setImageUrls] = useState<Record<string, string>>({})

    const fileUrl = (path: string | undefined) => {
        if (!path) return undefined
        if (/^https?:\/\//i.test(path)) return path
        const base = (api.defaults.baseURL || '').replace(/\/api\/?$/, '')
        return `${base}${path}`
    }

    const pickScreenshotKind = (trade: any): 'chart' | 'entry' | 'postTrade' | 'htf' | null => {
        if (trade?.chartScreenshot) return 'chart'
        if (trade?.entryScreenshot) return 'entry'
        if (trade?.postTradeScreenshot) return 'postTrade'
        if (trade?.htfScreenshot) return 'htf'
        return null
    }

    const tradeScreenshotUrl = (trade: any) => {
        const priorities: Array<{ field: string; kind: string }> = [
            { field: 'chartScreenshot', kind: 'chart' },
            { field: 'entryScreenshot', kind: 'entry' },
            { field: 'postTradeScreenshot', kind: 'postTrade' },
            { field: 'htfScreenshot', kind: 'htf' },
        ]

        for (const pick of priorities) {
            const val = trade?.[pick.field]
            if (val) return fileUrl(val)
        }

        if (!trade?._id) return undefined
        const fallback = priorities.find((p) => Boolean(trade?.[p.field]))
        if (!fallback) return undefined
        return fileUrl(`/api/trades/${encodeURIComponent(trade._id)}/screenshots/${fallback.kind}`)
    }

    const getPnl = (trade: any) => {
        if (Number.isFinite(Number(trade?.pnl))) return Number(trade.pnl)
        if (Number.isFinite(Number(trade?.takeProfit))) return Number(trade.takeProfit)
        return 0
    }

    useEffect(() => {
        const fetchTrades = async () => {
            setLoading(true)
            try {
                const pageSize = 500
                let page = 1
                const all: any[] = []
                while (true) {
                    const { data } = await api.get('/trades', { params: { page, limit: pageSize } })
                    const items = Array.isArray(data?.items) ? data.items : []
                    all.push(...items)
                    if (items.length < pageSize) break
                    page += 1
                }
                setTrades(all)
            } catch (err) {
                console.error('Failed to fetch screenshots:', err)
            } finally {
                setLoading(false)
            }
        }

        fetchTrades()
    }, [])

    const screenshotTrades = useMemo(() => {
        return trades
            .filter((t) => t?.chartScreenshot || t?.entryScreenshot || t?.postTradeScreenshot || t?.htfScreenshot)
            .sort((a, b) => {
                const aTime = a?.date ? new Date(a.date).getTime() : 0
                const bTime = b?.date ? new Date(b.date).getTime() : 0
                return bTime - aTime
            })
    }, [trades])

    useEffect(() => {
        let cancelled = false
        const createdUrls: string[] = []

        const loadImages = async () => {
            const next: Record<string, string> = {}
            for (const trade of screenshotTrades) {
                const id = trade?._id
                const kind = pickScreenshotKind(trade)
                if (!id || !kind) continue
                try {
                    const { data } = await api.get(`/trades/${encodeURIComponent(id)}/screenshots/${kind}`, {
                        responseType: 'blob',
                    })
                    if (cancelled) return
                    if (data && data.size > 0) {
                        const url = URL.createObjectURL(data)
                        createdUrls.push(url)
                        next[id] = url
                    }
                } catch {
                    // Ignore failed images; fallback placeholder will render.
                }
            }

            if (!cancelled) setImageUrls(next)
        }

        loadImages()

        return () => {
            cancelled = true
            createdUrls.forEach((url) => URL.revokeObjectURL(url))
        }
    }, [screenshotTrades])

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <ImageIcon size={22} className="text-brand" />
                <div>
                    <h1 className="text-2xl font-bold">Screenshots</h1>
                    <p className="text-neutral-400 text-sm">Trade screenshots gallery with pair and profit.</p>
                </div>
            </div>

            <AnimatedCard delay={0.05}>
                {loading ? (
                    <div className="text-neutral-400">Loading screenshots...</div>
                ) : screenshotTrades.length === 0 ? (
                    <div className="text-neutral-500">No screenshots uploaded yet.</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        {screenshotTrades.map((trade) => {
                            const src = trade?._id ? imageUrls[trade._id] || tradeScreenshotUrl(trade) : tradeScreenshotUrl(trade)
                            const pnl = getPnl(trade)
                            return (
                                <div
                                    key={trade._id}
                                    className="rounded-2xl overflow-hidden border border-neutral-800 bg-neutral-900/50"
                                >
                                    <div className="aspect-[16/9] bg-neutral-900 flex items-center justify-center">
                                        {src ? (
                                            <img
                                                src={src}
                                                alt={trade.instrument || 'Trade screenshot'}
                                                className="h-full w-full object-cover"
                                                loading="lazy"
                                            />
                                        ) : (
                                            <div className="text-sm text-neutral-500">Screenshot missing</div>
                                        )}
                                    </div>
                                    <div className="px-4 py-3 flex items-center justify-between">
                                        <div>
                                            <div className="font-semibold text-neutral-200 text-base">
                                                {trade.instrument || 'Unknown'}
                                            </div>
                                            <div className="text-sm text-neutral-500">
                                                {trade?.date ? new Date(trade.date).toLocaleDateString() : 'Unknown date'}
                                            </div>
                                        </div>
                                        <div className={`font-semibold text-lg ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </AnimatedCard>
        </div>
    )
}
