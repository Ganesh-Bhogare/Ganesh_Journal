import { motion } from 'framer-motion'
import { ReactNode } from 'react'

interface StatCardProps {
    title: string
    value: string | number
    icon?: ReactNode
    trend?: 'up' | 'down' | 'neutral'
    delay?: number
    subtitle?: string
}

export default function StatCard({ title, value, icon, trend, delay = 0, subtitle }: StatCardProps) {
    const trendColors = {
        up: 'text-green-500',
        down: 'text-red-500',
        neutral: 'text-neutral-400'
    }

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8, rotateX: -15 }}
            animate={{ opacity: 1, scale: 1, rotateX: 0 }}
            transition={{ duration: 0.5, delay, type: 'spring' }}
            whileHover={{
                scale: 1.05,
                rotateX: 5,
                y: -10,
                transition: { duration: 0.2 }
            }}
            className="rounded-xl p-6 border shadow-xl transition-shadow cursor-pointer"
            style={{
                transformStyle: 'preserve-3d',
                background: 'linear-gradient(135deg, var(--surface-1) 0%, var(--surface-2) 100%)',
                borderColor: 'var(--border-strong)',
                boxShadow: '0 18px 34px -16px color-mix(in srgb, var(--accent) 28%, black 72%)'
            }}
        >
            <div className="flex items-center justify-between mb-3">
                <span className="text-neutral-400 text-sm font-medium">{title}</span>
                {icon && (
                    <motion.div
                        whileHover={{ rotate: 360 }}
                        transition={{ duration: 0.6 }}
                        className="text-brand"
                    >
                        {icon}
                    </motion.div>
                )}
            </div>
            <motion.div
                className="text-3xl font-bold text-white mb-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: delay + 0.2 }}
            >
                {value}
            </motion.div>
            {subtitle && (
                <div className="text-xs text-neutral-400 mb-2">
                    {subtitle}
                </div>
            )}
            {trend && (
                <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: delay + 0.3 }}
                    className={`text-sm ${trendColors[trend]}`}
                >
                    {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} Trend
                </motion.div>
            )}
        </motion.div>
    )
}
