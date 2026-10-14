import React from 'react'

// ============================================================
// 站内导航栈：记录每次 hash 跳转，供返回按钮精确回退来源页
// 存在 sessionStorage（同标签页刷新后仍保留）
// ============================================================
export function pushNav(curHash) {
  try {
    const stack = JSON.parse(sessionStorage.getItem('nav-stack') || '[]')
    const last = stack[stack.length - 1]
    if (last !== curHash) {
      stack.push(curHash)
      if (stack.length > 30) stack.shift()
      sessionStorage.setItem('nav-stack', JSON.stringify(stack))
    }
  } catch (e) { /* ignore */ }
}

function prevNav(curHash) {
  try {
    const stack = JSON.parse(sessionStorage.getItem('nav-stack') || '[]')
    const idx = stack.lastIndexOf(curHash)
    // 当前页在栈中：取它前面的一个站内页
    if (idx > 0) {
      const prev = stack[idx - 1]
      // 返回后从栈中移除本次记录，避免重复回退同一页
      sessionStorage.setItem('nav-stack', JSON.stringify(stack.slice(0, idx)))
      return prev
    }
  } catch (e) { /* ignore */ }
  return null
}

// ============================================================
// 返回栏：所有二级页面顶部统一使用
// 点击 → 回站内上一页（导航栈记录）；无来源 → 回首页
// ============================================================
export default function BackBar({ label = '返回', hint = '' }) {
  const go = () => {
    const cur = window.location.hash || '#/'
    const prev = prevNav(cur)
    window.location.hash = prev || '#/'
  }
  return (
    <div className="backbar">
      <button className="backbar-btn" onClick={go} aria-label={label}>
        <span className="backbar-arrow">←</span>
        {label}
      </button>
      {hint && <span className="backbar-hint">{hint}</span>}
    </div>
  )
}
