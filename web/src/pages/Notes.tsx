import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { BookOpen, Plus, Edit2, Trash2, Save, X, Calendar } from 'lucide-react'
import AnimatedCard from '../components/AnimatedCard'
import GradientButton from '../components/GradientButton'
import { format } from 'date-fns'

interface JournalEntry {
    id: string
    date: Date
    title: string
    content: string
    mood: string
    tags: string[]
}

export default function Notes() {
    const [entries, setEntries] = useState<JournalEntry[]>([])
    const [isEditing, setIsEditing] = useState(false)
    const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null)
    const [formData, setFormData] = useState({
        title: '',
        content: '',
        mood: '😐',
        tags: ''
    })

    useEffect(() => {
        // Load from localStorage
        const saved = localStorage.getItem('journal_entries')
        if (saved) {
            const parsed = JSON.parse(saved)
            setEntries(parsed.map((e: any) => ({ ...e, date: new Date(e.date) })))
        }
    }, [])

    const saveToStorage = (newEntries: JournalEntry[]) => {
        localStorage.setItem('journal_entries', JSON.stringify(newEntries))
    }

    const handleSave = () => {
        if (!formData.title || !formData.content) return

        const newEntry: JournalEntry = {
            id: editingEntry?.id || Date.now().toString(),
            date: editingEntry?.date || new Date(),
            title: formData.title,
            content: formData.content,
            mood: formData.mood,
            tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean)
        }

        let newEntries: JournalEntry[]
        if (editingEntry) {
            newEntries = entries.map(e => e.id === editingEntry.id ? newEntry : e)
        } else {
            newEntries = [newEntry, ...entries]
        }

        setEntries(newEntries)
        saveToStorage(newEntries)
        handleCancel()
    }

    const handleEdit = (entry: JournalEntry) => {
        setEditingEntry(entry)
        setFormData({
            title: entry.title,
            content: entry.content,
            mood: entry.mood,
            tags: entry.tags.join(', ')
        })
        setIsEditing(true)
    }

    const handleDelete = (id: string) => {
        if (!confirm('Delete this journal entry?')) return
        const newEntries = entries.filter(e => e.id !== id)
        setEntries(newEntries)
        saveToStorage(newEntries)
    }

    const handleCancel = () => {
        setIsEditing(false)
        setEditingEntry(null)
        setFormData({ title: '', content: '', mood: '😐', tags: '' })
    }

    const moods = ['😊', '😐', '😔', '😤', '🤔', '😌', '😰']

    return (
        <div className="space-y-6">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="flex items-center justify-between"
            >
                <div>
                    <h1 className="text-3xl font-bold mb-2">Trading Journal</h1>
                    <p className="text-neutral-400">Document your thoughts, reflections, and lessons learned</p>
                </div>
                {!isEditing && (
                    <GradientButton onClick={() => setIsEditing(true)}>
                        <Plus size={20} className="mr-2" />
                        New Entry
                    </GradientButton>
                )}
            </motion.div>

            {isEditing && (
                <AnimatedCard delay={0.1}>
                    <div className="flex items-center gap-3 mb-6">
                        <Edit2 className="text-brand" size={24} />
                        <h3 className="text-xl font-semibold">
                            {editingEntry ? 'Edit Entry' : 'New Journal Entry'}
                        </h3>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Title</label>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                placeholder="Today's trading session..."
                                className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:border-brand transition-colors"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">How are you feeling?</label>
                            <div className="flex gap-2">
                                {moods.map(mood => (
                                    <motion.button
                                        key={mood}
                                        whileHover={{ scale: 1.2 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => setFormData({ ...formData, mood })}
                                        className={`text-3xl p-2 rounded-lg transition-all ${formData.mood === mood ? 'bg-brand/20 ring-2 ring-brand' : 'bg-neutral-800 hover:bg-neutral-700'
                                            }`}
                                    >
                                        {mood}
                                    </motion.button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Entry</label>
                            <textarea
                                value={formData.content}
                                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                placeholder="Write your thoughts, observations, and reflections here...&#10;&#10;What went well today?&#10;What could be improved?&#10;What did you learn?"
                                rows={12}
                                className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:border-brand transition-colors resize-none font-mono text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Tags (comma-separated)</label>
                            <input
                                type="text"
                                value={formData.tags}
                                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                                placeholder="discipline, patience, overtrading"
                                className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:border-brand transition-colors"
                            />
                        </div>

                        <div className="flex gap-3">
                            <GradientButton onClick={handleSave} className="flex-1">
                                <Save size={20} className="mr-2" />
                                Save Entry
                            </GradientButton>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={handleCancel}
                                className="px-6 py-3 bg-neutral-800 rounded-lg hover:bg-neutral-700 transition-colors flex items-center gap-2"
                            >
                                <X size={20} />
                                Cancel
                            </motion.button>
                        </div>
                    </div>
                </AnimatedCard>
            )}

            <div className="grid grid-cols-1 gap-6">
                {entries.length === 0 ? (
                    <AnimatedCard delay={0.1}>
                        <div className="text-center py-12">
                            <BookOpen size={48} className="mx-auto mb-4 text-neutral-600" />
                            <p className="text-neutral-400 mb-4">No journal entries yet</p>
                            <GradientButton onClick={() => setIsEditing(true)}>
                                Write Your First Entry
                            </GradientButton>
                        </div>
                    </AnimatedCard>
                ) : (
                    entries.map((entry, i) => (
                        <AnimatedCard key={entry.id} delay={0.1 + i * 0.05}>
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-4">
                                    <div className="text-4xl">{entry.mood}</div>
                                    <div>
                                        <h3 className="text-xl font-semibold mb-1">{entry.title}</h3>
                                        <div className="flex items-center gap-2 text-sm text-neutral-400">
                                            <Calendar size={14} />
                                            {format(entry.date, 'MMMM d, yyyy • h:mm a')}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <motion.button
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => handleEdit(entry)}
                                        className="p-2 bg-neutral-800 rounded-lg hover:bg-neutral-700 transition-colors"
                                    >
                                        <Edit2 size={18} className="text-blue-400" />
                                    </motion.button>
                                    <motion.button
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => handleDelete(entry.id)}
                                        className="p-2 bg-neutral-800 rounded-lg hover:bg-neutral-700 transition-colors"
                                    >
                                        <Trash2 size={18} className="text-red-400" />
                                    </motion.button>
                                </div>
                            </div>

                            <div className="prose prose-invert prose-sm max-w-none mb-4">
                                <p className="whitespace-pre-wrap text-neutral-300">{entry.content}</p>
                            </div>

                            {entry.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {entry.tags.map(tag => (
                                        <span
                                            key={tag}
                                            className="px-3 py-1 bg-brand/10 text-brand text-sm rounded-full"
                                        >
                                            #{tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </AnimatedCard>
                    ))
                )}
            </div>
        </div>
    )
}
