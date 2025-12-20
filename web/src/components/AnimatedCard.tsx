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
            style={allowHover ? { transformPerspective: 1200 } : undefined}
            className={`group relative overflow-hidden bg-gradient-to-b from-white/90 to-neutral-50/80 dark:from-neutral-900/95 dark:to-neutral-950/85 rounded-xl border border-neutral-200/70 dark:border-neutral-800/80 p-6 shadow-xl shadow-black/10 dark:shadow-black/40 hover:border-neutral-300/80 dark:hover:border-neutral-700/80 transition-colors transform-gpu ${className}`}
        >
            <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-brand-yellow/10 blur-3xl" />
                <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-brand-orange/10 blur-3xl" />
                <div className="absolute inset-0 bg-gradient-to-b from-white/[0.06] via-transparent to-transparent" />
            </div>
            <div className="relative z-10">{children}</div>
        </motion.div>
    )
}
