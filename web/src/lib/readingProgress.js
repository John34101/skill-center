/** 课程续读进度：localStorage，按 user + book 分键 */

function storageKey(userId, bookId) {
  return `sc_read_progress:${userId || 'anon'}:${bookId}`
}

export function loadProgress(userId, bookId) {
  if (!bookId) return null
  try {
    const raw = localStorage.getItem(storageKey(userId, bookId))
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || typeof data !== 'object') return null
    return {
      chapterId: data.chapterId != null ? String(data.chapterId) : null,
      scrollTop: typeof data.scrollTop === 'number' ? data.scrollTop : 0,
      updatedAt: data.updatedAt || 0,
    }
  } catch {
    return null
  }
}

export function saveProgress(userId, bookId, patch) {
  if (!bookId) return
  try {
    const prev = loadProgress(userId, bookId) || {}
    const next = {
      chapterId: patch.chapterId != null ? String(patch.chapterId) : prev.chapterId,
      scrollTop: typeof patch.scrollTop === 'number' ? patch.scrollTop : (prev.scrollTop || 0),
      updatedAt: Date.now(),
    }
    localStorage.setItem(storageKey(userId, bookId), JSON.stringify(next))
  } catch {
    /* ignore quota / private mode */
  }
}

/** 字号档位：标准 / 较大 / 加大 */
export const FONT_SIZE_STEPS = [
  { id: 'md', label: '标准', em: '1.08em' },
  { id: 'lg', label: '较大', em: '1.22em' },
  { id: 'xl', label: '加大', em: '1.38em' },
]

const FONT_KEY = 'sc_read_font'

export function loadFontSizeId() {
  try {
    const id = localStorage.getItem(FONT_KEY)
    if (FONT_SIZE_STEPS.some(s => s.id === id)) return id
  } catch { /* ignore */ }
  return 'md'
}

export function saveFontSizeId(id) {
  try { localStorage.setItem(FONT_KEY, id) } catch { /* ignore */ }
}

export function fontSizeEm(id) {
  return (FONT_SIZE_STEPS.find(s => s.id === id) || FONT_SIZE_STEPS[0]).em
}
