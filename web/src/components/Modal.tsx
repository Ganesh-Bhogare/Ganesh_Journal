import { motion } from 'framer-motion'
import { ReactNode } from 'react'

interface ModalProps {
    isOpen: boolean
    onClose: () => void
    children: ReactNode
    title?: string
}

export default function Modal({ isOpen, onClose, children, title }: ModalProps) {
    if (!isOpen) return null

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 dark:bg-black/80 backdrop-blur-sm"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, rotateX: -15, opacity: 0 }}
                animate={{ scale: 1, rotateX: 0, opacity: 1 }}
                exit={{ scale: 0.9, rotateX: 15, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6 max-w-2xl w-full shadow-2xl"
                style={{ transformStyle: 'preserve-3d' }}
                onClick={(e) => e.stopPropagation()}
            >
                {title && (
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-2xl font-bold">{title}</h2>
                        <motion.button
                            whileHover={{ scale: 1.1, rotate: 90 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={onClose}
                            className="text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
                        >
                            ✕
                        </motion.button>
                    </div>
                )}
                {children}
            </motion.div>
        </motion.div>
    )
}
