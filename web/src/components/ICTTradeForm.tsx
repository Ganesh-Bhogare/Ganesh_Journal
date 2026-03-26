import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { X, TrendingUp, TrendingDown, AlertCircle, CheckCircle2 } from 'lucide-react'
import GradientButton from './GradientButton'
import TradingViewEmbed from './TradingViewEmbed'
import { api } from '../lib/api'
import { resolveTradingViewSymbol, toTradingViewInterval } from '../lib/tradingView'
import { formatIstDateTime, isoToIstInputValue, istInputToIso, nowIstInputValue } from '../lib/istDate'

interface ICTTradeFormProps {
    onClose: () => void
    onSuccess: () => void
    trade?: any
}

const MARKET_OPTIONS = ['Forex', 'Crypto', 'Indian Equity', 'Indian Futures', 'Indian Options', 'Commodities', 'Indices', 'Other']
const INSTRUMENT_LIBRARY: Record<string, string[]> = {
    Forex: ['XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD', 'EURJPY', 'GBPJPY', 'EURGBP'],
    Crypto: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT'],
    'Indian Equity': ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'SBIN', 'ITC'],
    'Indian Futures': ['NIFTY FUT', 'BANKNIFTY FUT', 'FINNIFTY FUT', 'MIDCPNIFTY FUT'],
    'Indian Options': ['NIFTY CE', 'NIFTY PE', 'BANKNIFTY CE', 'BANKNIFTY PE'],
    Commodities: ['XAUUSD', 'XAGUSD', 'CRUDEOIL', 'NATGAS'],
    Indices: ['NIFTY50', 'BANKNIFTY', 'SENSEX', 'NASDAQ', 'SPX500'],
    Other: []
}
const SESSIONS = ['Asia', 'London', 'New York']
const KILLZONES = ['London Open', 'NY AM', 'NY PM']
const HTF_BIAS_OPTIONS = ['Bullish', 'Bearish', 'Range']
const LIQUIDITY_OPTIONS = ['Buy-side', 'Sell-side']
const SETUP_TYPES = [
    'FVG',
    'Order Block',
    'Liquidity Sweep + MSS',
    'Judas Swing',
    'Power of 3 (AMD)',
    'Breaker Block'
]
const NON_ICT_STRATEGIES = ['Breakout', 'Trend Following', 'Mean Reversion', 'Scalping', 'Swing Trading', 'News Trading', 'Options Momentum', 'Arbitrage', 'Custom']
const PD_ARRAYS = [
    'Daily High/Low',
    'Weekly High/Low',
    'Asia High/Low',
    'EQH/EQL',
    'HTF Order Block'
]
const ENTRY_TIMEFRAMES = ['1m', '3m', '5m']
const ENTRY_CONFIRMATIONS = ['MSS', 'Displacement', 'FVG Tap']
const EMOTIONAL_STATES = ['Calm', 'FOMO', 'Revenge', 'Hesitant']
const CHART_TIMEFRAME_OPTIONS = ['1', '3', '5', '15', '30', '60', '240', 'D']

const formSectionStyle = {
    marginBottom: '32px',
    padding: '24px',
    backgroundColor: '#0f172a',
    borderRadius: '12px',
    border: '1px solid #bfdbfe'
}

const sectionTitleStyle = {
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '20px',
    color: '#2563eb',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
}

const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    backgroundColor: '#0f172a',
    border: '1px solid #bfdbfe',
    borderRadius: '8px',
    color: '#e2e8f0',
    fontSize: '14px',
    outline: 'none'
}

const labelStyle = {
    display: 'block',
    fontSize: '13px',
    fontWeight: '500',
    marginBottom: '8px',
    color: '#bfdbfe'
}

