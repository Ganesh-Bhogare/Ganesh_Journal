export function toTradingViewInterval(tf?: string): string {
    const raw = String(tf || '').trim().toLowerCase()
    if (!raw) return '5'

    if (raw === '1m' || raw === '1') return '1'
    if (raw === '3m' || raw === '3') return '3'
    if (raw === '5m' || raw === '5') return '5'
    if (raw === '15m' || raw === '15') return '15'
    if (raw === '30m' || raw === '30') return '30'
    if (raw === '1h' || raw === '60' || raw === 'h1') return '60'
    if (raw === '4h' || raw === '240' || raw === 'h4') return '240'
    if (raw === '1d' || raw === 'd' || raw === 'd1') return 'D'
    if (raw === '1w' || raw === 'w' || raw === 'w1') return 'W'

    return tf || '5'
}

function cleanSymbol(value?: string) {
    return String(value || '')
        .toUpperCase()
        .replace(/\//g, '')
        .replace(/\s+/g, '')
}

export function resolveTradingViewSymbol(market?: string, instrument?: string): string {
    const raw = String(instrument || '').trim().toUpperCase()
    if (!raw) return 'OANDA:XAUUSD'
    if (raw.includes(':')) return raw

    const symbol = cleanSymbol(raw)
    const m = String(market || '').toLowerCase()

    if (m.includes('crypto')) {
        return `BINANCE:${symbol}`
    }

    if (m.includes('forex') || /^[A-Z]{6}$/.test(symbol) || symbol.includes('XAU') || symbol.includes('XAG')) {
        return `OANDA:${symbol}`
    }

    if (m.includes('indian')) {
        if (symbol.includes('BANKNIFTY')) return 'NSE:BANKNIFTY'
        if (symbol.includes('NIFTY')) return 'NSE:NIFTY'
        if (symbol.includes('SENSEX')) return 'BSE:SENSEX'
        const base = symbol.replace(/(FUT|CE|PE)$/g, '')
        return `NSE:${base || symbol}`
    }

    if (m.includes('indices') || m.includes('index')) {
        if (symbol.includes('NASDAQ') || symbol.includes('NDX')) return 'NASDAQ:NDX'
        if (symbol.includes('SPX') || symbol.includes('SP500') || symbol.includes('SPX500')) return 'SP:SPX'
        if (symbol.includes('BANKNIFTY')) return 'NSE:BANKNIFTY'
        if (symbol.includes('NIFTY')) return 'NSE:NIFTY'
        return `TVC:${symbol}`
    }

    return symbol
}
