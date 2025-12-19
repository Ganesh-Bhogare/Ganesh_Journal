import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

interface PageTransitionProps {
    children: ReactNode
}

export default function PageTransition({ children }: PageTransitionProps) {
    const location = useLocation()
    const shouldReduceMotion = useReducedMotion()

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={location.pathname}
                initial={{ opacity: 0, x: shouldReduceMotion ? 0 : -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: shouldReduceMotion ? 0 : 12 }}
                transition={{ duration: shouldReduceMotion ? 0.01 : 0.25, ease: 'easeOut' }}
            >
                {children}
            </motion.div>
        </AnimatePresence>
    )
}