export default function ICTTradeForm({ onClose, onSuccess, trade }: ICTTradeFormProps) {
    const [step, setStep] = useState(1)
    const [errors, setErrors] = useState<string[]>([])
    const [loading, setLoading] = useState(false)

    const [formData, setFormData] = useState({
        // Basic Info
        date: trade?.date ? isoToIstInputValue(trade.date) : nowIstInputValue(),
        market: trade?.market || 'Forex',
        strategyStyle: trade?.strategyStyle || (trade?.setupType ? 'ICT' : 'Non-ICT'),
        instrument: trade?.instrument || 'XAUUSD',
        direction: trade?.direction || 'long',

        // Pre-Trade Analysis
        session: trade?.session || 'London',
        killzone: trade?.killzone || '',
        weeklyBias: trade?.weeklyBias || 'Bullish',
        dailyBias: trade?.dailyBias || 'Bullish',
        drawOnLiquidity: trade?.drawOnLiquidity || 'Buy-side',
        isPremiumDiscount: trade?.isPremiumDiscount || false,

        // Setup Type (ONLY ONE)
        setupType: trade?.setupType || '',
        strategyName: trade?.strategyName || '',

        // PD Arrays (Multiple)
        pdArrays: trade?.pdArrays || [],

        // Entry Execution
        entryTime: trade?.entryTime ? isoToIstInputValue(trade.entryTime) : nowIstInputValue(),
        entryTimeframe: trade?.entryTimeframe || '5m',
        entryConfirmation: trade?.entryConfirmation || 'MSS',
        entryPrice: trade?.entryPrice || '',
        stopLoss: trade?.stopLoss || '',
        takeProfit: trade?.takeProfit || '',
        riskPerTrade: trade?.riskPerTrade || '50',
        lotSize: trade?.lotSize !== undefined && trade?.lotSize !== null ? String(trade.lotSize) : '',

        // Trade Management
        partialTaken: trade?.partialTaken || false,
        slMovedToBE: trade?.slMovedToBE || false,
        emotionalState: trade?.emotionalState || 'Calm',

        // Exit (if closed)
        exitPrice: trade?.exitPrice || '',
        exitTime: trade?.exitTime ? isoToIstInputValue(trade.exitTime) : '',

        // Rule Evaluation
        followedHTFBias: trade?.followedHTFBias !== undefined ? trade.followedHTFBias : true,
        correctSession: trade?.correctSession !== undefined ? trade.correctSession : true,
        validPDArray: trade?.validPDArray !== undefined ? trade.validPDArray : true,
        riskRespected: trade?.riskRespected !== undefined ? trade.riskRespected : true,
        noEarlyExit: trade?.noEarlyExit !== undefined ? trade.noEarlyExit : true,

        // Strong Data (Post-trade)
        mae: trade?.mae !== undefined && trade?.mae !== null ? String(trade.mae) : '',
        mfe: trade?.mfe !== undefined && trade?.mfe !== null ? String(trade.mfe) : '',
        htfLevelUsed: trade?.htfLevelUsed || '',
        ltfConfirmationQuality: trade?.ltfConfirmationQuality || '',

        // Notes
        notes: trade?.notes || ''
    })
    const [chartSymbol, setChartSymbol] = useState(
        trade?.chartConfig?.symbol || resolveTradingViewSymbol(trade?.market || 'Forex', trade?.instrument || 'XAUUSD')
    )
    const [chartTimeframe, setChartTimeframe] = useState(
        trade?.chartConfig?.timeframe || toTradingViewInterval(trade?.entryTimeframe || '5m')
    )
    const [chartTimeframes, setChartTimeframes] = useState<string[]>(
        Array.isArray(trade?.chartConfig?.timeframes) && trade.chartConfig.timeframes.length
            ? trade.chartConfig.timeframes.slice(0, 3)
            : ['5', '15', '60']
    )

    const entryNum = Number(formData.entryPrice)
    const stopNum = Number(formData.stopLoss)
    const targetNum = Number(formData.takeProfit)
    const risk = Number.isFinite(entryNum) && Number.isFinite(stopNum) ? Math.abs(entryNum - stopNum) : 0
    const reward = Number.isFinite(entryNum) && Number.isFinite(targetNum) ? Math.abs(targetNum - entryNum) : 0
    const rrPreview = risk > 0 ? reward / risk : 0

    const copyLevels = async () => {
        const payload = [
            `Symbol: ${chartSymbol}`,
            `Direction: ${String(formData.direction || '').toUpperCase()}`,
            `Entry: ${formData.entryPrice || '-'}`,
            `Stop Loss: ${formData.stopLoss || '-'}`,
            `Take Profit: ${formData.takeProfit || '-'}`,
            `Trade Time (IST): ${formData.entryTime ? formatIstDateTime(istInputToIso(formData.entryTime)) : '-'}`,
            `Entry TF: ${formData.entryTimeframe || '-'}`,
            `RR: ${rrPreview > 0 ? rrPreview.toFixed(2) : '-'}`
        ].join('\n')

        try {
            await navigator.clipboard.writeText(payload)
        } catch (err) {
            console.error('Failed to copy levels', err)
        }
    }

    useEffect(() => {
        const next = resolveTradingViewSymbol(formData.market, formData.instrument)
        setChartSymbol(next)
    }, [formData.market, formData.instrument])

    const validateStep = (currentStep: number): boolean => {
        const newErrors: string[] = []

        if (currentStep === 1) {
            if (!formData.market) newErrors.push('Market is required')
            if (!formData.instrument) newErrors.push('Instrument is required')
            if (formData.strategyStyle === 'ICT') {
                if (!formData.session) newErrors.push('Session is required for ICT style')
                if (!formData.weeklyBias) newErrors.push('Weekly Bias is required for ICT style')
                if (!formData.dailyBias) newErrors.push('Daily Bias is required for ICT style')
                if (!formData.drawOnLiquidity) newErrors.push('Draw on Liquidity is required for ICT style')
            }
        }

        if (currentStep === 2) {
            if (formData.strategyStyle === 'ICT') {
                if (!formData.setupType) newErrors.push('Setup Type is required (select ONE only)')
                if (formData.pdArrays.length === 0) newErrors.push('Select at least one PD Array')
            } else {
                if (!formData.strategyName) newErrors.push('Strategy is required for Non-ICT style')
            }
        }

        if (currentStep === 3) {
            if (!formData.entryPrice) newErrors.push('Entry Price is required')
            if (!formData.stopLoss) newErrors.push('Stop Loss is required')
            if (!formData.takeProfit) newErrors.push('Take Profit is required')
            if (!formData.riskPerTrade) newErrors.push('Risk per trade is required')
            if (!formData.entryConfirmation) newErrors.push('Entry Confirmation is required')
        }

        setErrors(newErrors)
        return newErrors.length === 0
    }

    const handleNext = () => {
        if (validateStep(step)) {
            setStep(step + 1)
            setErrors([])
        }
    }

    const handlePrevious = () => {
        setStep(step - 1)
        setErrors([])
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!validateStep(step)) {
            return
        }

        setLoading(true)

        try {
            const dateIso = istInputToIso(formData.date) || new Date().toISOString()
            const entryTimeIso = istInputToIso(formData.entryTime) || dateIso
            const exitTimeIso = istInputToIso(formData.exitTime)

            const tradeData = {
                ...formData,
                strategyName: formData.strategyStyle === 'ICT' ? undefined : (formData.strategyName || undefined),
                killzone: (formData.killzone ? formData.killzone : undefined),
                session: formData.strategyStyle === 'ICT' ? formData.session : undefined,
                weeklyBias: formData.strategyStyle === 'ICT' ? formData.weeklyBias : undefined,
                dailyBias: formData.strategyStyle === 'ICT' ? formData.dailyBias : undefined,
                drawOnLiquidity: formData.strategyStyle === 'ICT' ? formData.drawOnLiquidity : undefined,
                isPremiumDiscount: formData.strategyStyle === 'ICT' ? formData.isPremiumDiscount : undefined,
                setupType: formData.strategyStyle === 'ICT' ? formData.setupType : undefined,
                pdArrays: formData.strategyStyle === 'ICT' ? formData.pdArrays : [],
                entryPrice: parseFloat(formData.entryPrice as string),
                stopLoss: parseFloat(formData.stopLoss as string),
                takeProfit: parseFloat(formData.takeProfit as string),
                riskPerTrade: parseFloat(formData.riskPerTrade as string),
                lotSize: formData.lotSize ? parseFloat(formData.lotSize as string) : undefined,
                exitPrice: formData.exitPrice ? parseFloat(formData.exitPrice as string) : undefined,
                mae: formData.mae ? parseFloat(formData.mae as string) : undefined,
                mfe: formData.mfe ? parseFloat(formData.mfe as string) : undefined,
                htfLevelUsed: formData.htfLevelUsed ? String(formData.htfLevelUsed) : undefined,
                ltfConfirmationQuality: formData.ltfConfirmationQuality ? String(formData.ltfConfirmationQuality) : undefined,
                date: dateIso,
                entryTime: entryTimeIso,
                exitTime: exitTimeIso
                ,
                chartConfig: {
                    symbol: chartSymbol,
                    timeframe: chartTimeframe,
                    timeframes: chartTimeframes
                }
            }

            let response
            if (trade) {
                response = await api.patch(`/trades/${trade._id}`, tradeData)
            } else {
                response = await api.post('/trades', tradeData)
            }

            onSuccess()
            onClose()
        } catch (err: any) {
            console.error('Failed to save trade:', err)
            const data = err?.response?.data
            const violations = Array.isArray(data?.violations) ? data.violations.filter(Boolean) : []
            const msg =
                (typeof data?.message === 'string' && data.message) ||
                (typeof data?.error === 'string' && data.error) ||
                (Array.isArray(data?.error) ? data.error.map((e: any) => e?.message).filter(Boolean).join(', ') : '')
            const combined = [msg || 'Failed to save trade. Please try again.', ...violations]
                .map((s) => String(s || '').trim())
                .filter(Boolean)
            setErrors(Array.from(new Set(combined)))
        } finally {
            setLoading(false)
        }
    }

    const togglePDArray = (array: string) => {
        const current = formData.pdArrays
        if (current.includes(array)) {
            setFormData({ ...formData, pdArrays: current.filter((a: string) => a !== array) })
        } else {
            setFormData({ ...formData, pdArrays: [...current, array] })
        }
    }

    const progressPercentage = (step / 4) * 100

    return (
        <div
            style={{
                position: 'fixed',
                inset: '0',
                zIndex: 50,
                backgroundColor: 'rgba(0, 0, 0, 0.9)',
                overflowY: 'auto'
            }}
            onClick={onClose}
        >
            <div
                style={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '28px 16px',
                    boxSizing: 'border-box'
                }}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{
                        backgroundColor: '#0b1220',
                        borderRadius: '16px',
                        border: '1px solid #0f172a',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
                        width: '95vw',
                        maxWidth: '1400px',
                        display: 'flex',
                        flexDirection: 'column'
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header with Progress Bar */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '24px 24px 0 24px',
                        borderBottom: '1px solid #0f172a'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                            <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#e2e8f0' }}>
                                {trade ? 'Edit ICT Trade' : 'New ICT Trade'}
                            </h2>
                            <button
                                onClick={onClose}
                                style={{
                                    color: '#94a3b8',
                                    padding: '8px',
                                    backgroundColor: 'transparent',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}
                                onMouseOver={(e) => {
                                    e.currentTarget.style.color = '#e2e8f0'
                                    e.currentTarget.style.backgroundColor = '#0f172a'
                                }}
                                onMouseOut={(e) => {
                                    e.currentTarget.style.color = '#94a3b8'
                                    e.currentTarget.style.backgroundColor = 'transparent'
                                }}
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Progress Bar */}
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span style={{ fontSize: '12px', color: '#94a3b8' }}>Step {step} of 4</span>
                                <span style={{ fontSize: '12px', color: '#94a3b8' }}>{Math.round(progressPercentage)}% Complete</span>
                            </div>
                            <div style={{ width: '100%', height: '4px', backgroundColor: '#0f172a', borderRadius: '2px', overflow: 'hidden' }}>
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progressPercentage}%` }}
                                    style={{ height: '100%', backgroundColor: '#2563eb', transition: 'width 0.3s' }}
                                />
                            </div>
                        </div>

                        {/* Step Indicators */}
                        <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', overflowX: 'auto' }}>
                            {['Pre-Trade', 'Setup', 'Entry', 'Review'].map((label, idx) => (
                                <div key={label} style={{
                                    flex: 1,
                                    padding: '8px 12px',
                                    borderRadius: '6px',
                                    backgroundColor: step > idx + 1 ? '#1d4ed8' : step === idx + 1 ? '#2563eb' : '#0f172a',
                                    color: step >= idx + 1 ? '#fff' : '#94a3b8',
                                    fontSize: '13px',
                                    fontWeight: '500',
                                    textAlign: 'center',
                                    whiteSpace: 'nowrap',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px'
                                }}>
                                    {step > idx + 1 && <CheckCircle2 size={14} />}
                                    {label}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Error Messages */}
                    {errors.length > 0 && (
                        <div style={{
                            margin: '16px 24px 0 24px',
                            padding: '12px 16px',
                            backgroundColor: '#7f1d1d',
                            border: '1px solid #991b1b',
                            borderRadius: '8px'
                        }}>
                            {errors.map((error, idx) => (
                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fca5a5', fontSize: '13px', marginBottom: errors.length > 1 && idx < errors.length - 1 ? '6px' : 0 }}>
                                    <AlertCircle size={14} />
                                    {error}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Form Content */}
                    <div style={{
                        padding: '24px'
                    }}>
                        <form onSubmit={handleSubmit}>
                            {/* STEP 1: PRE-TRADE ANALYSIS */}
                            {step === 1 && (
                                <div>
                                    <div style={formSectionStyle}>
                                        <h3 style={sectionTitleStyle}>📊 Basic Information</h3>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                                            <div>
                                                <label style={labelStyle}>Date & Time *</label>
                                                <input
                                                    type="datetime-local"
                                                    value={formData.date}
                                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                                    style={inputStyle}
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Market *</label>
                                                <select
                                                    value={formData.market}
                                                    onChange={(e) => {
                                                        const nextMarket = e.target.value
                                                        const nextDefault = INSTRUMENT_LIBRARY[nextMarket]?.[0] || ''
                                                        setFormData({ ...formData, market: nextMarket, instrument: nextDefault || formData.instrument })
                                                    }}
                                                    style={inputStyle}
                                                    required
                                                >
                                                    {MARKET_OPTIONS.map((market) => <option key={market} value={market}>{market}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Strategy Style *</label>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    {['ICT', 'Non-ICT'].map((style) => (
                                                        <button
                                                            key={style}
                                                            type="button"
                                                            onClick={() => setFormData({ ...formData, strategyStyle: style, strategyName: style === 'ICT' ? '' : formData.strategyName })}
                                                            style={{
                                                                flex: 1,
                                                                padding: '10px',
                                                                borderRadius: '8px',
                                                                border: formData.strategyStyle === style ? '2px solid #2563eb' : '1px solid #bfdbfe',
                                                                backgroundColor: formData.strategyStyle === style ? 'rgba(37, 99, 235, 0.2)' : 'transparent',
                                                                color: formData.strategyStyle === style ? '#bfdbfe' : '#94a3b8',
                                                                cursor: 'pointer',
                                                                fontSize: '13px',
                                                                fontWeight: '500'
                                                            }}
                                                        >
                                                            {style}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Instrument *</label>
                                                <input
                                                    type="text"
                                                    value={formData.instrument}
                                                    onChange={(e) => setFormData({ ...formData, instrument: e.target.value })}
                                                    style={inputStyle}
                                                    list="instrument-suggestions"
                                                    required
                                                    placeholder="e.g., BTCUSDT / NIFTY50 / RELIANCE"
                                                />
                                                <datalist id="instrument-suggestions">
                                                    {(INSTRUMENT_LIBRARY[formData.market] || []).map((item) => (
                                                        <option key={item} value={item} />
                                                    ))}
                                                </datalist>
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Direction *</label>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData({ ...formData, direction: 'long' })}
                                                        style={{
                                                            flex: 1,
                                                            padding: '10px',
                                                            borderRadius: '8px',
                                                            border: formData.direction === 'long' ? '2px solid #22c55e' : '1px solid #bfdbfe',
                                                            backgroundColor: formData.direction === 'long' ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                                                            color: formData.direction === 'long' ? '#22c55e' : '#94a3b8',
                                                            cursor: 'pointer',
                                                            fontSize: '13px',
                                                            fontWeight: '500',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            gap: '4px'
                                                        }}
                                                    >
                                                        <TrendingUp size={16} />
                                                        Long
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData({ ...formData, direction: 'short' })}
                                                        style={{
                                                            flex: 1,
                                                            padding: '10px',
                                                            borderRadius: '8px',
                                                            border: formData.direction === 'short' ? '2px solid #ef4444' : '1px solid #bfdbfe',
                                                            backgroundColor: formData.direction === 'short' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                                                            color: formData.direction === 'short' ? '#ef4444' : '#94a3b8',
                                                            cursor: 'pointer',
                                                            fontSize: '13px',
                                                            fontWeight: '500',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            gap: '4px'
                                                        }}
                                                    >
                                                        <TrendingDown size={16} />
                                                        Short
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {formData.strategyStyle === 'ICT' && (
                                        <div style={formSectionStyle}>
                                            <h3 style={sectionTitleStyle}>🌍 Session & Killzone</h3>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                                                <div>
                                                    <label style={labelStyle}>Session *</label>
                                                    <select
                                                        value={formData.session}
                                                        onChange={(e) => setFormData({ ...formData, session: e.target.value })}
                                                        style={inputStyle}
                                                        required
                                                    >
                                                        {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label style={labelStyle}>Killzone (Optional)</label>
                                                    <select
                                                        value={formData.killzone}
                                                        onChange={(e) => setFormData({ ...formData, killzone: e.target.value })}
                                                        style={inputStyle}
                                                    >
                                                        <option value="">None</option>
                                                        {KILLZONES.map(k => <option key={k} value={k}>{k}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {formData.strategyStyle === 'ICT' && (
                                        <div style={formSectionStyle}>
                                            <h3 style={sectionTitleStyle}>📈 HTF Bias & Context</h3>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                                                <div>
                                                    <label style={labelStyle}>Weekly Bias *</label>
                                                    <select
                                                        value={formData.weeklyBias}
                                                        onChange={(e) => setFormData({ ...formData, weeklyBias: e.target.value })}
                                                        style={inputStyle}
                                                        required
                                                    >
                                                        {HTF_BIAS_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label style={labelStyle}>Daily Bias *</label>
                                                    <select
                                                        value={formData.dailyBias}
                                                        onChange={(e) => setFormData({ ...formData, dailyBias: e.target.value })}
                                                        style={inputStyle}
                                                        required
                                                    >
                                                        {HTF_BIAS_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label style={labelStyle}>Draw on Liquidity *</label>
                                                    <select
                                                        value={formData.drawOnLiquidity}
                                                        onChange={(e) => setFormData({ ...formData, drawOnLiquidity: e.target.value })}
                                                        style={inputStyle}
                                                        required
                                                    >
                                                        {LIQUIDITY_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                            <div>
                                                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.isPremiumDiscount}
                                                        onChange={(e) => setFormData({ ...formData, isPremiumDiscount: e.target.checked })}
                                                        style={{ width: '16px', height: '16px' }}
                                                    />
                                                    Premium / Discount Zone
                                                </label>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* STEP 2: SETUP & PD ARRAYS */}
                            {step === 2 && (
                                <div>
                                    {formData.strategyStyle === 'ICT' ? (
                                        <>
                                            <div style={formSectionStyle}>
                                                <h3 style={sectionTitleStyle}>🎯 ICT Setup Type (SELECT ONE ONLY)</h3>
                                                <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '16px' }}>
                                                    ⚠️ You can only select ONE setup type per trade
                                                </p>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                                                    {SETUP_TYPES.map(setup => (
                                                        <button
                                                            key={setup}
                                                            type="button"
                                                            onClick={() => setFormData({ ...formData, setupType: setup })}
                                                            style={{
                                                                padding: '14px 16px',
                                                                borderRadius: '8px',
                                                                border: formData.setupType === setup ? '2px solid #2563eb' : '1px solid #bfdbfe',
                                                                backgroundColor: formData.setupType === setup ? 'rgba(249, 115, 22, 0.15)' : 'transparent',
                                                                color: formData.setupType === setup ? '#2563eb' : '#94a3b8',
                                                                cursor: 'pointer',
                                                                fontSize: '14px',
                                                                fontWeight: '500',
                                                                transition: 'all 0.2s',
                                                                textAlign: 'center'
                                                            }}
                                                        >
                                                            {setup}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div style={formSectionStyle}>
                                                <h3 style={sectionTitleStyle}>📍 PD Arrays Used (Select Multiple)</h3>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                                                    {PD_ARRAYS.map(array => (
                                                        <button
                                                            key={array}
                                                            type="button"
                                                            onClick={() => togglePDArray(array)}
                                                            style={{
                                                                padding: '12px 14px',
                                                                borderRadius: '8px',
                                                                border: formData.pdArrays.includes(array) ? '2px solid #10b981' : '1px solid #bfdbfe',
                                                                backgroundColor: formData.pdArrays.includes(array) ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                                                                color: formData.pdArrays.includes(array) ? '#10b981' : '#94a3b8',
                                                                cursor: 'pointer',
                                                                fontSize: '13px',
                                                                fontWeight: '500',
                                                                transition: 'all 0.2s',
                                                                textAlign: 'center',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                gap: '6px'
                                                            }}
                                                        >
                                                            {formData.pdArrays.includes(array) && <CheckCircle2 size={14} />}
                                                            {array}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div style={formSectionStyle}>
                                            <h3 style={sectionTitleStyle}>🎯 Strategy (Non-ICT)</h3>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                                                {NON_ICT_STRATEGIES.map((strategy) => (
                                                    <button
                                                        key={strategy}
                                                        type="button"
                                                        onClick={() => setFormData({ ...formData, strategyName: strategy })}
                                                        style={{
                                                            padding: '14px 16px',
                                                            borderRadius: '8px',
                                                            border: formData.strategyName === strategy ? '2px solid #2563eb' : '1px solid #bfdbfe',
                                                            backgroundColor: formData.strategyName === strategy ? 'rgba(37, 99, 235, 0.15)' : 'transparent',
                                                            color: formData.strategyName === strategy ? '#bfdbfe' : '#94a3b8',
                                                            cursor: 'pointer',
                                                            fontSize: '14px',
                                                            fontWeight: '500',
                                                            textAlign: 'center'
                                                        }}
                                                    >
                                                        {strategy}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* STEP 3: ENTRY EXECUTION */}
                            {step === 3 && (
                                <div>
                                    <div style={formSectionStyle}>
                                        <h3 style={sectionTitleStyle}>⚡ Entry Execution</h3>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                                            <div>
                                                <label style={labelStyle}>Entry Time *</label>
                                                <input
                                                    type="datetime-local"
                                                    value={formData.entryTime}
                                                    onChange={(e) => setFormData({ ...formData, entryTime: e.target.value })}
                                                    style={inputStyle}
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Entry Timeframe *</label>
                                                <select
                                                    value={formData.entryTimeframe}
                                                    onChange={(e) => setFormData({ ...formData, entryTimeframe: e.target.value })}
                                                    style={inputStyle}
                                                    required
                                                >
                                                    {ENTRY_TIMEFRAMES.map(tf => <option key={tf} value={tf}>{tf}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Entry Confirmation *</label>
                                                <select
                                                    value={formData.entryConfirmation}
                                                    onChange={(e) => setFormData({ ...formData, entryConfirmation: e.target.value })}
                                                    style={inputStyle}
                                                    required
                                                >
                                                    {ENTRY_CONFIRMATIONS.map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={formSectionStyle}>
                                        <h3 style={sectionTitleStyle}>💰 Price Levels & Risk</h3>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
                                            <div>
                                                <label style={labelStyle}>Entry Price *</label>
                                                <input
                                                    type="number"
                                                    step="0.00001"
                                                    value={formData.entryPrice}
                                                    onChange={(e) => setFormData({ ...formData, entryPrice: e.target.value })}
                                                    style={inputStyle}
                                                    required
                                                    placeholder="0.00000"
                                                />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Stop Loss *</label>
                                                <input
                                                    type="number"
                                                    step="0.00001"
                                                    value={formData.stopLoss}
                                                    onChange={(e) => setFormData({ ...formData, stopLoss: e.target.value })}
                                                    style={inputStyle}
                                                    required
                                                    placeholder="0.00000"
                                                />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Take Profit *</label>
                                                <input
                                                    type="number"
                                                    step="0.00001"
                                                    value={formData.takeProfit}
                                                    onChange={(e) => setFormData({ ...formData, takeProfit: e.target.value })}
                                                    style={inputStyle}
                                                    required
                                                    placeholder="0.00000"
                                                />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Risk per Trade ($) *</label>
                                                <input
                                                    type="number"
                                                    step="1"
                                                    value={formData.riskPerTrade}
                                                    onChange={(e) => setFormData({ ...formData, riskPerTrade: e.target.value })}
                                                    style={inputStyle}
                                                    required
                                                    placeholder="50"
                                                />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Lot Size (Optional)</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={formData.lotSize}
                                                    onChange={(e) => setFormData({ ...formData, lotSize: e.target.value })}
                                                    style={inputStyle}
                                                    placeholder="e.g., 0.35"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div style={formSectionStyle}>
                                        <h3 style={sectionTitleStyle}>🎭 Emotional State</h3>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
                                            {EMOTIONAL_STATES.map(state => (
                                                <button
                                                    key={state}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, emotionalState: state })}
                                                    style={{
                                                        padding: '12px',
                                                        borderRadius: '8px',
                                                        border: formData.emotionalState === state ? '2px solid #2563eb' : '1px solid #bfdbfe',
                                                        backgroundColor: formData.emotionalState === state ? 'rgba(249, 115, 22, 0.15)' : 'transparent',
                                                        color: formData.emotionalState === state ? '#2563eb' : '#94a3b8',
                                                        cursor: 'pointer',
                                                        fontSize: '13px',
                                                        fontWeight: '500',
                                                        transition: 'all 0.2s',
                                                        textAlign: 'center'
                                                    }}
                                                >
                                                    {state}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div style={formSectionStyle}>
                                        <h3 style={sectionTitleStyle}>📺 Multi-Timeframe Live Chart</h3>
                                        <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '16px' }}>
                                            Screenshot ke bajay yahi pair ka TradingView chart save hoga aur history me bhi show hoga.
                                        </p>

                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '14px' }}>
                                            <div>
                                                <label style={labelStyle}>TradingView Symbol</label>
                                                <input
                                                    type="text"
                                                    value={chartSymbol}
                                                    onChange={(e) => setChartSymbol(e.target.value.toUpperCase())}
                                                    style={inputStyle}
                                                    placeholder="OANDA:XAUUSD"
                                                />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Default Chart Timeframe</label>
                                                <select
                                                    value={chartTimeframe}
                                                    onChange={(e) => setChartTimeframe(e.target.value)}
                                                    style={inputStyle}
                                                >
                                                    {CHART_TIMEFRAME_OPTIONS.map((tf) => (
                                                        <option key={tf} value={tf}>{tf}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <div style={{ marginBottom: '14px' }}>
                                            <label style={labelStyle}>Track Timeframes (max 3)</label>
                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                {CHART_TIMEFRAME_OPTIONS.map((tf) => {
                                                    const selected = chartTimeframes.includes(tf)
                                                    return (
                                                        <button
                                                            key={tf}
                                                            type="button"
                                                            onClick={() => {
                                                                if (selected) {
                                                                    setChartTimeframes(chartTimeframes.filter((v) => v !== tf))
                                                                    return
                                                                }
                                                                if (chartTimeframes.length >= 3) return
                                                                setChartTimeframes([...chartTimeframes, tf])
                                                            }}
                                                            style={{
                                                                padding: '8px 12px',
                                                                borderRadius: '8px',
                                                                border: selected ? '2px solid #22d3ee' : '1px solid #bfdbfe',
                                                                backgroundColor: selected ? 'rgba(34, 211, 238, 0.15)' : 'transparent',
                                                                color: selected ? '#67e8f9' : '#94a3b8',
                                                                cursor: 'pointer',
                                                                fontSize: '12px',
                                                                fontWeight: '600'
                                                            }}
                                                        >
                                                            {tf}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>

                                        <div style={{ border: '1px solid #1e3a8a', borderRadius: '10px', overflow: 'hidden' }}>
                                            <TradingViewEmbed
                                                symbol={chartSymbol}
                                                interval={chartTimeframe}
                                                height={380}
                                            />
                                        </div>

                                        <div style={{ marginTop: '12px', border: '1px solid #1e3a8a', borderRadius: '10px', padding: '12px', backgroundColor: '#0f172a' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
                                                <div style={{ fontSize: '13px', fontWeight: '600', color: '#e2e8f0' }}>Trade Position Guide</div>
                                                <button
                                                    type="button"
                                                    onClick={copyLevels}
                                                    style={{
                                                        padding: '6px 10px',
                                                        borderRadius: '8px',
                                                        border: '1px solid #334155',
                                                        backgroundColor: '#0b1220',
                                                        color: '#bfdbfe',
                                                        fontSize: '12px',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    Copy Levels
                                                </button>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
                                                <div style={{ padding: '10px', borderRadius: '8px', backgroundColor: '#0b1220', border: '1px solid #1e293b' }}>
                                                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>Entry</div>
                                                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#f8fafc' }}>{formData.entryPrice || '-'}</div>
                                                </div>
                                                <div style={{ padding: '10px', borderRadius: '8px', backgroundColor: '#0b1220', border: '1px solid #1e293b' }}>
                                                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>Stop Loss</div>
                                                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#fca5a5' }}>{formData.stopLoss || '-'}</div>
                                                </div>
                                                <div style={{ padding: '10px', borderRadius: '8px', backgroundColor: '#0b1220', border: '1px solid #1e293b' }}>
                                                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>Take Profit</div>
                                                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#86efac' }}>{formData.takeProfit || '-'}</div>
                                                </div>
                                                <div style={{ padding: '10px', borderRadius: '8px', backgroundColor: '#0b1220', border: '1px solid #1e293b' }}>
                                                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>R:R</div>
                                                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#e2e8f0' }}>{rrPreview > 0 ? rrPreview.toFixed(2) : '-'}</div>
                                                </div>
                                            </div>
                                            <div style={{ marginTop: '8px', fontSize: '11px', color: '#94a3b8' }}>
                                                Trade Time (IST): {formData.entryTime ? formatIstDateTime(istInputToIso(formData.entryTime)) : '-'} | Entry TF: {formData.entryTimeframe || '-'}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={formSectionStyle}>
                                        <h3 style={sectionTitleStyle}>🎯 Trade Management</h3>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={formData.partialTaken}
                                                    onChange={(e) => setFormData({ ...formData, partialTaken: e.target.checked })}
                                                    style={{ width: '18px', height: '18px' }}
                                                />
                                                Partial Profit Taken
                                            </label>
                                            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={formData.slMovedToBE}
                                                    onChange={(e) => setFormData({ ...formData, slMovedToBE: e.target.checked })}
                                                    style={{ width: '18px', height: '18px' }}
                                                />
                                                Stop Loss Moved to Breakeven
                                            </label>
                                        </div>
                                    </div>

                                    <div style={formSectionStyle}>
                                        <h3 style={sectionTitleStyle}>🏁 Exit (If Closed)</h3>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                                            <div>
                                                <label style={labelStyle}>Exit Price (Optional)</label>
                                                <input
                                                    type="number"
                                                    step="0.00001"
                                                    value={formData.exitPrice}
                                                    onChange={(e) => setFormData({ ...formData, exitPrice: e.target.value })}
                                                    style={inputStyle}
                                                    placeholder="Leave empty if still open"
                                                />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>Exit Time (Optional)</label>
                                                <input
                                                    type="datetime-local"
                                                    value={formData.exitTime}
                                                    onChange={(e) => setFormData({ ...formData, exitTime: e.target.value })}
                                                    style={inputStyle}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* STEP 4: POST-TRADE REVIEW */}
                            {step === 4 && (
                                <div>
                                    <div style={formSectionStyle}>
                                        <h3 style={sectionTitleStyle}>✅ Rule Evaluation</h3>
                                        <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '16px' }}>
                                            Check each box if you followed the rule correctly
                                        </p>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', backgroundColor: '#0b1220', borderRadius: '6px' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={formData.followedHTFBias}
                                                    onChange={(e) => setFormData({ ...formData, followedHTFBias: e.target.checked })}
                                                    style={{ width: '18px', height: '18px' }}
                                                />
                                                Followed HTF Bias (Weekly/Daily alignment)
                                            </label>
                                            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', backgroundColor: '#0b1220', borderRadius: '6px' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={formData.correctSession}
                                                    onChange={(e) => setFormData({ ...formData, correctSession: e.target.checked })}
                                                    style={{ width: '18px', height: '18px' }}
                                                />
                                                Correct Session / Killzone
                                            </label>
                                            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', backgroundColor: '#0b1220', borderRadius: '6px' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={formData.validPDArray}
                                                    onChange={(e) => setFormData({ ...formData, validPDArray: e.target.checked })}
                                                    style={{ width: '18px', height: '18px' }}
                                                />
                                                Valid PD Array Used
                                            </label>
                                            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', backgroundColor: '#0b1220', borderRadius: '6px' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={formData.riskRespected}
                                                    onChange={(e) => setFormData({ ...formData, riskRespected: e.target.checked })}
                                                    style={{ width: '18px', height: '18px' }}
                                                />
                                                Risk Management Respected
                                            </label>
                                            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', backgroundColor: '#0b1220', borderRadius: '6px' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={formData.noEarlyExit}
                                                    onChange={(e) => setFormData({ ...formData, noEarlyExit: e.target.checked })}
                                                    style={{ width: '18px', height: '18px' }}
                                                />
                                                No Early Exit
                                            </label>
                                        </div>
                                    </div>

                                    <div style={formSectionStyle}>
                                        <h3 style={sectionTitleStyle}>📊 Strong Data (Optional)</h3>
                                        <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '16px' }}>
                                            Add these for sharper AI feedback (exact level + confirmation + excursion)
                                        </p>

                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                                            <div>
                                                <label style={labelStyle}>MAE (Optional)</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={formData.mae}
                                                    onChange={(e) => setFormData({ ...formData, mae: e.target.value })}
                                                    style={inputStyle}
                                                    placeholder="e.g., -0.60"
                                                />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>MFE (Optional)</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={formData.mfe}
                                                    onChange={(e) => setFormData({ ...formData, mfe: e.target.value })}
                                                    style={inputStyle}
                                                    placeholder="e.g., 1.80"
                                                />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>HTF Level Used (Optional)</label>
                                                <input
                                                    type="text"
                                                    value={formData.htfLevelUsed}
                                                    onChange={(e) => setFormData({ ...formData, htfLevelUsed: e.target.value })}
                                                    style={inputStyle}
                                                    placeholder="e.g., PDH / Weekly OB / Daily FVG"
                                                />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>LTF Confirmation Quality (Optional)</label>
                                                <select
                                                    value={formData.ltfConfirmationQuality}
                                                    onChange={(e) => setFormData({ ...formData, ltfConfirmationQuality: e.target.value })}
                                                    style={inputStyle}
                                                >
                                                    <option value="">Select</option>
                                                    <option value="Strong">Strong</option>
                                                    <option value="Weak">Weak</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={formSectionStyle}>
                                        <h3 style={sectionTitleStyle}>📝 Trade Notes</h3>
                                        <textarea
                                            value={formData.notes}
                                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                            rows={5}
                                            style={{
                                                width: '100%',
                                                padding: '12px',
                                                backgroundColor: '#0f172a',
                                                border: '1px solid #bfdbfe',
                                                borderRadius: '8px',
                                                color: '#e2e8f0',
                                                fontSize: '14px',
                                                resize: 'vertical',
                                                outline: 'none',
                                                fontFamily: 'inherit'
                                            }}
                                            placeholder="Describe your analysis, what you saw, and what you learned from this trade..."
                                        />
                                    </div>
                                </div>
                            )}
                        </form>
                    </div>

                    {/* Footer with Navigation */}
                    <div style={{
                        display: 'flex',
                        gap: '12px',
                        justifyContent: 'space-between',
                        padding: '20px 24px',
                        borderTop: '1px solid #0f172a',
                        backgroundColor: '#0b1220'
                    }}>
                        <button
                            type="button"
                            onClick={step === 1 ? onClose : handlePrevious}
                            disabled={loading}
                            style={{
                                padding: '12px 28px',
                                backgroundColor: '#0f172a',
                                border: 'none',
                                borderRadius: '8px',
                                color: '#e2e8f0',
                                fontSize: '14px',
                                fontWeight: '500',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                transition: 'background-color 0.2s',
                                opacity: loading ? 0.5 : 1
                            }}
                            onMouseOver={(e) => !loading && (e.currentTarget.style.backgroundColor = '#bfdbfe')}
                            onMouseOut={(e) => !loading && (e.currentTarget.style.backgroundColor = '#0f172a')}
                        >
                            {step === 1 ? 'Cancel' : 'Previous'}
                        </button>

                        {step < 4 ? (
                            <button
                                type="button"
                                onClick={handleNext}
                                disabled={loading}
                                style={{
                                    padding: '12px 28px',
                                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                                    border: 'none',
                                    borderRadius: '8px',
                                    color: '#fff',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    transition: 'transform 0.2s',
                                    opacity: loading ? 0.5 : 1
                                }}
                                onMouseOver={(e) => !loading && (e.currentTarget.style.transform = 'scale(1.02)')}
                                onMouseOut={(e) => !loading && (e.currentTarget.style.transform = 'scale(1)')}
                            >
                                Next Step →
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={loading}
                                style={{
                                    padding: '12px 32px',
                                    background: loading ? '#bfdbfe' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                    border: 'none',
                                    borderRadius: '8px',
                                    color: '#fff',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    transition: 'transform 0.2s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                                onMouseOver={(e) => !loading && (e.currentTarget.style.transform = 'scale(1.02)')}
                                onMouseOut={(e) => !loading && (e.currentTarget.style.transform = 'scale(1)')}
                            >
                                {loading ? 'Saving...' : trade ? '✓ Update Trade' : '✓ Save Trade'}
                            </button>
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    )
}


