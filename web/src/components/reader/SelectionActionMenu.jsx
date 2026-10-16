import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'

/**
 * Lightweight selection menu: 「划线」|「批注」
 * Positioned near the selection; no modal mask so reading stays unblocked.
 */
export default function SelectionActionMenu({ menu, onHighlight, onAnnotate, onDismiss }) {
  const ref = useRef(null)
  const [pos, setPos] = useState({ top: 0, left: 0, ready: false })

  useLayoutEffect(() => {
    if (!menu?.rect) {
      setPos(p => ({ ...p, ready: false }))
      return
    }
    const pad = 8
    const el = ref.current
    const mw = el ? el.offsetWidth : 120
    const mh = el ? el.offsetHeight : 36
    const vw = window.innerWidth
    const vh = window.innerHeight
    const r = menu.rect
    // Prefer above selection; flip below if not enough room
    let top = r.top - mh - pad
    if (top < pad) top = r.bottom + pad
    if (top + mh > vh - pad) top = Math.max(pad, vh - mh - pad)
    let left = r.left + (r.width || 0) / 2 - mw / 2
    left = Math.min(Math.max(pad, left), vw - mw - pad)
    setPos({ top, left, ready: true })
  }, [menu])

  // Esc / click outside → dismiss (no highlight created).
  // Do not watch selectionchange: EPUB selection lives in an iframe and would false-dismiss.
  useEffect(() => {
    if (!menu) return
    const onKey = (e) => {
      if (e.key === 'Escape') onDismiss?.()
    }
    const onPointerDown = (e) => {
      if (ref.current && ref.current.contains(e.target)) return
      onDismiss?.()
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [menu, onDismiss])

  if (!menu) return null

  return (
    <div
      ref={ref}
      className="sel-action-menu"
      role="toolbar"
      aria-label="划线操作"
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        visibility: pos.ready ? 'visible' : 'hidden',
        zIndex: 180,
      }}
      // Keep selection alive when pressing the buttons
      onMouseDown={(e) => e.preventDefault()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button type="button" className="sel-action-btn" onClick={onHighlight}>
        划线
      </button>
      <span className="sel-action-sep" aria-hidden />
      <button type="button" className="sel-action-btn" onClick={onAnnotate}>
        批注
      </button>
    </div>
  )
}

/** Wrap current window selection in <mark class="reader-hl"> when possible (course MD). */
export function wrapCurrentSelectionMark() {
  try {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !sel.rangeCount) return false
    const range = sel.getRangeAt(0)
    const mark = document.createElement('mark')
    mark.className = 'reader-hl'
    range.surroundContents(mark)
    sel.removeAllRanges()
    return true
  } catch (e) {
    try { window.getSelection()?.removeAllRanges() } catch (err) {}
    return false
  }
}
