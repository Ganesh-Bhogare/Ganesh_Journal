import { useEffect, useMemo, useRef } from 'react'

declare global {
    interface Window {
        TradingView?: any
    }
}

interface TradingViewEmbedProps {
    symbol: string
    interval: string
    height?: number
    theme?: 'light' | 'dark'
}

const SCRIPT_ID = 'tradingview-widget-script'
const SCRIPT_SRC = 'https://s3.tradingview.com/tv.js'

function ensureTradingViewScript(): Promise<void> {
    return new Promise((resolve, reject) => {
        if (window.TradingView) {
            resolve()
            return
        }

        const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
        if (existing) {
            existing.addEventListener('load', () => resolve(), { once: true })
            existing.addEventListener('error', () => reject(new Error('Failed to load TradingView script')), { once: true })
            return
        }

        const script = document.createElement('script')
        script.id = SCRIPT_ID
        script.src = SCRIPT_SRC
        script.async = true
        script.onload = () => resolve()
        script.onerror = () => reject(new Error('Failed to load TradingView script'))
        document.body.appendChild(script)
    })
}

export default function TradingViewEmbed({ symbol, interval, height = 420, theme = 'light' }: TradingViewEmbedProps) {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const widgetId = useMemo(
        () => `tv_widget_${Math.random().toString(36).slice(2)}`,
        []
    )

    useEffect(() => {
        let cancelled = false

        const mountWidget = async () => {
            try {
                await ensureTradingViewScript()
                if (cancelled || !containerRef.current || !window.TradingView?.widget) return

                containerRef.current.innerHTML = ''
                const inner = document.createElement('div')
                inner.id = widgetId
                inner.style.height = `${height}px`
                containerRef.current.appendChild(inner)

                // Advanced chart gives full chart UI, including drawing/position tools on TradingView side.
                new window.TradingView.widget({
                    autosize: true,
                    symbol,
                    interval,
                    timezone: 'Etc/UTC',
                    theme,
                    style: '1',
                    locale: 'en',
                    enable_publishing: false,
                    allow_symbol_change: true,
                    withdateranges: true,
                    hide_volume: true,
                    hide_side_toolbar: false,
                    hide_top_toolbar: false,
                    container_id: widgetId,
                    backgroundColor: theme === 'light' ? '#ffffff' : '#0b1220',
                    gridColor: theme === 'light' ? 'rgba(15,23,42,0.06)' : 'rgba(148,163,184,0.08)',
                })
            } catch (err) {
                console.error('TradingView embed failed', err)
            }
        }

        mountWidget()

        return () => {
            cancelled = true
            if (containerRef.current) containerRef.current.innerHTML = ''
        }
    }, [symbol, interval, height, widgetId, theme])

    return <div ref={containerRef} style={{ width: '100%', minHeight: `${height}px` }} />
}
