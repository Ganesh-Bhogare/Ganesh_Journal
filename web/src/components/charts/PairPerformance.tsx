import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { motion } from 'framer-motion'

interface PairPerformanceProps {
    data: { pair: string; profit: number; loss: number; net?: number }[]
}

function formatMoney(value: number) {
    const v = Number.isFinite(value) ? value : 0
    const sign = v < 0 ? '-' : ''
    return `${sign}$${Math.abs(v).toFixed(2)}`
}

export default function PairPerformance({ data }: PairPerformanceProps) {
    const chartData = data.map((d) => ({
        ...d,
        lossChart: -Math.abs(Number.isFinite(d.loss) ? d.loss : 0)
    }))

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="w-full h-full"
        >
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
                    <XAxis dataKey="pair" stroke="#888" tick={{ fill: '#888' }} />
                    <YAxis
                        stroke="#888"
                        tick={{ fill: '#888' }}
                        tickFormatter={(v) => formatMoney(Number(v))}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#171717',
                            border: '1px solid #404040',
                            borderRadius: '8px',
                            color: '#fff'
                        }}
                        formatter={(value: any, name: any) => {
                            const key = String(name)
                            const num = typeof value === 'number' ? value : Number(value)
                            if (key === 'profit') return [formatMoney(num), 'Profit']
                            if (key === 'lossChart') return [formatMoney(Math.abs(num)), 'Loss']
                            return [formatMoney(num), key]
                        }}
                    />
                    <Bar
                        dataKey="profit"
                        fill="#22c55e"
                        radius={[8, 8, 0, 0]}
                    />
                    <Bar
                        dataKey="lossChart"
                        fill="#ef4444"
                        radius={[0, 0, 8, 8]}
                    />
                </BarChart>
            </ResponsiveContainer>
        </motion.div>
    )
}
