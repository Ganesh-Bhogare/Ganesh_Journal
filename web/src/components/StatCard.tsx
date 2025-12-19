import { motion } from 'framer-motion'
import { ReactNode } from 'react'

interface StatCardProps {
    title: string
    value: string | number
    icon?: ReactNode
    trend?: 'up' | 'down' | 'neutral'
    delay?: number
}

export default function StatCard({ title, value, icon, trend, delay = 0 }: StatCardProps) {
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
            className="bg-gradient-to-br from-white/90 to-neutral-100/80 dark:from-neutral-900 dark:to-neutral-800 rounded-xl p-6 border border-neutral-200 dark:border-neutral-700 shadow-xl shadow-black/10 dark:shadow-black/40 hover:shadow-brand/20 transition-shadow cursor-pointer"
            style={{ transformStyle: 'preserve-3d' }}
        >
            <div className="flex items-center justify-between mb-3">
                <span className="text-neutral-500 dark:text-neutral-400 text-sm font-medium">{title}</span>
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
                className="text-3xl font-bold text-neutral-900 dark:text-white mb-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: delay + 0.2 }}
            >
                {value}
            </motion.div>
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
