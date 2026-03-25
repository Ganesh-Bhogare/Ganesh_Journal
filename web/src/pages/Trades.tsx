import { motion } from 'framer-motion'
import { useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Edit2, Trash2, Search, Filter, Download, TrendingUp, TrendingDown, Eye } from 'lucide-react'
import AnimatedCard from '../components/AnimatedCard'
import GradientButton from '../components/GradientButton'
import ICTTradeForm from '../components/ICTTradeForm'
import TradingViewEmbed from '../components/TradingViewEmbed'
import { api } from '../lib/api'
import { resolveTradingViewSymbol, toTradingViewInterval } from '../lib/tradingView'

export default function Trades() {
    const navigate = useNavigate()
    const [trades, setTrades] = useState<any[]>([])
    const [showTradeForm, setShowTradeForm] = useState(false)
    const [editingTrade, setEditingTrade] = useState<any>(null)
    const [viewingTrade, setViewingTrade] = useState<any>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [filterDirection, setFilterDirection] = useState('')
    const [showFilters, setShowFilters] = useState(false)
    const [exporting, setExporting] = useState(false)
    const [importing, setImporting] = useState(false)
    const [savingSnapshot, setSavingSnapshot] = useState(false)
    const [viewChartTimeframe, setViewChartTimeframe] = useState('5')
    const fileInputRef = useRef<HTMLInputElement | null>(null)
    const snapshotInputRef = useRef<HTMLInputElement | null>(null)

    const fileUrl = (path: string | undefined) => {
        if (!path) return undefined
        if (/^https?:\/\//i.test(path)) return path
        const base = (api.defaults.baseURL || '').replace(/\/api\/?$/, '')
        return `${base}${path}`
    }

    const pipMultiplierForInstrument = (instrument?: string) => {
        const sym = String(instrument || '').toUpperCase()
        if (sym.includes('XAU') || sym.includes('XAG')) return 10
        if (sym.endsWith('JPY')) return 100
        return 10000
    }

    const estimatePnl = (trade: any) => {
        if (typeof trade?.pnl === 'number' && Number.isFinite(trade.pnl)) {
            return { value: trade.pnl as number, projected: false }
        }

        const entry = Number(trade?.entryPrice)
        const lot = Number(trade?.lotSize)
        const direction = String(trade?.direction || '').toLowerCase()
        if (!Number.isFinite(entry) || !Number.isFinite(lot) || lot <= 0 || (direction !== 'long' && direction !== 'short')) {
            return { value: undefined as number | undefined, projected: false }
        }

        const target = Number.isFinite(Number(trade?.exitPrice))
            ? Number(trade.exitPrice)
            : Number.isFinite(Number(trade?.takeProfit))
                ? Number(trade.takeProfit)
                : undefined

        if (target === undefined) return { value: undefined as number | undefined, projected: false }

        const mult = pipMultiplierForInstrument(trade?.instrument)
        const move = direction === 'long' ? (target - entry) : (entry - target)
        const pips = move * mult
        const pnl = pips * lot * 10
        if (!Number.isFinite(pnl)) return { value: undefined as number | undefined, projected: false }

        const projected = !Number.isFinite(Number(trade?.exitPrice))
        return { value: pnl, projected }
    }

    const csvEscape = (value: any) => {
        if (value === null || value === undefined) return ''
        const str = String(value)
        // Wrap in quotes if it contains CSV special chars
        if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`
        return str
    }

    const tradesToCsv = (rows: any[]) => {
        const headers = [
            'id',
            'date',
            'instrument',
            'direction',
            'session',
            'killzone',
            'weeklyBias',
            'dailyBias',
            'drawOnLiquidity',
            'isPremiumDiscount',
            'setupType',
            'pdArrays',
            'entryTime',
            'entryTimeframe',
            'entryConfirmation',
            'entryPrice',
            'stopLoss',
            'takeProfit',
            'exitTime',
            'exitPrice',
            'lotSize',
            'riskPerTrade',
            'pnl',
            'rr',
            'rMultiple',
            'outcome',
            'emotionalState',
            'partialTaken',
            'slMovedToBE',
            'followedHTFBias',
            'correctSession',
            'validPDArray',
            'riskRespected',
            'noEarlyExit',
            'mae',
            'mfe',
            'htfLevelUsed',
            'ltfConfirmationQuality',
            'ruleBreakCount',
            'tradeQuality',
            'tags',
            'notes',
        ]

        const lines = [headers.join(',')]
        for (const t of rows) {
            const line = [
                csvEscape(t._id),
                csvEscape(t.date ? new Date(t.date).toISOString() : ''),
                csvEscape(t.instrument),
                csvEscape(t.direction),
                csvEscape(t.session),
                csvEscape(t.killzone),
                csvEscape(t.weeklyBias),
                csvEscape(t.dailyBias),
                csvEscape(t.drawOnLiquidity),
                csvEscape(t.isPremiumDiscount),
                csvEscape(t.setupType),
                csvEscape(Array.isArray(t.pdArrays) ? t.pdArrays.join('; ') : ''),
                csvEscape(t.entryTime ? new Date(t.entryTime).toISOString() : ''),
                csvEscape(t.entryTimeframe),
                csvEscape(t.entryConfirmation),
                csvEscape(t.entryPrice),
                csvEscape(t.stopLoss),
                csvEscape(t.takeProfit),
                csvEscape(t.exitTime ? new Date(t.exitTime).toISOString() : ''),
                csvEscape(t.exitPrice),
                csvEscape(t.lotSize),
                csvEscape(t.riskPerTrade),
                csvEscape(t.pnl),
                csvEscape(t.rr),
                csvEscape(t.rMultiple),
                csvEscape(t.outcome),
                csvEscape(t.emotionalState),
                csvEscape(t.partialTaken),
                csvEscape(t.slMovedToBE),
                csvEscape(t.followedHTFBias),
                csvEscape(t.correctSession),
                csvEscape(t.validPDArray),
                csvEscape(t.riskRespected),
                csvEscape(t.noEarlyExit),
                csvEscape(t.mae),
                csvEscape(t.mfe),
                csvEscape(t.htfLevelUsed),
                csvEscape(t.ltfConfirmationQuality),
                csvEscape(t.ruleBreakCount),
                csvEscape(t.tradeQuality),
                csvEscape(Array.isArray(t.tags) ? t.tags.join('; ') : ''),
                csvEscape(t.notes),
            ].join(',')
            lines.push(line)
        }
        return lines.join('\n')
    }

    const downloadCsv = (filename: string, csv: string) => {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
    }

    const parseCsvText = (text: string) => {
        const rows: string[][] = []
        let row: string[] = []
        let field = ''
        let inQuotes = false

        const pushField = () => {
            row.push(field)
            field = ''
        }
        const pushRow = () => {
            // ignore completely empty trailing rows
            if (row.length === 1 && row[0] === '') {
                row = []
                return
            }
            rows.push(row)
            row = []
        }

        for (let i = 0; i < text.length; i++) {
            const ch = text[i]
            const next = text[i + 1]

            if (inQuotes) {
                if (ch === '"' && next === '"') {
                    field += '"'
                    i++
                } else if (ch === '"') {
                    inQuotes = false
                } else {
                    field += ch
                }
                continue
            }

            if (ch === '"') {
                inQuotes = true
                continue
            }

            if (ch === ',') {
                pushField()
                continue
            }

            if (ch === '\n') {
                pushField()
                pushRow()
                continue
            }

            if (ch === '\r') {
                // handle CRLF
                continue
            }

            field += ch
        }

        // flush last field/row
        pushField()
        if (row.length) pushRow()

        return rows
    }

    const toBool = (v: any) => {
        if (v === true || v === false) return v
        if (v === null || v === undefined) return undefined
        const s = String(v).trim().toLowerCase()
        if (s === 'true' || s === '1' || s === 'yes') return true
        if (s === 'false' || s === '0' || s === 'no') return false
        return undefined
    }

    const toNum = (v: any) => {
        if (v === null || v === undefined || v === '') return undefined
        const cleaned = String(v)
            .trim()
            .replace(/[$,]/g, '')
            .replace(/^\((.*)\)$/, '-$1')
        const n = Number(cleaned)
        return Number.isFinite(n) ? n : undefined
    }

    const splitList = (v: any) => {
        if (!v) return []
        return String(v)
            .split(';')
            .map((s) => s.trim())
            .filter(Boolean)
    }

    const toText = (v: any) => {
        if (v === null || v === undefined) return undefined
        const s = String(v).trim()
        return s.length ? s : undefined
    }

    const handleImportPick = () => {
        if (importing) return
        fileInputRef.current?.click()
    }

    const handleImportFile = async (file: File) => {
        setImporting(true)
        try {
            const text = await file.text()
            const rows = parseCsvText(text)
            if (rows.length < 2) {
                alert('CSV is empty')
                return
            }

            const headers = rows[0].map((h) => h.trim())
            const headerIndex: Record<string, number> = {}
            headers.forEach((h, idx) => { headerIndex[h] = idx })

            const get = (r: string[], key: string) => {
                const idx = headerIndex[key]
                return idx === undefined ? '' : (r[idx] ?? '')
            }

            const parseDateTime = (raw: any) => {
                const s = String(raw ?? '').trim()
                if (!s) return undefined

                // Format: "12/19/2025, 12:25" (MM/DD/YYYY, HH:mm)
                const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),\s*(\d{1,2}):(\d{2})$/)
                if (m) {
                    const month = Number(m[1])
                    const day = Number(m[2])
                    const year = Number(m[3])
                    const hour = Number(m[4])
                    const minute = Number(m[5])
                    const d = new Date(year, month - 1, day, hour, minute, 0)
                    return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
                }

                const d = new Date(s)
                return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
            }

            const normalizeDirection = (raw: any) => {
                const s = String(raw ?? '').trim().toLowerCase()
                if (s === 'buy' || s === 'long') return 'long'
                if (s === 'sell' || s === 'short') return 'short'
                return undefined
            }

            // Best-effort import: support either our export format OR broker statement format.
            const isExportFormat = headerIndex['date'] !== undefined && headerIndex['direction'] !== undefined && headerIndex['entryPrice'] !== undefined
            const isBrokerFormat = headerIndex['open_time'] !== undefined && headerIndex['open_price'] !== undefined && headerIndex['side'] !== undefined

            if (!isExportFormat && !isBrokerFormat) {
                alert('Invalid CSV format. Use our exported CSV, or a broker CSV with columns: instrument, side, open_time, open_price')
                return
            }

            const tradesPayload = rows.slice(1)
                .filter((r) => r.some((c) => String(c).trim() !== ''))
                .map((r) => {
                    if (isBrokerFormat) {
                        const instrument = toText(get(r, 'instrument'))
                        const direction = normalizeDirection(get(r, 'side'))
                        const openTimeIso = parseDateTime(get(r, 'open_time'))
                        const closeTimeIso = parseDateTime(get(r, 'close_time'))

                        const fees = toNum(get(r, 'fees'))
                        const pnl = toNum(get(r, 'pnl'))
                        const existingNotes = toText(get(r, 'notes'))
                        const notes = fees !== undefined
                            ? (existingNotes ? `${existingNotes} | Fees: ${fees}` : `Fees: ${fees}`)
                            : existingNotes

                        return {
                            date: openTimeIso,
                            instrument,
                            direction,
                            entryTime: openTimeIso,
                            entryPrice: toNum(get(r, 'open_price')),
                            exitTime: closeTimeIso,
                            exitPrice: toNum(get(r, 'close_price')),
                            stopLoss: toNum(get(r, 'stop_loss')),
                            takeProfit: toNum(get(r, 'take_profit')),
                            lotSize: toNum(get(r, 'lot_size')),
                            pnl,
                            notes,
                        }
                    }

                    // Our export format
                    return {
                        date: toText(get(r, 'date')),
                        instrument: toText(get(r, 'instrument')),
                        direction: normalizeDirection(get(r, 'direction')),
                        session: toText(get(r, 'session')),
                        killzone: toText(get(r, 'killzone')),
                        weeklyBias: toText(get(r, 'weeklyBias')),
                        dailyBias: toText(get(r, 'dailyBias')),
                        drawOnLiquidity: toText(get(r, 'drawOnLiquidity')),
                        isPremiumDiscount: toBool(get(r, 'isPremiumDiscount')),
                        setupType: toText(get(r, 'setupType')),
                        pdArrays: splitList(get(r, 'pdArrays')),
                        entryTime: toText(get(r, 'entryTime')),
                        entryTimeframe: toText(get(r, 'entryTimeframe')),
                        entryConfirmation: toText(get(r, 'entryConfirmation')),
                        entryPrice: toNum(get(r, 'entryPrice')),
                        stopLoss: toNum(get(r, 'stopLoss')),
                        takeProfit: toNum(get(r, 'takeProfit')),
                        exitTime: toText(get(r, 'exitTime')),
                        exitPrice: toNum(get(r, 'exitPrice')),
                        lotSize: toNum(get(r, 'lotSize')),
                        riskPerTrade: toNum(get(r, 'riskPerTrade')),
                        pnl: toNum(get(r, 'pnl')),
                        emotionalState: toText(get(r, 'emotionalState')),
                        partialTaken: toBool(get(r, 'partialTaken')),
                        slMovedToBE: toBool(get(r, 'slMovedToBE')),
                        followedHTFBias: toBool(get(r, 'followedHTFBias')),
                        correctSession: toBool(get(r, 'correctSession')),
                        validPDArray: toBool(get(r, 'validPDArray')),
                        riskRespected: toBool(get(r, 'riskRespected')),
                        noEarlyExit: toBool(get(r, 'noEarlyExit')),
                        mae: toNum(get(r, 'mae')),
                        mfe: toNum(get(r, 'mfe')),
                        htfLevelUsed: toText(get(r, 'htfLevelUsed')),
                        ltfConfirmationQuality: toText(get(r, 'ltfConfirmationQuality')),
                        notes: toText(get(r, 'notes')),
                        tags: splitList(get(r, 'tags')),
                    }
                })

            const { data } = await api.post('/trades/import', { trades: tradesPayload })
            await fetchTrades()

            const failedCount = Array.isArray(data?.failed) ? data.failed.length : 0
            const createdCount = data?.created ?? 0
            if (failedCount) {
                const preview = (data.failed || []).slice(0, 3).map((f: any) => {
                    const reason = typeof f?.reason === 'string' ? f.reason : ''
                    return `Row ${Number(f?.index ?? 0) + 2}: ${reason}`
                }).join('\n')
                alert(`Import finished. Created: ${createdCount}. Failed: ${failedCount}.\n\nFirst errors:\n${preview}`)
                console.warn('Import failures:', data.failed)
            } else {
                alert(`Import finished. Created: ${createdCount}. Failed: 0.`)
            }
        } catch (err) {
            console.error('Failed to import CSV:', err)
            alert('Failed to import CSV')
        } finally {
            setImporting(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const handleExport = async () => {
        if (exporting) return
        setExporting(true)
        try {
            const params: any = {}
            if (filterDirection) params.direction = filterDirection

            // Fetch all trades (paged) so CSV export isn't limited to the UI page.
            const pageSize = 500
            let page = 1
            let all: any[] = []

            while (true) {
                const { data } = await api.get('/trades', { params: { ...params, page, limit: pageSize } })
                const items = data.items || []
                all = all.concat(items)
                if (items.length < pageSize) break
                page += 1
            }

            const term = searchTerm.trim().toLowerCase()
            const finalRows = term
                ? all.filter((t) =>
                    t.instrument?.toLowerCase().includes(term) ||
                    t.notes?.toLowerCase().includes(term)
                )
                : all

            const csv = tradesToCsv(finalRows)
            const dateStr = new Date().toISOString().slice(0, 10)
            downloadCsv(`trades_${dateStr}.csv`, csv)
        } catch (err) {
            console.error('Failed to export CSV:', err)
            alert('Failed to export CSV')
        } finally {
            setExporting(false)
        }
    }

    const fetchTrades = async () => {
        try {
            const params: any = {}
            if (filterDirection) params.direction = filterDirection
            const { data } = await api.get('/trades', { params })
            setTrades(data.items || [])
        } catch (err) {
            console.error('Failed to fetch trades:', err)
        }
    }

    useEffect(() => {
        fetchTrades()
    }, [filterDirection])

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this trade?')) return
        try {
            await api.delete(`/trades/${id}`)
            fetchTrades()
        } catch (err) {
            console.error('Failed to delete trade:', err)
        }
    }

    const handleEdit = (trade: any) => {
        setEditingTrade(trade)
        setShowTradeForm(true)
    }

    const handleView = (trade: any) => {
        const defaultTf = trade?.chartConfig?.timeframe || toTradingViewInterval(trade?.entryTimeframe || '5m')
        const id = trade?._id
        if (id) {
            navigate(`/trade-chart?tradeId=${encodeURIComponent(id)}&tf=${encodeURIComponent(defaultTf)}`)
            return
        }

        // Fallback if id is missing
        setViewingTrade(trade)
        setViewChartTimeframe(defaultTf)
    }

    const handleSnapshotFile = async (file: File) => {
        const tradeId = viewingTrade?._id
        if (!tradeId || !file) return

        try {
            setSavingSnapshot(true)
            const form = new FormData()
            form.append('chart', file, file.name || `chart-${tradeId}.png`)
            const { data } = await api.post(`/trades/${encodeURIComponent(tradeId)}/screenshots`, form, {
                headers: { 'Content-Type': 'multipart/form-data' },
            })
            setViewingTrade(data)
            fetchTrades()
        } catch (err) {
            console.error('Failed to save chart snapshot', err)
            alert('Failed to save snapshot. Please try again.')
        } finally {
            setSavingSnapshot(false)
            if (snapshotInputRef.current) snapshotInputRef.current.value = ''
        }
    }

    const filteredTrades = trades.filter(trade =>
        trade.instrument?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        trade.notes?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const overlayRr = (() => {
        const e = Number(viewingTrade?.entryPrice)
        const s = Number(viewingTrade?.stopLoss)
        const t = Number(viewingTrade?.takeProfit)
        const risk = Math.abs(e - s)
        const reward = Math.abs(t - e)
        return Number.isFinite(risk) && Number.isFinite(reward) && risk > 0 ? reward / risk : undefined
    })()

    const exitBadgeClass = (() => {
        const explicit = String(viewingTrade?.outcome || '').toLowerCase()
        if (explicit === 'win') return 'bg-green-400/20 text-green-200 border-green-300/30'
        if (explicit === 'loss') return 'bg-red-400/20 text-red-200 border-red-300/30'
        if (explicit === 'breakeven') return 'bg-slate-400/20 text-slate-200 border-slate-300/30'

        const pnl = Number(viewingTrade?.pnl)
        if (Number.isFinite(pnl) && pnl > 0) return 'bg-green-400/20 text-green-200 border-green-300/30'
        if (Number.isFinite(pnl) && pnl < 0) return 'bg-red-400/20 text-red-200 border-red-300/30'
        return 'bg-violet-400/20 text-violet-200 border-violet-300/30'
    })()

    return (
        <div className="space-y-6">
            <motion.div
                className="flex items-center justify-between"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <div>
                    <h1 className="text-3xl font-bold mb-2">Trades</h1>
                    <p className="text-neutral-400">Manage and analyze your trading history</p>
                </div>
                <div className="flex gap-3">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,text/csv"
                        className="hidden"
                        onChange={(e) => {
                            const f = e.target.files?.[0]
                            if (f) handleImportFile(f)
                        }}
                    />
                    <input
                        ref={snapshotInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                            const f = e.target.files?.[0]
                            if (f) handleSnapshotFile(f)
                        }}
                    />
                    <button
                        onClick={handleImportPick}
                        disabled={importing}
                        className="px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg hover:border-brand transition-colors flex items-center gap-2"
                        title="Import CSV"
                    >
                        <Download size={18} />
                        {importing ? 'Importing...' : 'Import'}
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={exporting}
                        className="px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg hover:border-brand transition-colors flex items-center gap-2"
                        title="Export CSV"
                    >
                        <Download size={18} />
                        {exporting ? 'Exporting...' : 'Export'}
                    </button>
                    <GradientButton onClick={() => { setEditingTrade(null); setShowTradeForm(true); }}>
                        + Add Trade
                    </GradientButton>
                </div>
            </motion.div>

            <AnimatedCard delay={0.1}>
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={20} />
                        <input
                            type="text"
                            placeholder="Search by pair or notes..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:border-brand transition-colors"
                        />
                    </div>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg hover:border-brand transition-colors flex items-center gap-2"
                    >
                        <Filter size={18} />
                        Filters
                    </button>
                </div>

                {showFilters && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-6 p-4 bg-neutral-800/50 rounded-lg"
                    >
                        <div className="flex gap-4">
                            <div>
                                <label className="block text-sm mb-2">Direction</label>
                                <select
                                    value={filterDirection}
                                    onChange={(e) => setFilterDirection(e.target.value)}
                                    className="px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:border-brand"
                                >
                                    <option value="">All</option>
                                    <option value="long">Long</option>
                                    <option value="short">Short</option>
                                </select>
                            </div>
                        </div>
                    </motion.div>
                )}

                {filteredTrades.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-left text-neutral-400 text-sm border-b border-neutral-800">
                                    <th className="pb-3">Date</th>
                                    <th className="pb-3">Pair</th>
                                    <th className="pb-3">Type</th>
                                    <th className="pb-3">Entry</th>
                                    <th className="pb-3">Exit</th>
                                    <th className="pb-3">SL</th>
                                    <th className="pb-3">TP</th>
                                    <th className="pb-3">Lots</th>
                                    <th className="pb-3">P&L</th>
                                    <th className="pb-3">Tags</th>
                                    <th className="pb-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTrades.map((trade, i) => (
                                    (() => {
                                        const pnlInfo = estimatePnl(trade)
                                        const pnlVal = pnlInfo.value
                                        const isPos = (pnlVal ?? 0) >= 0
                                        return (
                                            <motion.tr
                                                key={trade._id}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: i * 0.05 }}
                                                className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors"
                                            >
                                                <td className="py-3 text-sm">{new Date(trade.date).toLocaleDateString()}</td>
                                                <td className="py-3 font-semibold">{trade.instrument}</td>
                                                <td className="py-3">
                                                    {trade.direction === 'long' ? (
                                                        <span className="flex items-center gap-1 text-green-500">
                                                            <TrendingUp size={16} /> LONG
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1 text-red-500">
                                                            <TrendingDown size={16} /> SHORT
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-3 text-sm">{trade.entryPrice?.toFixed(5)}</td>
                                                <td className="py-3 text-sm">{trade.exitPrice?.toFixed(5) || '-'}</td>
                                                <td className="py-3 text-sm text-red-400">{trade.stopLoss?.toFixed(5) || '-'}</td>
                                                <td className="py-3 text-sm text-green-400">{trade.takeProfit?.toFixed(5) || '-'}</td>
                                                <td className="py-3 text-sm">{trade.lotSize || '-'}</td>
                                                <td className={`py-3 font-semibold ${isPos ? 'text-green-500' : 'text-red-500'}`}>
                                                    {typeof pnlVal === 'number'
                                                        ? `${pnlInfo.projected ? '~' : ''}$${pnlVal.toFixed(2)}`
                                                        : '-'}
                                                </td>
                                                <td className="py-3">
                                                    <div className="flex flex-wrap gap-1">
                                                        {trade.tags?.slice(0, 2).map((tag: string) => (
                                                            <span key={tag} className="px-2 py-0.5 bg-brand/20 text-brand rounded text-xs">
                                                                {tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="py-3">
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleView(trade)}
                                                            className="p-2 text-neutral-200 hover:text-white hover:bg-neutral-800 rounded transition-colors"
                                                            title="Open Auto Position Tool"
                                                        >
                                                            <Eye size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleEdit(trade)}
                                                            className="p-2 text-brand hover:text-blue-300 hover:bg-neutral-800 rounded transition-colors"
                                                            title="Edit trade"
                                                        >
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(trade._id)}
                                                            className="p-2 text-red-500 hover:text-red-400 hover:bg-neutral-800 rounded transition-colors"
                                                            title="Delete trade"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        )
                                    })()
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-neutral-500 text-center py-12">
                        <p className="mb-4">No trades recorded yet</p>
                        <GradientButton onClick={() => { setEditingTrade(null); setShowTradeForm(true); }}>
                            Log Your First Trade
                        </GradientButton>
                    </div>
                )}
            </AnimatedCard>

            {showTradeForm && (
                <ICTTradeForm
                    trade={editingTrade}
                    onClose={() => { setShowTradeForm(false); setEditingTrade(null); }}
                    onSuccess={() => { fetchTrades(); setEditingTrade(null); }}
                />
            )}

            {viewingTrade && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/60"
                        onClick={() => setViewingTrade(null)}
                    />
                    <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-neutral-900 border border-neutral-800 rounded-xl p-6">
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <div>
                                <div className="text-2xl font-bold">{viewingTrade.instrument} • {String(viewingTrade.direction || '').toUpperCase()}</div>
                                <div className="text-neutral-400 text-sm">
                                    {viewingTrade.date ? new Date(viewingTrade.date).toLocaleString() : 'No date'}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        const id = viewingTrade?._id
                                        setViewingTrade(null)
                                        if (id) navigate(`/ai-analysis?tradeId=${encodeURIComponent(id)}`)
                                    }}
                                    className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg hover:border-brand transition-colors"
                                >
                                    Analyze with AI
                                </button>
                                <button
                                    onClick={() => {
                                        const id = viewingTrade?._id
                                        setViewingTrade(null)
                                        if (id) navigate(`/trade-chart?tradeId=${encodeURIComponent(id)}`)
                                    }}
                                    className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg hover:border-brand transition-colors"
                                >
                                    Open Auto Position Tool
                                </button>
                                <button
                                    onClick={() => snapshotInputRef.current?.click()}
                                    disabled={savingSnapshot}
                                    className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg hover:border-brand transition-colors disabled:opacity-60"
                                    title="Use TradingView camera to download image, then upload it here"
                                >
                                    {savingSnapshot ? 'Saving…' : 'Save Snapshot'}
                                </button>
                                <button
                                    onClick={() => setViewingTrade(null)}
                                    className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg hover:border-neutral-500 transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div className="p-4 bg-neutral-800/40 rounded-lg border border-neutral-800">
                                <div className="text-neutral-400 text-xs mb-1">Entry</div>
                                <div className="font-semibold">{viewingTrade.entryPrice ?? '-'}</div>
                            </div>
                            <div className="p-4 bg-neutral-800/40 rounded-lg border border-neutral-800">
                                <div className="text-neutral-400 text-xs mb-1">Exit</div>
                                <div className="font-semibold">{viewingTrade.exitPrice ?? '-'}</div>
                            </div>
                            <div className="p-4 bg-neutral-800/40 rounded-lg border border-neutral-800">
                                <div className="text-neutral-400 text-xs mb-1">P&L</div>
                                <div className={`font-bold ${(estimatePnl(viewingTrade).value || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {typeof estimatePnl(viewingTrade).value === 'number'
                                        ? `${estimatePnl(viewingTrade).projected ? '~' : ''}$${estimatePnl(viewingTrade).value!.toFixed(2)}`
                                        : '-'}
                                </div>
                                {estimatePnl(viewingTrade).projected && (
                                    <div className="text-[11px] text-neutral-500 mt-1">Projected (using TP)</div>
                                )}
                            </div>
                        </div>

                        <div className="mb-6">
                            <div className="text-sm font-semibold mb-2">Notes</div>
                            <div className="whitespace-pre-wrap text-neutral-200 bg-neutral-800/30 border border-neutral-800 rounded-lg p-4">
                                {viewingTrade.notes?.trim() ? viewingTrade.notes : 'No notes'}
                            </div>
                        </div>

                        <div>
                            <div className="text-sm font-semibold mb-3">Live Multi-Timeframe TradingView Chart</div>
                            <div className="mb-3 flex flex-wrap gap-2">
                                {((viewingTrade?.chartConfig?.timeframes && viewingTrade.chartConfig.timeframes.length
                                    ? viewingTrade.chartConfig.timeframes
                                    : ['5', '15', '60']) as string[]).map((tf) => (
                                        <button
                                            key={tf}
                                            onClick={() => setViewChartTimeframe(tf)}
                                            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${viewChartTimeframe === tf
                                                ? 'bg-brand/20 border-brand text-brand'
                                                : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:border-neutral-500'
                                                }`}
                                        >
                                            {tf}
                                        </button>
                                    ))}
                            </div>
                            <div className="relative border border-blue-900/70 rounded-xl overflow-hidden bg-[#0b162e]">
                                <TradingViewEmbed
                                    symbol={viewingTrade?.chartConfig?.symbol || resolveTradingViewSymbol(viewingTrade?.market, viewingTrade?.instrument)}
                                    interval={viewChartTimeframe}
                                    height={460}
                                />

                                <div className="pointer-events-none absolute top-3 left-3 z-10 flex flex-wrap gap-2">
                                    <span className="px-2 py-1 rounded-md text-[11px] font-semibold bg-amber-400/20 text-amber-200 border border-amber-300/30">
                                        Entry {viewingTrade?.entryPrice ?? '-'}
                                    </span>
                                    {viewingTrade?.exitPrice !== undefined && viewingTrade?.exitPrice !== null && (
                                        <span className={`px-2 py-1 rounded-md text-[11px] font-semibold border ${exitBadgeClass}`}>
                                            Exit {viewingTrade?.exitPrice}
                                        </span>
                                    )}
                                    {viewingTrade?.stopLoss !== undefined && viewingTrade?.stopLoss !== null && (
                                        <span className="px-2 py-1 rounded-md text-[11px] font-semibold bg-red-400/20 text-red-200 border border-red-300/30">
                                            SL {viewingTrade?.stopLoss}
                                        </span>
                                    )}
                                    {viewingTrade?.takeProfit !== undefined && viewingTrade?.takeProfit !== null && (
                                        <span className="px-2 py-1 rounded-md text-[11px] font-semibold bg-green-400/20 text-green-200 border border-green-300/30">
                                            TP {viewingTrade?.takeProfit}
                                        </span>
                                    )}
                                    {overlayRr !== undefined && (
                                        <span className="px-2 py-1 rounded-md text-[11px] font-semibold bg-cyan-400/20 text-cyan-200 border border-cyan-300/30">
                                            RR {overlayRr.toFixed(2)}
                                        </span>
                                    )}
                                </div>

                                <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-md border border-neutral-700/70 bg-black/45 px-2 py-1 text-[11px] text-neutral-200">
                                    Entry Time: {viewingTrade?.entryTime ? new Date(viewingTrade.entryTime).toLocaleString() : (viewingTrade?.date ? new Date(viewingTrade.date).toLocaleString() : '-')}
                                </div>
                            </div>
                            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="p-3 rounded-lg bg-neutral-800/35 border border-neutral-800">
                                    <div className="text-neutral-400 text-xs mb-1">Entry</div>
                                    <div className="font-semibold text-white">{viewingTrade.entryPrice ?? '-'}</div>
                                </div>
                                <div className="p-3 rounded-lg bg-neutral-800/35 border border-neutral-800">
                                    <div className="text-neutral-400 text-xs mb-1">Stop Loss</div>
                                    <div className="font-semibold text-red-400">{viewingTrade.stopLoss ?? '-'}</div>
                                </div>
                                <div className="p-3 rounded-lg bg-neutral-800/35 border border-neutral-800">
                                    <div className="text-neutral-400 text-xs mb-1">Take Profit</div>
                                    <div className="font-semibold text-green-400">{viewingTrade.takeProfit ?? '-'}</div>
                                </div>
                            </div>
                            <div className="mt-3 p-3 rounded-lg bg-neutral-800/30 border border-neutral-800">
                                <div className="text-neutral-300 text-xs font-semibold mb-2">Trade Location Guide</div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                    <div className="text-neutral-400">
                                        Trade Time (UTC): <span className="text-neutral-200">{viewingTrade?.entryTime ? new Date(viewingTrade.entryTime).toISOString() : (viewingTrade?.date ? new Date(viewingTrade.date).toISOString() : '-')}</span>
                                    </div>
                                    <div className="text-neutral-400">
                                        Entry Timeframe: <span className="text-neutral-200">{viewingTrade?.entryTimeframe || '-'}</span>
                                    </div>
                                    <div className="text-neutral-400">
                                        Direction: <span className="text-neutral-200">{String(viewingTrade?.direction || '').toUpperCase() || '-'}</span>
                                    </div>
                                    <div className="text-neutral-400">
                                        RR: <span className="text-neutral-200">{(() => {
                                            const e = Number(viewingTrade?.entryPrice)
                                            const s = Number(viewingTrade?.stopLoss)
                                            const t = Number(viewingTrade?.takeProfit)
                                            const r = Math.abs(e - s)
                                            const rw = Math.abs(t - e)
                                            return Number.isFinite(r) && Number.isFinite(rw) && r > 0 ? (rw / r).toFixed(2) : '-'
                                        })()}</span>
                                    </div>
                                </div>
                                <div className="mt-2 text-[11px] text-neutral-500">
                                    Live chart current candle dikhata hai. Exact trade location ke liye upar Entry/SL/TP + Trade Time use karo.
                                </div>
                            </div>
                            {viewingTrade?.chartScreenshot && (
                                <div className="mt-3 p-3 rounded-lg bg-neutral-800/25 border border-neutral-800">
                                    <div className="text-xs text-neutral-400 mb-2">Saved Snapshot</div>
                                    <a
                                        href={fileUrl(viewingTrade.chartScreenshot)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="block"
                                    >
                                        <img
                                            src={fileUrl(viewingTrade.chartScreenshot)}
                                            alt="Saved chart snapshot"
                                            className="w-full max-h-48 object-contain rounded-md border border-neutral-800 bg-neutral-900"
                                        />
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
