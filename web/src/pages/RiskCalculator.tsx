import { motion } from 'framer-motion'
import { useState } from 'react'
import { Calculator, DollarSign, TrendingUp, AlertCircle } from 'lucide-react'
import AnimatedCard from '../components/AnimatedCard'
import GradientButton from '../components/GradientButton'

export default function RiskCalculator() {
    const [accountSize, setAccountSize] = useState<number>(10000)
    const [riskPercent, setRiskPercent] = useState<number>(1)
    const [stopLossPips, setStopLossPips] = useState<number>(20)
    const [pipValue, setPipValue] = useState<number>(10) // USD per pip for 1 standard lot
    const [entryPrice, setEntryPrice] = useState<number>(1.1000)
    const [stopLossPrice, setStopLossPrice] = useState<number>(1.0980)

    // Calculate position size
    const riskAmount = accountSize * (riskPercent / 100)
    const pipsAtRisk = Math.abs(entryPrice - stopLossPrice) * 10000
    const positionSize = pipsAtRisk > 0 ? (riskAmount / (pipsAtRisk * pipValue)) : 0
    const lotSize = positionSize.toFixed(2)

    return (
        <div className="space-y-6">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <h1 className="text-3xl font-bold mb-2">Risk Calculator</h1>
                <p className="text-neutral-400">Calculate optimal position sizes for your trades</p>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Input Section */}
                <AnimatedCard delay={0.1}>
                    <div className="flex items-center gap-3 mb-6">
                        <Calculator className="text-brand" size={24} />
                        <h3 className="text-xl font-semibold">Trade Parameters</h3>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Account Size ($)</label>
                            <input
                                type="number"
                                value={accountSize}
                                onChange={(e) => setAccountSize(parseFloat(e.target.value) || 0)}
                                className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:border-brand transition-colors"
                                placeholder="10000"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Risk Per Trade (%)</label>
                            <input
                                type="number"
                                step="0.1"
                                value={riskPercent}
                                onChange={(e) => setRiskPercent(parseFloat(e.target.value) || 0)}
                                className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:border-brand transition-colors"
                                placeholder="1"
                            />
                            <p className="text-xs text-neutral-500 mt-1">Recommended: 0.5% - 2%</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Entry Price</label>
                            <input
                                type="number"
                                step="0.00001"
                                value={entryPrice}
                                onChange={(e) => setEntryPrice(parseFloat(e.target.value) || 0)}
                                className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:border-brand transition-colors"
                                placeholder="1.10000"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Stop Loss Price</label>
                            <input
                                type="number"
                                step="0.00001"
                                value={stopLossPrice}
                                onChange={(e) => setStopLossPrice(parseFloat(e.target.value) || 0)}
                                className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:border-brand transition-colors"
                                placeholder="1.09800"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Pip Value (per lot)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={pipValue}
                                onChange={(e) => setPipValue(parseFloat(e.target.value) || 0)}
                                className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:border-brand transition-colors"
                                placeholder="10"
                            />
                            <p className="text-xs text-neutral-500 mt-1">Standard lot: $10/pip, Mini: $1/pip</p>
                        </div>
                    </div>
                </AnimatedCard>

                {/* Results Section */}
                <AnimatedCard delay={0.2}>
                    <div className="flex items-center gap-3 mb-6">
                        <TrendingUp className="text-brand" size={24} />
                        <h3 className="text-xl font-semibold">Calculated Results</h3>
                    </div>

                    <div className="space-y-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.3 }}
                            className="p-6 bg-gradient-to-br from-brand/20 to-brand-orange/10 rounded-xl border border-brand/30"
                        >
                            <div className="text-neutral-400 text-sm mb-2">Position Size</div>
                            <div className="text-4xl font-bold text-brand mb-2">{lotSize} Lots</div>
                            <div className="text-neutral-300 text-sm">
                                = {(parseFloat(lotSize) * 100000).toLocaleString()} units
                            </div>
                        </motion.div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-neutral-800/50 rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                    <DollarSign size={16} className="text-red-500" />
                                    <span className="text-neutral-400 text-sm">Risk Amount</span>
                                </div>
                                <div className="text-2xl font-bold text-red-500">
                                    ${riskAmount.toFixed(2)}
                                </div>
                            </div>

                            <div className="p-4 bg-neutral-800/50 rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                    <AlertCircle size={16} className="text-yellow-500" />
                                    <span className="text-neutral-400 text-sm">Pips at Risk</span>
                                </div>
                                <div className="text-2xl font-bold text-yellow-500">
                                    {pipsAtRisk.toFixed(1)}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-neutral-800/30 rounded-lg border border-neutral-700">
                            <h4 className="font-semibold mb-3">Risk Breakdown</h4>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-neutral-400">Account Balance:</span>
                                    <span className="font-medium">${accountSize.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-neutral-400">Risk Percentage:</span>
                                    <span className="font-medium">{riskPercent}%</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-neutral-400">Risk per Pip:</span>
                                    <span className="font-medium">${(riskAmount / pipsAtRisk).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-neutral-400">Max Loss:</span>
                                    <span className="font-medium text-red-500">${riskAmount.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="text-blue-400 flex-shrink-0 mt-0.5" size={20} />
                                <div className="text-sm text-blue-200">
                                    <p className="font-semibold mb-1">Pro Tip</p>
                                    <p className="text-blue-300">
                                        Never risk more than 1-2% of your account on a single trade.
                                        Use this calculator before opening each position.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <GradientButton className="w-full mt-4">
                            Save to Trade
                        </GradientButton>
                    </div>
                </AnimatedCard>
            </div>

            {/* Quick Reference */}
            <AnimatedCard delay={0.3}>
                <h3 className="text-lg font-semibold mb-4">Quick Reference: Standard Pip Values</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { pair: 'EURUSD', value: '$10' },
                        { pair: 'GBPUSD', value: '$10' },
                        { pair: 'USDJPY', value: '$9.09' },
                        { pair: 'AUDUSD', value: '$10' }
                    ].map((item, i) => (
                        <motion.div
                            key={item.pair}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 + i * 0.1 }}
                            className="p-3 bg-neutral-800/50 rounded-lg text-center"
                        >
                            <div className="text-neutral-400 text-sm">{item.pair}</div>
                            <div className="text-lg font-bold text-brand">{item.value}/pip</div>
                            <div className="text-xs text-neutral-500">1 standard lot</div>
                        </motion.div>
                    ))}
                </div>
            </AnimatedCard>
        </div>
    )
}
