import { motion } from 'framer-motion'
import { useState } from 'react'
import { X, Upload, TrendingUp, TrendingDown } from 'lucide-react'
import GradientButton from './GradientButton'
import { api } from '../lib/api'

interface TradeFormProps {
    onClose: () => void
    onSuccess: () => void
    trade?: any
}

const FOREX_PAIRS = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD', 'EURJPY', 'GBPJPY', 'EURGBP']
const SESSIONS = ['Asian', 'London', 'New York', 'Sydney']
const TIMEFRAMES = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1']
const STRATEGIES = ['Breakout', 'Trend Following', 'Reversal', 'Scalping', 'Range Trading', 'News Trading']
const MOODS = [
    { emoji: '😊', label: 'Confident' },
    { emoji: '😐', label: 'Neutral' },
    { emoji: '😰', label: 'Anxious' },
    { emoji: '😤', label: 'Frustrated' },
    { emoji: '🤔', label: 'Uncertain' }
]

const inputStyle = {
    width: '100%',
    padding: '10px 16px',
    backgroundColor: '#262626',
    border: '1px solid #404040',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    outline: 'none'
}

const labelStyle = {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    marginBottom: '8px',
    color: '#e5e5e5'
}

export default function TradeForm({ onClose, onSuccess, trade }: TradeFormProps) {
    const [formData, setFormData] = useState({
        date: trade?.date ? new Date(trade.date).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
        instrument: trade?.instrument || 'EURUSD',
        direction: trade?.direction || 'long',
        entryPrice: trade?.entryPrice || '',
        exitPrice: trade?.exitPrice || '',
        stopLoss: trade?.stopLoss || '',
        takeProfit: trade?.takeProfit || '',
        lotSize: trade?.lotSize || '',
        notes: trade?.notes || '',
        tags: trade?.tags || [],
        timeframe: trade?.timeframe || 'H1',
        session: trade?.session || 'London',
        mood: '',
        rating: 0
    })
    const [files, setFiles] = useState<FileList | null>(null)
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            const tradeData = {
                ...formData,
                entryPrice: parseFloat(formData.entryPrice as string),
                exitPrice: formData.exitPrice ? parseFloat(formData.exitPrice as string) : undefined,
                stopLoss: formData.stopLoss ? parseFloat(formData.stopLoss as string) : undefined,
                takeProfit: formData.takeProfit ? parseFloat(formData.takeProfit as string) : undefined,
                lotSize: formData.lotSize ? parseFloat(formData.lotSize as string) : undefined,
            }

            if (trade) {
                await api.patch(`/trades/${trade._id}`, tradeData)
            } else {
                await api.post('/trades', tradeData)
            }

            if (files && files.length > 0) {
                const formDataFiles = new FormData()
                Array.from(files).forEach(file => formDataFiles.append('screenshots', file))
                await api.post('/trades/upload', formDataFiles)
            }

            onSuccess()
            onClose()
        } catch (err) {
            console.error('Failed to save trade:', err)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div
            style={{
                position: 'fixed',
                inset: '0',
                zIndex: 50,
                backgroundColor: 'rgba(0, 0, 0, 0.85)',
                backdropFilter: 'blur(8px)',
                overflowY: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px'
            }}
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{
                    backgroundColor: '#171717',
                    borderRadius: '16px',
                    border: '1px solid #262626',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
                    width: '95vw',
                    maxWidth: '1600px',
                    height: '92vh',
                    maxHeight: '950px',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '24px',
                    borderBottom: '1px solid #262626'
                }}>
                    <h2 style={{ fontSize: '28px', fontWeight: 'bold', color: '#fff' }}>
                        {trade ? 'Edit Trade' : 'New Trade'}
                    </h2>
                    <button
                        onClick={onClose}
                        style={{
                            color: '#a3a3a3',
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
                            e.currentTarget.style.color = '#ffffff'
                            e.currentTarget.style.backgroundColor = '#262626'
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.color = '#a3a3a3'
                            e.currentTarget.style.backgroundColor = 'transparent'
                        }}
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Form Content */}
                <div style={{
                    padding: '24px',
                    overflowY: 'auto',
                    flex: 1
                }}>
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                        {/* Row 1: Basic Info */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                            <div>
                                <label style={labelStyle}>Date & Time</label>
                                <input
                                    type="datetime-local"
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    style={inputStyle}
                                    required
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Pair</label>
                                <select
                                    value={formData.instrument}
                                    onChange={(e) => setFormData({ ...formData, instrument: e.target.value })}
                                    style={inputStyle}
                                >
                                    {FOREX_PAIRS.map(pair => <option key={pair} value={pair}>{pair}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={labelStyle}>Direction</label>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, direction: 'long' })}
                                        style={{
                                            flex: 1,
                                            padding: '10px 16px',
                                            borderRadius: '8px',
                                            border: formData.direction === 'long' ? '2px solid #22c55e' : '1px solid #404040',
                                            backgroundColor: formData.direction === 'long' ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                                            color: formData.direction === 'long' ? '#22c55e' : '#a3a3a3',
                                            cursor: 'pointer',
                                            fontSize: '14px',
                                            fontWeight: '500',
                                            transition: 'all 0.2s',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px'
                                        }}
                                    >
                                        <TrendingUp size={18} />
                                        Long
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, direction: 'short' })}
                                        style={{
                                            flex: 1,
                                            padding: '10px 16px',
                                            borderRadius: '8px',
                                            border: formData.direction === 'short' ? '2px solid #ef4444' : '1px solid #404040',
                                            backgroundColor: formData.direction === 'short' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                                            color: formData.direction === 'short' ? '#ef4444' : '#a3a3a3',
                                            cursor: 'pointer',
                                            fontSize: '14px',
                                            fontWeight: '500',
                                            transition: 'all 0.2s',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px'
                                        }}
                                    >
                                        <TrendingDown size={18} />
                                        Short
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Row 2: Price Levels */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                            <div>
                                <label style={labelStyle}>Entry Price *</label>
                                <input
                                    type="number"
                                    step="0.00001"
                                    value={formData.entryPrice}
                                    onChange={(e) => setFormData({ ...formData, entryPrice: e.target.value })}
                                    style={inputStyle}
                                    required
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Exit Price</label>
                                <input
                                    type="number"
                                    step="0.00001"
                                    value={formData.exitPrice}
                                    onChange={(e) => setFormData({ ...formData, exitPrice: e.target.value })}
                                    style={inputStyle}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Stop Loss</label>
                                <input
                                    type="number"
                                    step="0.00001"
                                    value={formData.stopLoss}
                                    onChange={(e) => setFormData({ ...formData, stopLoss: e.target.value })}
                                    style={inputStyle}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Take Profit</label>
                                <input
                                    type="number"
                                    step="0.00001"
                                    value={formData.takeProfit}
                                    onChange={(e) => setFormData({ ...formData, takeProfit: e.target.value })}
                                    style={inputStyle}
                                />
                            </div>
                        </div>

                        {/* Row 3: Trading Details */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                            <div>
                                <label style={labelStyle}>Lot Size</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.lotSize}
                                    onChange={(e) => setFormData({ ...formData, lotSize: e.target.value })}
                                    style={inputStyle}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Timeframe</label>
                                <select
                                    value={formData.timeframe}
                                    onChange={(e) => setFormData({ ...formData, timeframe: e.target.value })}
                                    style={inputStyle}
                                >
                                    {TIMEFRAMES.map(tf => <option key={tf} value={tf}>{tf}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={labelStyle}>Session</label>
                                <select
                                    value={formData.session}
                                    onChange={(e) => setFormData({ ...formData, session: e.target.value })}
                                    style={inputStyle}
                                >
                                    {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Strategy Tags */}
                        <div>
                            <label style={labelStyle}>Strategy</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                                {STRATEGIES.map(strategy => (
                                    <button
                                        key={strategy}
                                        type="button"
                                        onClick={() => {
                                            const tags = formData.tags || []
                                            setFormData({
                                                ...formData,
                                                tags: tags.includes(strategy)
                                                    ? tags.filter((t: string) => t !== strategy)
                                                    : [...tags, strategy]
                                            })
                                        }}
                                        style={{
                                            padding: '10px 20px',
                                            borderRadius: '8px',
                                            border: formData.tags?.includes(strategy) ? '2px solid #f97316' : '1px solid #404040',
                                            backgroundColor: formData.tags?.includes(strategy) ? 'rgba(249, 115, 22, 0.15)' : 'transparent',
                                            color: formData.tags?.includes(strategy) ? '#f97316' : '#a3a3a3',
                                            cursor: 'pointer',
                                            fontSize: '14px',
                                            fontWeight: '500',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {strategy}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Psychology Section */}
                        <div>
                            <label style={labelStyle}>How did you feel?</label>
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                {MOODS.map(mood => (
                                    <button
                                        key={mood.label}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, mood: mood.label })}
                                        style={{
                                            fontSize: '36px',
                                            padding: '12px',
                                            borderRadius: '12px',
                                            border: formData.mood === mood.label ? '2px solid #f97316' : '1px solid #404040',
                                            backgroundColor: formData.mood === mood.label ? 'rgba(249, 115, 22, 0.1)' : 'transparent',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                        title={mood.label}
                                    >
                                        {mood.emoji}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Notes */}
                        <div>
                            <label style={labelStyle}>Trade Notes</label>
                            <textarea
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                rows={4}
                                style={{
                                    width: '100%',
                                    padding: '12px 16px',
                                    backgroundColor: '#262626',
                                    border: '1px solid #404040',
                                    borderRadius: '8px',
                                    color: '#fff',
                                    fontSize: '14px',
                                    resize: 'vertical',
                                    outline: 'none',
                                    fontFamily: 'inherit'
                                }}
                                placeholder="What was your thesis? How did you manage the trade?"
                            />
                        </div>

                        {/* File Upload */}
                        <div>
                            <label style={labelStyle}>Screenshots</label>
                            <div style={{
                                border: '2px dashed #404040',
                                borderRadius: '12px',
                                padding: '32px',
                                textAlign: 'center',
                                transition: 'border-color 0.2s'
                            }}>
                                <Upload style={{ margin: '0 auto 12px', color: '#737373' }} size={36} />
                                <input
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    onChange={(e) => setFiles(e.target.files)}
                                    style={{ display: 'none' }}
                                    id="file-upload"
                                />
                                <label
                                    htmlFor="file-upload"
                                    style={{
                                        cursor: 'pointer',
                                        color: '#f97316',
                                        fontWeight: '500',
                                        fontSize: '15px'
                                    }}
                                >
                                    Click to upload trade charts
                                </label>
                                <p style={{ color: '#737373', fontSize: '13px', marginTop: '8px' }}>
                                    {files ? `${files.length} file(s) selected` : 'PNG, JPG up to 5MB'}
                                </p>
                            </div>
                        </div>

                        {/* Actions */}
                        <div style={{
                            display: 'flex',
                            gap: '16px',
                            justifyContent: 'flex-end',
                            paddingTop: '16px',
                            borderTop: '1px solid #262626'
                        }}>
                            <button
                                type="button"
                                onClick={onClose}
                                style={{
                                    padding: '12px 32px',
                                    backgroundColor: '#262626',
                                    border: 'none',
                                    borderRadius: '8px',
                                    color: '#fff',
                                    fontSize: '15px',
                                    fontWeight: '500',
                                    cursor: 'pointer',
                                    transition: 'background-color 0.2s'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#404040'}
                                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#262626'}
                            >
                                Cancel
                            </button>
                            <GradientButton type="submit" className="px-8 py-3 text-[15px]">
                                {loading ? 'Saving...' : trade ? 'Update Trade' : 'Save Trade'}
                            </GradientButton>
                        </div>
                    </form>
                </div>
            </motion.div>
        </div>
    )
}
