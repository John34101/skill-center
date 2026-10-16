import React, { useEffect, useRef } from 'react'
import ePub from 'epubjs'

function resolveUrl(path) {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  return window.location.origin + (path.startsWith('/') ? '' : '/') + path
}

export default function EpubReader({ book, onSelectText, onError, paintApiRef }) {
  const areaRef = useRef(null)
  const renditionRef = useRef(null)
  const onSelectRef = useRef(onSelectText)
  onSelectRef.current = onSelectText

  useEffect(() => {
    if (!book?.file_path || !areaRef.current) return
    let cancelled = false
    let rendition = null
    const url = resolveUrl(book.file_path)
    try {
      const epubBook = ePub(url)
      rendition = epubBook.renderTo(areaRef.current, {
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
      // Visual underline style for confirmed highlights
      try {
        rendition.themes.default({
          '::selection': { background: 'rgba(212, 165, 116, .35)' },
          '.epub-hl': { 'fill': 'rgba(212, 165, 116, .35)' },
        })
      } catch (e) { /* ignore */ }

      rendition.on('selected', (cfiRange, contents) => {
        const range = contents.getRange(cfiRange)
        const text = (range ? range.toString() : '').trim()
        if (!text || text.length < 2) return
        let rect = null
        try {
          const r = range.getBoundingClientRect()
          const iframe = contents.document?.defaultView?.frameElement
          const ir = iframe ? iframe.getBoundingClientRect() : { top: 0, left: 0 }
          rect = {
            top: r.top + ir.top,
            left: r.left + ir.left,
            bottom: r.bottom + ir.top,
            right: r.right + ir.left,
            width: r.width,
            height: r.height,
          }
        } catch (e) { rect = null }
        onSelectRef.current?.({ quote: text, loc: cfiRange, rect })
      })

      if (paintApiRef) {
        paintApiRef.current = {
          highlight: (cfi) => {
            try { rendition.annotations.highlight(cfi, {}, undefined, 'epub-hl') } catch (e) {}
          },
        }
      }
    } catch (e) {
      if (!cancelled) onError?.('EPUB 解析失败：' + e.message)
    }
    return () => {
      cancelled = true
      if (paintApiRef) paintApiRef.current = null
      try { renditionRef.current && renditionRef.current.destroy() } catch (e) {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recreate only when book changes
  }, [book?.id, book?.file_path])

  return <div className="reader-area paper-sheet" ref={areaRef} />
}
