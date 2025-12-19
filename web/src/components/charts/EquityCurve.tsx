import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { motion } from 'framer-motion'

interface EquityCurveProps {
    data: { date: string; equity: number }[]
}

export default function EquityCurve({ data }: EquityCurveProps) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="w-full h-full"
        >
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
                    <XAxis
                        dataKey="date"
                        stroke="#888"
                        tick={{ fill: '#888' }}
                        tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    />
                    <YAxis stroke="#888" tick={{ fill: '#888' }} />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#171717',
                            border: '1px solid #404040',
                            borderRadius: '8px',
                            color: '#fff'
                        }}
                        formatter={(value: any) => [`$${typeof value === 'number' ? value.toFixed(2) : '0.00'}`, 'Equity']}
                        labelFormatter={(label) => new Date(label).toLocaleDateString()}
                    />
                    <Line
                        type="monotone"
                        dataKey="equity"
                        stroke="#f59e0b"
                        strokeWidth={3}
                        dot={{ fill: '#f59e0b', r: 4 }}
                        activeDot={{ r: 6 }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </motion.div>
    )
}
