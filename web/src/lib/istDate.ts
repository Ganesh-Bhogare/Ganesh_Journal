const IST_OFFSET_MINUTES = 330
const IST_OFFSET_MS = IST_OFFSET_MINUTES * 60 * 1000

function pad2(n: number) {
    return String(n).padStart(2, '0')
}

export function isoToIstInputValue(value?: string | Date | null) {
    if (!value) return ''
    const d = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(d.getTime())) return ''

    const ist = new Date(d.getTime() + IST_OFFSET_MS)
    const yyyy = ist.getUTCFullYear()
    const mm = pad2(ist.getUTCMonth() + 1)
    const dd = pad2(ist.getUTCDate())
    const hh = pad2(ist.getUTCHours())
    const min = pad2(ist.getUTCMinutes())
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`
}

export function nowIstInputValue() {
    return isoToIstInputValue(new Date())
}

export function istInputToIso(value?: string | null) {
    const s = String(value || '').trim()
    if (!s) return undefined

    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)
    if (!m) return undefined

    const year = Number(m[1])
    const month = Number(m[2])
    const day = Number(m[3])
    const hour = Number(m[4])
    const minute = Number(m[5])

    const utcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0) - IST_OFFSET_MS
    return new Date(utcMs).toISOString()
}

export function formatIstDateTime(value?: string | Date | null) {
    if (!value) return '-'
    const d = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(d.getTime())) return '-'

    return new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(d)
}

export function formatIstDate(value?: string | Date | null) {
    if (!value) return '-'
    const d = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(d.getTime())) return '-'

    return new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(d)
}