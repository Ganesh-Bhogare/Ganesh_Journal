import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import AnimatedCard from '../components/AnimatedCard'
import { api } from '../lib/api'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday } from 'date-fns'

interface TradeDay {
    date: Date
    trades: number
    profit: number
    outcome: 'win' | 'loss' | 'neutral'
}

export default function CalendarView() {
    const [currentDate, setCurrentDate] = useState(new Date())
    const [tradeDays, setTradeDays] = useState<TradeDay[]>([])
    const [selectedDay, setSelectedDay] = useState<TradeDay | null>(null)

    useEffect(() => {
        fetchMonthData()
    }, [currentDate])

    const fetchMonthData = async () => {
        try {
            const { data } = await api.get('/trades')
            const trades = data.items || []

            const daysMap = new Map<string, TradeDay>()
            trades.forEach((trade: any) => {
                const tradeDate = new Date(trade.date)
                const dateKey = format(tradeDate, 'yyyy-MM-dd')

                if (!daysMap.has(dateKey)) {
                    daysMap.set(dateKey, {
                        date: tradeDate,
                        trades: 0,
                        profit: 0,
                        outcome: 'neutral'
                    })
                }

                const day = daysMap.get(dateKey)!
                day.trades++
                day.profit += trade.pnl || 0
                day.outcome = day.profit > 0 ? 'win' : day.profit < 0 ? 'loss' : 'neutral'
            })

            setTradeDays(Array.from(daysMap.values()))
        } catch (err) {
            console.error('Failed to fetch calendar data:', err)
        }
    }

    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

    const getDayData = (day: Date) => {
        return tradeDays.find(td => isSameDay(td.date, day))
    }

    const getDayColor = (day: Date) => {
        const data = getDayData(day)
        if (!data) return 'bg-neutral-800'
        if (data.outcome === 'win') return 'bg-green-500/20 border-green-500'
        if (data.outcome === 'loss') return 'bg-red-500/20 border-red-500'
        return 'bg-yellow-500/20 border-yellow-500'
    }

    const previousMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))
    }

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))
    }

    return (
        <div className="space-y-6">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="flex items-center justify-between"
            >
                <div>
                    <h1 className="text-3xl font-bold mb-2">Trading Calendar</h1>
                    <p className="text-neutral-400">Track your daily trading activity</p>
                </div>
                <div className="flex items-center gap-4">
                    <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={previousMonth}
                        className="p-2 bg-neutral-800 rounded-lg hover:bg-neutral-700 transition-colors"
                    >
                        <ChevronLeft size={24} />
                    </motion.button>
                    <div className="text-xl font-semibold min-w-[200px] text-center">
                        {format(currentDate, 'MMMM yyyy')}
                    </div>
                    <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={nextMonth}
                        className="p-2 bg-neutral-800 rounded-lg hover:bg-neutral-700 transition-colors"
                    >
                        <ChevronRight size={24} />
                    </motion.button>
                </div>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <AnimatedCard delay={0.1} className="lg:col-span-2">
                    <div className="grid grid-cols-7 gap-2 mb-4">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                            <div key={day} className="text-center text-sm font-semibold text-neutral-400 py-2">
                                {day}
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 gap-2">
                        {days.map((day, i) => {
                            const dayData = getDayData(day)
                            const isCurrentDay = isToday(day)

                            return (
                                <motion.button
                                    key={day.toISOString()}
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: i * 0.01 }}
                                    whileHover={{ scale: 1.1, y: -4 }}
                                    onClick={() => setSelectedDay(dayData || null)}
                                    className={`
                    aspect-square p-2 rounded-lg border transition-all
                    ${getDayColor(day)}
                    ${isCurrentDay ? 'ring-2 ring-brand' : 'border-transparent'}
                    ${!isSameMonth(day, currentDate) ? 'opacity-30' : ''}
                    hover:border-brand
                  `}
                                >
                                    <div className="text-sm font-medium">{format(day, 'd')}</div>
                                    {dayData && (
                                        <div className="text-xs mt-1">
                                            <div className="font-semibold">{dayData.trades}</div>
                                            <div className={dayData.profit >= 0 ? 'text-green-400' : 'text-red-400'}>
                                                ${dayData.profit.toFixed(0)}
                                            </div>
                                        </div>
                                    )}
                                </motion.button>
                            )
                        })}
                    </div>
                </AnimatedCard>

                <AnimatedCard delay={0.2}>
                    <div className="flex items-center gap-3 mb-6">
                        <CalendarIcon className="text-brand" size={24} />
                        <h3 className="text-xl font-semibold">Day Details</h3>
                    </div>

                    {selectedDay ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="space-y-4"
                        >
                            <div className="text-center p-4 bg-neutral-800/50 rounded-lg">
                                <div className="text-2xl font-bold mb-2">
                                    {format(selectedDay.date, 'MMMM d, yyyy')}
                                </div>
                                <div className={`text-3xl font-bold ${selectedDay.profit >= 0 ? 'text-green-500' : 'text-red-500'
                                    }`}>
                                    ${selectedDay.profit.toFixed(2)}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex justify-between items-center p-3 bg-neutral-800/30 rounded-lg">
                                    <span className="text-neutral-400">Total Trades</span>
                                    <span className="font-bold text-lg">{selectedDay.trades}</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-neutral-800/30 rounded-lg">
                                    <span className="text-neutral-400">Outcome</span>
                                    <span className={`font-bold text-lg ${selectedDay.outcome === 'win' ? 'text-green-500' :
                                            selectedDay.outcome === 'loss' ? 'text-red-500' : 'text-yellow-500'
                                        }`}>
                                        {selectedDay.outcome.toUpperCase()}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-neutral-800/30 rounded-lg">
                                    <span className="text-neutral-400">Avg per Trade</span>
                                    <span className="font-bold text-lg">
                                        ${(selectedDay.profit / selectedDay.trades).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        <div className="text-center text-neutral-500 py-8">
                            <CalendarIcon size={48} className="mx-auto mb-4 opacity-30" />
                            <p>Click on a day to view details</p>
                        </div>
                    )}

                    <div className="mt-6 pt-6 border-t border-neutral-800">
                        <h4 className="text-sm font-semibold mb-3">Legend</h4>
                        <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 bg-green-500/20 border border-green-500 rounded"></div>
                                <span className="text-neutral-400">Profitable Day</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 bg-red-500/20 border border-red-500 rounded"></div>
                                <span className="text-neutral-400">Loss Day</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 bg-yellow-500/20 border border-yellow-500 rounded"></div>
                                <span className="text-neutral-400">Breakeven Day</span>
                            </div>
                        </div>
                    </div>
                </AnimatedCard>
            </div>

            {/* Monthly Summary */}
            <AnimatedCard delay={0.3}>
                <h3 className="text-lg font-semibold mb-4">Monthly Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-neutral-800/50 rounded-lg">
                        <div className="text-neutral-400 text-sm mb-1">Trading Days</div>
                        <div className="text-2xl font-bold">{tradeDays.length}</div>
                    </div>
                    <div className="p-4 bg-neutral-800/50 rounded-lg">
                        <div className="text-neutral-400 text-sm mb-1">Total Trades</div>
                        <div className="text-2xl font-bold">
                            {tradeDays.reduce((sum, day) => sum + day.trades, 0)}
                        </div>
                    </div>
                    <div className="p-4 bg-neutral-800/50 rounded-lg">
                        <div className="text-neutral-400 text-sm mb-1">Profitable Days</div>
                        <div className="text-2xl font-bold text-green-500">
                            {tradeDays.filter(d => d.profit > 0).length}
                        </div>
                    </div>
                    <div className="p-4 bg-neutral-800/50 rounded-lg">
                        <div className="text-neutral-400 text-sm mb-1">Total P&L</div>
                        <div className={`text-2xl font-bold ${tradeDays.reduce((sum, day) => sum + day.profit, 0) >= 0 ? 'text-green-500' : 'text-red-500'
                            }`}>
                            ${tradeDays.reduce((sum, day) => sum + day.profit, 0).toFixed(2)}
                        </div>
                    </div>
                </div>
            </AnimatedCard>
        </div>
    )
}
