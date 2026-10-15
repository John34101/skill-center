import React, { useEffect, useRef } from 'react'
import ePub from 'epubjs'

function resolveUrl(path) {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  return window.location.origin + (path.startsWith('/') ? '' : '/') + path
}

export default function EpubReader({ book, onSelectText, onError }) {
  const areaRef = useRef(null)
  const renditionRef = useRef(null)

  useEffect(() => {
    if (!book?.file_path || !areaRef.current) return
    let cancelled = false
    const url = resolveUrl(book.file_path)
    try {
      const epubBook = ePub(url)
      const rendition = epubBook.renderTo(areaRef.current, {
        width: '100%', height: '100%', spread: 'none', flow: 'paginated',
      })
      renditionRef.current = rendition
      rendition.display()
      rendition.themes.default({
        body: {
          'font-family': "'Source Han Serif SC','Noto Serif SC','Songti SC',serif",
          'font-size': '1.08em',
          'line-height': '1.85',
          color: '#2c2926',
        },
      })
      rendition.on('selected', (cfiRange, contents) => {
        const range = contents.getRange(cfiRange)
        const text = (range ? range.toString() : '').trim()
        if (!text) return
        onSelectText({ quote: text, loc: cfiRange })
      })
    } catch (e) {
      if (!cancelled) onError?.('EPUB 解析失败：' + e.message)
    }
    return () => {
      cancelled = true
      try { renditionRef.current && renditionRef.current.destroy() } catch (e) {}
    }
  }, [book?.id, book?.file_path])

  return <div className="reader-area paper-sheet" ref={areaRef} />
}
