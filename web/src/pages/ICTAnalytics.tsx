import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import AnimatedCard from '../components/AnimatedCard'
import { api } from '../lib/api'
import { Target, TrendingUp, Award, AlertCircle, BarChart3 } from 'lucide-react'

export default function ICTAnalytics() {
    const [trades, setTrades] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchTrades()
    }, [])

    const fetchTrades = async () => {
        try {
            const { data } = await api.get('/trades')
            setTrades(data.items || [])
        } catch (err) {
            console.error('Failed to fetch trades:', err)
        } finally {
            setLoading(false)
        }
    }

    // Calculate session statistics
    const sessionStats = () => {
        const sessions = ['Asia', 'London', 'New York']
        return sessions.map(session => {
            const sessionTrades = trades.filter(t => t.session === session)
            const wins = sessionTrades.filter(t => t.outcome === 'win').length
            const total = sessionTrades.length
            const winRate = total > 0 ? (wins / total * 100).toFixed(1) : '0'
            const avgR = sessionTrades.length > 0
                ? (sessionTrades.reduce((sum, t) => sum + (t.rMultiple || 0), 0) / sessionTrades.length).toFixed(2)
                : '0.00'

            return { session, total, wins, winRate, avgR }
        })
    }

    // Calculate setup performance
    const setupStats = () => {
        const setups = ['FVG', 'Order Block', 'Liquidity Sweep + MSS', 'Judas Swing', 'Power of 3 (AMD)', 'Breaker Block']
        return setups.map(setup => {
            const setupTrades = trades.filter(t => t.setupType === setup)
            const wins = setupTrades.filter(t => t.outcome === 'win').length
            const total = setupTrades.length
            const winRate = total > 0 ? (wins / total * 100).toFixed(1) : '0'

            return { setup, total, wins, winRate }
        }).filter(s => s.total > 0).sort((a, b) => parseFloat(b.winRate) - parseFloat(a.winRate))
    }

    // Calculate trade quality distribution
    const qualityStats = () => {
        const aPlusTrades = trades.filter(t => t.tradeQuality === 'A+ Trade').length
        const ruleBreakTrades = trades.filter(t => t.tradeQuality === 'Rule Break Trade').length
        const standardTrades = trades.filter(t => t.tradeQuality === 'Standard Trade').length
        const total = trades.length

        return {
            aPlusTrades,
            ruleBreakTrades,
            standardTrades,
            aPlusPercent: total > 0 ? (aPlusTrades / total * 100).toFixed(1) : '0',
            ruleBreakPercent: total > 0 ? (ruleBreakTrades / total * 100).toFixed(1) : '0'
        }
    }

    // Calculate rule compliance
    const ruleCompliance = () => {
        if (trades.length === 0) return []

        return [
            {
                rule: 'Followed HTF Bias',
                compliant: trades.filter(t => t.followedHTFBias).length,
                total: trades.length
            },
            {
                rule: 'Correct Session',
                compliant: trades.filter(t => t.correctSession).length,
                total: trades.length
            },
            {
                rule: 'Valid PD Array',
                compliant: trades.filter(t => t.validPDArray).length,
                total: trades.length
            },
            {
                rule: 'Risk Respected',
                compliant: trades.filter(t => t.riskRespected).length,
                total: trades.length
            },
            {
                rule: 'No Early Exit',
                compliant: trades.filter(t => t.noEarlyExit).length,
                total: trades.length
            }
        ]
    }

    const sessions = sessionStats()
    const setups = setupStats()
    const quality = qualityStats()
    const rules = ruleCompliance()

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand mx-auto mb-4"></div>
                    <p className="text-neutral-400">Loading ICT Analytics...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <h1 className="text-3xl font-bold mb-2">ICT Analytics</h1>
                <p className="text-neutral-400">Process-focused trading insights</p>
            </motion.div>

            {/* Trade Quality Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <AnimatedCard delay={0.1}>
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-neutral-400 text-sm font-medium">A+ Trades</h3>
                        <Award className="text-green-500" size={20} />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <p className="text-3xl font-bold text-green-500">{quality.aPlusTrades}</p>
                        <p className="text-neutral-500 text-sm">({quality.aPlusPercent}%)</p>
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">All rules followed + Win</p>
                </AnimatedCard>

                <AnimatedCard delay={0.15}>
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-neutral-400 text-sm font-medium">Rule Breaks</h3>
                        <AlertCircle className="text-red-500" size={20} />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <p className="text-3xl font-bold text-red-500">{quality.ruleBreakTrades}</p>
                        <p className="text-neutral-500 text-sm">({quality.ruleBreakPercent}%)</p>
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">2+ rules violated</p>
                </AnimatedCard>

                <AnimatedCard delay={0.2}>
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-neutral-400 text-sm font-medium">Standard Trades</h3>
                        <Target className="text-blue-500" size={20} />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <p className="text-3xl font-bold text-blue-500">{quality.standardTrades}</p>
                        <p className="text-neutral-500 text-sm">({trades.length} total)</p>
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">Minor rule violations</p>
                </AnimatedCard>
            </div>

            {/* Session Performance */}
            <AnimatedCard delay={0.25}>
                <div className="flex items-center gap-2 mb-6">
                    <BarChart3 className="text-brand" size={22} />
                    <h2 className="text-xl font-bold">Session Performance</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-neutral-800">
                                <th className="text-left py-3 px-4 font-medium text-neutral-400">Session</th>
                                <th className="text-right py-3 px-4 font-medium text-neutral-400">Trades</th>
                                <th className="text-right py-3 px-4 font-medium text-neutral-400">Wins</th>
                                <th className="text-right py-3 px-4 font-medium text-neutral-400">Win Rate</th>
                                <th className="text-right py-3 px-4 font-medium text-neutral-400">Avg R</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sessions.map((session, idx) => (
                                <tr key={session.session} className="border-b border-neutral-800/50 hover:bg-neutral-900/50">
                                    <td className="py-4 px-4 font-medium">{session.session}</td>
                                    <td className="py-4 px-4 text-right text-neutral-400">{session.total}</td>
                                    <td className="py-4 px-4 text-right text-green-500">{session.wins}</td>
                                    <td className="py-4 px-4 text-right">
                                        <span className={`font-semibold ${parseFloat(session.winRate) >= 60 ? 'text-green-500' : parseFloat(session.winRate) >= 40 ? 'text-yellow-500' : 'text-red-500'}`}>
                                            {session.winRate}%
                                        </span>
                                    </td>
                                    <td className="py-4 px-4 text-right">
                                        <span className={`font-semibold ${parseFloat(session.avgR) > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                            {session.avgR}R
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </AnimatedCard>

            {/* Setup Performance */}
            {setups.length > 0 && (
                <AnimatedCard delay={0.3}>
                    <div className="flex items-center gap-2 mb-6">
                        <Target className="text-brand" size={22} />
                        <h2 className="text-xl font-bold">Setup Performance</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-neutral-800">
                                    <th className="text-left py-3 px-4 font-medium text-neutral-400">Setup Type</th>
                                    <th className="text-right py-3 px-4 font-medium text-neutral-400">Trades</th>
                                    <th className="text-right py-3 px-4 font-medium text-neutral-400">Wins</th>
                                    <th className="text-right py-3 px-4 font-medium text-neutral-400">Win Rate</th>
                                </tr>
                            </thead>
                            <tbody>
                                {setups.map((setup) => (
                                    <tr key={setup.setup} className="border-b border-neutral-800/50 hover:bg-neutral-900/50">
                                        <td className="py-4 px-4 font-medium">{setup.setup}</td>
                                        <td className="py-4 px-4 text-right text-neutral-400">{setup.total}</td>
                                        <td className="py-4 px-4 text-right text-green-500">{setup.wins}</td>
                                        <td className="py-4 px-4 text-right">
                                            <span className={`font-semibold ${parseFloat(setup.winRate) >= 60 ? 'text-green-500' : parseFloat(setup.winRate) >= 40 ? 'text-yellow-500' : 'text-red-500'}`}>
                                                {setup.winRate}%
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </AnimatedCard>
            )}

            {/* Rule Compliance */}
            {rules.length > 0 && (
                <AnimatedCard delay={0.35}>
                    <div className="flex items-center gap-2 mb-6">
                        <TrendingUp className="text-brand" size={22} />
                        <h2 className="text-xl font-bold">Rule Compliance</h2>
                    </div>
                    <div className="space-y-4">
                        {rules.map((rule) => {
                            const percentage = (rule.compliant / rule.total * 100).toFixed(1)
                            return (
                                <div key={rule.rule}>
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm font-medium">{rule.rule}</span>
                                        <span className="text-sm text-neutral-400">
                                            {rule.compliant}/{rule.total} ({percentage}%)
                                        </span>
                                    </div>
                                    <div className="w-full bg-neutral-800 rounded-full h-2">
                                        <div
                                            className={`h-2 rounded-full transition-all ${parseFloat(percentage) >= 80 ? 'bg-green-500' : parseFloat(percentage) >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                            style={{ width: `${percentage}%` }}
                                        />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </AnimatedCard>
            )}

            {trades.length === 0 && (
                <AnimatedCard delay={0.4}>
                    <div className="text-center py-12">
                        <BarChart3 className="mx-auto text-neutral-700 mb-4" size={48} />
                        <h3 className="text-xl font-semibold mb-2">No ICT Trades Yet</h3>
                        <p className="text-neutral-400 mb-4">Start logging your ICT trades to see detailed analytics</p>
                    </div>
                </AnimatedCard>
            )}
        </div>
    )
}
