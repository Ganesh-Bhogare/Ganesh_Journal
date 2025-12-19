import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { TrendingUp, Target, Award, TrendingDown } from 'lucide-react'
import StatCard from '../components/StatCard'
import AnimatedCard from '../components/AnimatedCard'
import GradientButton from '../components/GradientButton'
import ICTTradeForm from '../components/ICTTradeForm'
import EquityCurve from '../components/charts/EquityCurve'
import WinLossPie from '../components/charts/WinLossPie'
import { api } from '../lib/api'

export default function Dashboard() {
    const { user } = useAuth()
    const [showTradeForm, setShowTradeForm] = useState(false)
    const [kpis, setKpis] = useState<any>(null)
    const [recentTrades, setRecentTrades] = useState<any[]>([])

    const fetchData = async () => {
        try {
            const [kpisRes, tradesRes] = await Promise.all([
                api.get('/analytics/kpis'),
                api.get('/trades?limit=5')
            ])
            setKpis(kpisRes.data)
            setRecentTrades(tradesRes.data.items || [])
        } catch (err) {
            console.error('Failed to fetch data:', err)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    const winLossData = kpis ? [
        { name: 'Wins', value: Math.round((kpis.winRate || 0) * 100) },
        { name: 'Losses', value: Math.round((1 - (kpis.winRate || 0)) * 100) }
    ] : []

    return (
        <div className="space-y-6">
            <motion.div
                className="flex items-center justify-between"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <div>
                    <h1 className="text-3xl font-bold mb-2">Welcome Back, {user?.name || 'Trader'}</h1>
                    <p className="text-neutral-400">Glad to see you again. Let's Start Analyzing</p>
                </div>
                <div className="flex gap-3">
                    <GradientButton onClick={() => setShowTradeForm(true)}>
                        + Add New
                    </GradientButton>
                </div>
            </motion.div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Trade Win %"
                    value={kpis && kpis.winRate != null ? `${(kpis.winRate * 100).toFixed(2)}%` : '0.00%'}
                    icon={<Award />}
                    trend={kpis?.winRate > 0.5 ? 'up' : kpis?.winRate < 0.5 ? 'down' : 'neutral'}
                    delay={0.1}
                />
                <StatCard
                    title="Profit Factor"
                    value={kpis && kpis.profitFactor != null ? (isFinite(kpis.profitFactor) ? kpis.profitFactor.toFixed(2) : '0.00') : '0.00'}
                    icon={<Target />}
                    trend={kpis?.profitFactor > 1 ? 'up' : 'down'}
                    delay={0.2}
                />
                <StatCard
                    title="Avg Risk:Reward"
                    value={kpis && kpis.avgRR != null ? kpis.avgRR.toFixed(2) : '0.00'}
                    icon={<TrendingUp />}
                    trend="neutral"
                    delay={0.3}
                />
                <StatCard
                    title="Max Drawdown"
                    value={kpis && kpis.maxDrawdown != null ? `$${kpis.maxDrawdown.toFixed(2)}` : '$0.00'}
                    icon={<TrendingDown />}
                    trend="down"
                    delay={0.4}
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <AnimatedCard delay={0.5}>
                    <h3 className="text-lg font-semibold mb-4">Equity Curve</h3>
                    <div className="h-64">
                        {kpis?.equityCurve?.length > 0 ? (
                            <EquityCurve data={kpis.equityCurve} />
                        ) : (
                            <div className="h-full flex items-center justify-center text-neutral-500">
                                <p>No equity data yet</p>
                            </div>
                        )}
                    </div>
                </AnimatedCard>

                <AnimatedCard delay={0.6}>
                    <h3 className="text-lg font-semibold mb-4">Win/Loss Distribution</h3>
                    <div className="h-64">
                        {winLossData[0]?.value > 0 || winLossData[1]?.value > 0 ? (
                            <WinLossPie data={winLossData} />
                        ) : (
                            <div className="h-full flex items-center justify-center text-neutral-500">
                                <p>No trade data yet</p>
                            </div>
                        )}
                    </div>
                </AnimatedCard>
            </div>

            {/* Recent Trades */}
            <AnimatedCard delay={0.7}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Recent Trades</h3>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => window.location.href = '/trades'}
                        className="text-brand text-sm hover:underline"
                    >
                        View All →
                    </motion.button>
                </div>

                {recentTrades.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-left text-neutral-400 text-sm border-b border-neutral-800">
                                    <th className="pb-3">Date</th>
                                    <th className="pb-3">Pair</th>
                                    <th className="pb-3">Direction</th>
                                    <th className="pb-3">Entry</th>
                                    <th className="pb-3">Exit</th>
                                    <th className="pb-3">P&L</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentTrades.map((trade, i) => (
                                    <motion.tr
                                        key={trade._id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.1 }}
                                        className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors"
                                    >
                                        <td className="py-3">{new Date(trade.date).toLocaleDateString()}</td>
                                        <td className="py-3 font-medium">{trade.instrument}</td>
                                        <td className="py-3">
                                            <span className={`px-2 py-1 rounded text-xs ${trade.direction === 'long' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
                                                }`}>
                                                {trade.direction.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="py-3">{trade.entryPrice?.toFixed(5)}</td>
                                        <td className="py-3">{trade.exitPrice?.toFixed(5) || '-'}</td>
                                        <td className={`py-3 font-semibold ${(trade.pnl || 0) >= 0 ? 'text-green-500' : 'text-red-500'
                                            }`}>
                                            {trade.pnl ? `$${trade.pnl.toFixed(2)}` : '-'}
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-neutral-500 text-center py-8">
                        <p>No trades yet. Add your first trade to start tracking.</p>
                    </div>
                )}
            </AnimatedCard>

            {showTradeForm && (
                <ICTTradeForm
                    onClose={() => setShowTradeForm(false)}
                    onSuccess={fetchData}
                />
            )}
        </div>
    )
}
