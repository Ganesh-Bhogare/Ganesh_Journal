import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { motion } from 'framer-motion'

interface WinLossPieProps {
    data: { name: string; value: number }[]
}

const COLOR_BY_LABEL: Record<string, string> = {
    win: '#22c55e',
    wins: '#22c55e',
    profit: '#22c55e',
    loss: '#ef4444',
    losses: '#ef4444',
    breakeven: '#6b7280',
    break_even: '#6b7280',
    breakEven: '#6b7280'
}

function colorForName(name: string) {
    const key = (name || '').toLowerCase().replace(/\s+/g, '')
    return COLOR_BY_LABEL[key] || '#6b7280'
}

const renderLabel = (props: any) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, percent, name } = props
    const radius = innerRadius + (outerRadius - innerRadius) * 0.55
    const rad = (-midAngle * Math.PI) / 180
    const x = cx + radius * Math.cos(rad)
    const y = cy + radius * Math.sin(rad)
    const pct = percent ? (percent * 100).toFixed(0) : '0'
    return (
        <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={12}>
            {`${name}: ${pct}%`}
        </text>
    )
}

export default function WinLossPie({ data }: WinLossPieProps) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="w-full h-full"
        >
            <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 16, right: 24, bottom: 16, left: 24 }}>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={renderLabel}
                        outerRadius={88}
                        fill="#8884d8"
                        dataKey="value"
                    >
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={colorForName(entry.name)} />
                        ))}
                    </Pie>
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#171717',
                            border: '1px solid #404040',
                            borderRadius: '8px',
                            color: '#fff'
                        }}
                    />
                    <Legend />
                </PieChart>
            </ResponsiveContainer>
        </motion.div>
    )
}
