import { NavLink } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { LogOut, LayoutDashboard, BarChart3, TrendingUp, FileText, Settings, Calculator, Calendar, Sparkles, Newspaper, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

type SidebarProps = {
    mobileOpen?: boolean
    onClose?: () => void
}

export default function Sidebar({ mobileOpen = false, onClose }: SidebarProps) {
    const { user, logout } = useAuth()
    const shouldReduceMotion = useReducedMotion()
    const linkClass = ({ isActive }: { isActive: boolean }) =>
        `sidebar-link ${isActive ? 'bg-neutral-200/80 dark:bg-neutral-800 text-brand' : ''}`

    const navItems = [
        { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
        { to: '/analytics', label: 'Analytics', icon: BarChart3 },
        { to: '/ai-analysis', label: 'AI Trade Analysis', icon: Sparkles },
        { to: '/trades', label: 'Trades', icon: TrendingUp },
        { to: '/calendar', label: 'Calendar', icon: Calendar },
        { to: '/news', label: 'News', icon: Newspaper },
        { to: '/risk-calculator', label: 'Risk Calculator', icon: Calculator },
        { to: '/notes', label: 'Notes', icon: FileText },
        { to: '/settings', label: 'Settings', icon: Settings }
    ]

    return (
        <>
            {/* Mobile overlay */}
            <div
                className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] md:hidden ${mobileOpen ? '' : 'hidden'}`}
                onClick={onClose}
            />

            <aside
                className={`w-64 shrink-0 bg-gradient-to-b from-white/80 to-neutral-100/70 dark:from-neutral-950/80 dark:to-neutral-900/50 supports-[backdrop-filter]:backdrop-blur h-dvh p-4 border-r border-neutral-200/70 dark:border-neutral-800/80 flex flex-col shadow-xl shadow-black/10 dark:shadow-black/40
                fixed md:static inset-y-0 left-0 z-50 transform-gpu transition-transform duration-200
                ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
                aria-hidden={!mobileOpen ? undefined : undefined}
            >
                <motion.div
                    className="font-bold text-xl mb-6 bg-gradient-to-r from-brand-yellow to-brand-orange bg-clip-text text-transparent flex items-center justify-between"
                    initial={shouldReduceMotion ? false : { opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <span>Ganesh Journal</span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="md:hidden text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors"
                        aria-label="Close menu"
                    >
                        <X size={18} />
                    </button>
                </motion.div>

                <nav className="space-y-1 flex-1 overflow-y-auto pr-1">
                    {navItems.map((item, i) => (
                        <motion.div
                            key={item.to}
                            initial={shouldReduceMotion ? false : { opacity: 0, x: -12 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: shouldReduceMotion ? 0 : i * 0.06, duration: shouldReduceMotion ? 0.01 : 0.2 }}
                            whileHover={shouldReduceMotion ? undefined : { x: 2, scale: 1.01 }}
                        >
                            <NavLink
                                to={item.to}
                                className={linkClass}
                                end={item.end}
                                onClick={() => onClose?.()}
                            >
                                <item.icon size={18} />
                                {item.label}
                            </NavLink>
                        </motion.div>
                    ))}
                </nav>

                <div className="pt-4 border-t border-neutral-800">
                    <div className="text-sm text-neutral-500 dark:text-neutral-400 mb-3 px-3">
                        {user?.email}
                    </div>
                    <motion.button
                        whileHover={{ scale: 1.02, x: 4 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={logout}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-neutral-200/70 dark:hover:bg-neutral-800 transition-all text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300"
                    >
                        <LogOut size={18} />
                        Logout
                    </motion.button>
                </div>
            </aside>
        </>
    )
}
