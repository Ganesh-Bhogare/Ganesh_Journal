import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from './contexts/AuthContext'
import Sidebar from './components/Sidebar'
import PageTransition from './components/PageTransition'
import ProtectedRoute from './components/ProtectedRoute'
import { Menu } from 'lucide-react'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Analytics from './pages/Analytics'
import Trades from './pages/Trades'
import Notes from './pages/Notes'
import Settings from './pages/Settings'
import RiskCalculator from './pages/RiskCalculator'
import CalendarView from './pages/CalendarView'
import AITradeAnalysis from './pages/AITradeAnalysis'
import TradeChart from './pages/TradeChart'
import News from './pages/News'

export default function App() {
    const { user } = useAuth()
    const location = useLocation()
    const [sidebarOpen, setSidebarOpen] = useState(false)

    useEffect(() => {
        // Close the mobile drawer when navigating
        setSidebarOpen(false)
    }, [location.pathname])

    return (
        <Routes>
            <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
            <Route path="/register" element={!user ? <Register /> : <Navigate to="/" />} />

            <Route path="/*" element={
                <ProtectedRoute>
                    <div className="h-dvh relative bg-gradient-to-b from-white via-white to-neutral-100 dark:from-black dark:via-black dark:to-neutral-950 text-neutral-900 dark:text-white overflow-hidden">
                        <div className="pointer-events-none absolute inset-0">
                            <div className="absolute -top-40 left-1/4 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-brand-yellow/10 blur-3xl" />
                            <div className="absolute -top-56 right-0 h-[34rem] w-[34rem] rounded-full bg-brand-orange/10 blur-3xl" />
                            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.10] dark:from-white/[0.04] via-transparent to-transparent" />
                        </div>
                        <div className="flex h-dvh">
                            <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
                            <main className="flex-1 min-w-0 h-dvh overflow-y-auto overflow-x-hidden">
                                {/* Mobile header */}
                                <div className="md:hidden sticky top-0 z-30 border-b border-neutral-200/70 dark:border-neutral-800/70 bg-white/70 dark:bg-black/40 supports-[backdrop-filter]:backdrop-blur">
                                    <div className="h-14 px-4 flex items-center justify-between">
                                        <button
                                            type="button"
                                            onClick={() => setSidebarOpen(true)}
                                            className="inline-flex items-center justify-center h-10 w-10 rounded-lg border border-neutral-200/70 dark:border-neutral-800/70 bg-white/60 dark:bg-neutral-900/40"
                                            aria-label="Open menu"
                                        >
                                            <Menu size={18} />
                                        </button>
                                        <div className="font-semibold bg-gradient-to-r from-brand-yellow to-brand-orange bg-clip-text text-transparent">
                                            Ganesh Journal
                                        </div>
                                        <div className="w-10" />
                                    </div>
                                </div>

                                <div className="p-4 md:p-6 lg:p-8">
                                    <PageTransition>
                                        <Routes>
                                            <Route path="/" element={<Dashboard />} />
                                            <Route path="/analytics" element={<Analytics />} />
                                            <Route path="/ai-analysis" element={<AITradeAnalysis />} />
                                            <Route path="/trade-chart" element={<TradeChart />} />
                                            <Route path="/trades" element={<Trades />} />
                                            <Route path="/notes" element={<Notes />} />
                                            <Route path="/risk-calculator" element={<RiskCalculator />} />
                                            <Route path="/calendar" element={<CalendarView />} />
                                            <Route path="/news" element={<News />} />
                                            <Route path="/settings" element={<Settings />} />
                                        </Routes>
                                    </PageTransition>
                                </div>
                            </main>
                        </div>
                    </div>
                </ProtectedRoute>
            } />
        </Routes>
    )
}
