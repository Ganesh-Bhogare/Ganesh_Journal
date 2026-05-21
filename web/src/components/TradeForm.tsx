import { motion } from 'framer-motion'
import { useState } from 'react'
import { X, Upload } from 'lucide-react'
import GradientButton from './GradientButton'
import { api } from '../lib/api'
import { isoToIstInputValue, istInputToIso, nowIstInputValue } from '../lib/istDate'

interface TradeFormProps {
    onClose: () => void
    onSuccess: () => void
    trade?: any
}

const FOREX_PAIRS = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD', 'EURJPY', 'GBPJPY', 'EURGBP']

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
        date: trade?.date ? isoToIstInputValue(trade.date) : nowIstInputValue(),
        instrument: trade?.instrument || 'EURUSD',
        direction: trade?.direction || 'long',
        entryPrice: trade?.entryPrice || '',
        stopLoss: trade?.stopLoss || '',
        takeProfit: trade?.takeProfit || '',
        pnl: trade?.pnl ?? '',
        mistake: trade?.mistake || '',
        improvement: trade?.improvement || ''
    })
    const [files, setFiles] = useState<FileList | null>(null)
    const [loading, setLoading] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setErrorMsg('')
        try {
            const tradeData = {
                date: istInputToIso(formData.date) || new Date().toISOString(),
                instrument: formData.instrument,
                direction: formData.direction,
                entryPrice: parseFloat(formData.entryPrice as string),
                stopLoss: formData.stopLoss ? parseFloat(formData.stopLoss as string) : undefined,
                takeProfit: formData.takeProfit ? parseFloat(formData.takeProfit as string) : undefined,
                pnl: formData.pnl !== '' ? Number(formData.pnl) : undefined,
                mistake: formData.mistake,
                improvement: formData.improvement
            }

            const response = trade
                ? await api.patch(`/trades/${trade._id}`, tradeData)
                : await api.post('/trades', tradeData)

            const tradeId = trade?._id || response?.data?._id

            if (tradeId && files && files.length > 0) {
                const formDataFiles = new FormData()
                const fileList = Array.from(files)
                if (fileList[0]) formDataFiles.append('chart', fileList[0])
                if (fileList[1]) formDataFiles.append('entry', fileList[1])
                await api.post(`/trades/${tradeId}/screenshots`, formDataFiles, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                })
            }

            onSuccess()
            onClose()
        } catch (err) {
            console.error('Failed to save trade:', err)
            const message = (err as any)?.response?.data?.error
            setErrorMsg(Array.isArray(message) ? 'Validation failed. Please check required fields.' : (message || 'Failed to save trade.'))
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

                <div style={{
                    padding: '24px',
                    overflowY: 'auto',
                    flex: 1
                }}>
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
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
                                    {FOREX_PAIRS.map((pair) => (
                                        <option key={pair} value={pair}>{pair}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label style={labelStyle}>Direction</label>
                                <select
                                    value={formData.direction}
                                    onChange={(e) => setFormData({ ...formData, direction: e.target.value })}
                                    style={inputStyle}
                                >
                                    <option value="long">Long</option>
                                    <option value="short">Short</option>
                                </select>
                            </div>
                            <div>
                                <label style={labelStyle}>Entry Price</label>
                                <input
                                    type="number"
                                    step="0.00001"
                                    min="0"
                                    value={formData.entryPrice}
                                    onChange={(e) => setFormData({ ...formData, entryPrice: e.target.value })}
                                    style={inputStyle}
                                    required
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Stop Loss</label>
                                <input
                                    type="number"
                                    step="0.00001"
                                    min="0"
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
                                    min="0"
                                    value={formData.takeProfit}
                                    onChange={(e) => setFormData({ ...formData, takeProfit: e.target.value })}
                                    style={inputStyle}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>PnL (use - for loss)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.pnl}
                                    onChange={(e) => setFormData({ ...formData, pnl: e.target.value })}
                                    style={inputStyle}
                                />
                            </div>
                        </div>
                        {errorMsg && (
                            <div style={{
                                padding: '12px 14px',
                                backgroundColor: '#3f1d1d',
                                border: '1px solid #7f1d1d',
                                color: '#fecaca',
                                borderRadius: '8px',
                                fontSize: '14px'
                            }}>
                                {errorMsg}
                            </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '20px' }}>
                            <div>
                                <label style={labelStyle}>Mistake</label>
                                <textarea
                                    value={formData.mistake}
                                    onChange={(e) => setFormData({ ...formData, mistake: e.target.value })}
                                    rows={3}
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
                                    placeholder="What went wrong?"
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Improvement</label>
                                <textarea
                                    value={formData.improvement}
                                    onChange={(e) => setFormData({ ...formData, improvement: e.target.value })}
                                    rows={3}
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
                                    placeholder="What will you do better next time?"
                                />
                            </div>
                        </div>

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
                                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#404040')}
                                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#262626')}
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
