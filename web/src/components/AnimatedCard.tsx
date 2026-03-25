import { motion, useReducedMotion } from 'framer-motion'
import { ReactNode } from 'react'

interface AnimatedCardProps {
    children: ReactNode
    delay?: number
    className?: string
    disableHover?: boolean
}

export default function AnimatedCard({ children, delay = 0, className = '', disableHover }: AnimatedCardProps) {
    const shouldReduceMotion = useReducedMotion()
    const allowHover = !shouldReduceMotion && !disableHover

    return (
        <motion.div
            initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={shouldReduceMotion ? { duration: 0.01 } : { duration: 0.45, delay, type: 'tween', ease: 'easeOut' }}
            whileHover={
                allowHover
                    ? {
                        y: -2,
                        scale: 1.01,
                        rotateX: 2,
                        rotateY: -2,
                    }
                    : undefined
            }
            whileTap={allowHover ? { scale: 0.995 } : undefined}
            style={allowHover ? {
                transformPerspective: 1200,
                background: 'linear-gradient(180deg, var(--surface-1) 0%, var(--surface-2) 100%)',
                borderColor: 'var(--border-strong)'
            } : {
                background: 'linear-gradient(180deg, var(--surface-1) 0%, var(--surface-2) 100%)',
                borderColor: 'var(--border-strong)'
            }}
            className={`group relative overflow-hidden rounded-xl border p-6 shadow-xl transition-colors transform-gpu ${className}`}
        >
            <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-brand-yellow/12 blur-3xl" />
                <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-brand-orange/12 blur-3xl" />
                <div className="absolute inset-0 bg-gradient-to-b from-blue-200/[0.04] via-transparent to-transparent" />
            </div>
            <div className="relative z-10">{children}</div>
        </motion.div>
    )
}
