import { ReactNode } from 'react'

interface GradientButtonProps {
    children: ReactNode
    onClick?: (e?: any) => void
    className?: string
    variant?: 'primary' | 'secondary'
    type?: 'button' | 'submit' | 'reset'
}

export default function GradientButton({ children, onClick, className = '', variant = 'primary', type = 'button' }: GradientButtonProps) {
    const gradients = {
        primary: 'from-brand-orange via-brand-yellow to-brand-orange',
        secondary: 'from-neutral-700 via-neutral-600 to-neutral-700'
    }

    return (
        <button
            type={type}
            onClick={onClick}
            className={`px-6 py-3 rounded-lg bg-gradient-to-r ${gradients[variant]} text-black font-semibold shadow-lg hover:shadow-brand/50 transition-all duration-300 ${className}`}
        >
            {children}
        </button>
    )
}
