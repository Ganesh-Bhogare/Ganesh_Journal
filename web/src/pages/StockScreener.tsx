import { Activity, Zap } from 'lucide-react'
import AnimatedCard from '../components/AnimatedCard'
import IndianMomentumPanel from '../components/IndianMomentumPanel'

export default function StockScreener() {
    return (
        <div className="space-y-6">
            <AnimatedCard delay={0.02} className="p-4 md:p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-100">
                            <Activity size={16} className="text-cyan-300" />
                            Stock Screener Panel
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                            Dedicated TradeStorm-style scanner for Indian market momentum. Use strict mode for high-conviction setups.
                        </div>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-xl border border-cyan-700/40 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-200">
                        <Zap size={14} />
                        Live Signal Engine
                    </div>
                </div>
            </AnimatedCard>

            <IndianMomentumPanel delay={0.08} limit={12} />
        </div>
    )
}
