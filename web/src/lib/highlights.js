import { fmtDate } from '../api'

export const HL_TAGS = ['金句', '方法', '案例', '待复习', '想输出']

export function isCourseBook(book) {
  if (!book) return false
  if (book.category === '课程') return true
  const p = String(book.file_path || '')
  return p.includes('/courses/') || /meta\.json$/i.test(p)
}

export function chapterIdFromLoc(loc) {
  const m = String(loc || '').match(/^chapter:([^:]+)/)
  return m ? m[1] : null
}

export function buildHighlightsMarkdown(book, highlights, courseMeta) {
  const lines = [
    `# 《${book.title}》划线笔记`,
    `作者：${book.author || '佚名'}｜导出时间：${new Date().toLocaleDateString('zh-CN')}`,
    '',
  ]
  const ordered = (highlights || []).slice().reverse()

  const appendHl = (h) => {
    lines.push(`> ${String(h.quote || '').replace(/\n/g, '\n> ')}`)
    const tags = (h.tag || []).map(t => '#' + t).join(' ')
    if (h.note) lines.push(`\n📝 ${h.note}${tags ? '  ' + tags : ''}`)
    else if (tags) lines.push(`\n${tags}`)
    lines.push(`\n---\n`)
  }

  const chapterTitle = (cid) => {
    if (!cid || !courseMeta) return cid
    const ch = (courseMeta.chapters || []).find(c => c.id === cid)
    return ch ? ch.title : cid
  }

  if (isCourseBook(book) && courseMeta) {
    const groups = new Map()
    const noChapter = []
    ordered.forEach(h => {
      const cid = chapterIdFromLoc(h.loc)
      if (!cid) { noChapter.push(h); return }
      if (!groups.has(cid)) groups.set(cid, [])
      groups.get(cid).push(h)
    })
    const chapterOrder = (courseMeta.chapters || []).map(c => c.id)
    chapterOrder.forEach(cid => {
      const list = groups.get(cid)
      if (!list || !list.length) return
      lines.push(`## ${chapterTitle(cid)}`, '')
      list.forEach(appendHl)
    })
    ;[...groups.keys()].filter(cid => !chapterOrder.includes(cid)).forEach(cid => {
      lines.push(`## ${chapterTitle(cid)}`, '')
      groups.get(cid).forEach(appendHl)
    })
    if (noChapter.length) {
      lines.push('## 其他划线', '')
      noChapter.forEach(appendHl)
    }
  } else {
    ordered.forEach(appendHl)
  }
  return lines.join('\n')
}

export function downloadMarkdown(filename, content) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || '划线笔记.md'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function safeFilename(title) {
  return String(title || '划线笔记').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80)
}
