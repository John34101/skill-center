import React, { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './store.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Home from './pages/Home.jsx'
import Market from './pages/Market.jsx'
import Cases from './pages/Cases.jsx'
import Admin from './pages/Admin.jsx'
import Plans from './pages/Plans.jsx'
import PlanDetail from './pages/PlanDetail.jsx'
import Writing from './pages/Writing.jsx'
import Library from './pages/Library.jsx'
import Reader from './pages/Reader.jsx'
import BackBar, { pushNav } from './components/BackBar.jsx'
import { api } from './api'

function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash || '#/')
  useEffect(() => {
    const fn = () => {
      const h = window.location.hash || '#/'
      setHash(h)
      pushNav(h)
    }
    window.addEventListener('hashchange', fn)
    return () => window.removeEventListener('hashchange', fn)
  }, [])
  return hash.replace(/^#/, '') || '/'
}

function Shell() {
  const { user, ready, logout } = useAuth()
  const route = useHashRoute()
  const isAdmin = user && user.role === 'admin'
  const [stats, setStats] = useState(null)

  useEffect(() => {
    if (isAdmin && route === '/admin') {
      api.adminStats().then(d => { if (d.ok) setStats(d.stats) })
    }
  }, [route, isAdmin])

  if (!ready) {
    return (
      <div className="boot">
        <div className="boot-in">
          <div className="boot-mark"><i /></div>
          <div className="boot-name">我的书房</div>
          <div className="boot-spin" />
          <div className="boot-tip">正在打开书架…</div>
        </div>
      </div>
    )
  }

  if (route === '/login') return <Login />
  if (route === '/register') return <Register />
  if (!user) return <Login />

  const isReader = route.startsWith('/reader/')
  const readerId = isReader ? route.slice('/reader/'.length) : null
  const isPlanDetail = route.startsWith('/plans/')
  const planId = isPlanDetail ? route.slice('/plans/'.length) : null
  const isLegacy = route.startsWith('/legacy')
  const legacyPath = route.replace(/^\/legacy/, '') || '/plans'

  if (isReader) return <Reader id={readerId} key={readerId} />

  let page
  if (route === '/' || route === '/library') {
    page = <Library />
  } else if (route === '/admin' && isAdmin) {
    page = <Admin stats={stats} />
  } else if (isLegacy) {
    const p = legacyPath
    if (p === '/plans' || p === '' || p === '/') page = <LegacyLanding />
    else if (p === '/today') page = <Home />
    else if (p === '/market') page = <Market />
    else if (p.startsWith('/plans/')) page = <PlanDetail id={p.slice('/plans/'.length)} key={p} />
    else if (p === '/writing') page = <Writing />
    else if (p === '/cases') page = <Cases />
    else if (p === '/admin') page = <Admin stats={stats} />
    else page = <LegacyLanding />
  } else if (route === '/today' || route === '/market' || route === '/plans' || route === '/writing' || route === '/cases') {
    // 旧直达路由：导入归档壳
    window.location.hash = '#/legacy' + route
    page = <LegacyLanding />
  } else {
    page = <Library />
  }

  return (
    <div className="app-shell">
      <header className="topbar paper-top">
        <div className="topbar-brand" onClick={() => { window.location.hash = '#/' }}>
          <span className="brand-mark"><i /></span>
          <b>我的书房</b>
        </div>
        <span className="topbar-sub">个人阅读 · 划线沉淀</span>
        <span className="spacer" />
        <div className="topbar-user">
          {isAdmin && <a className="arch-link" href="#/admin">管理</a>}
          <a className="arch-link quiet" href="#/legacy" title="旧版 Skill 学习中心">学习中心</a>
          <span className="uname">{user.nickname || user.email}</span>
          <button type="button" className="btn sub" onClick={logout}>退出</button>
        </div>
      </header>
      <main className="main paper-main">
        {route !== '/' && route !== '/library' && <BackBar />}
        {page}
      </main>
    </div>
  )
}

function LegacyLanding() {
  return (
    <div className="legacy card paper-card">
      <h2>学习中心（旧版归档）</h2>
      <p className="muted">以下为早期 Skill 管理功能，已归档保留。主产品请使用「我的书房」。</p>
      <div className="legacy-grid">
        <a className="legacy-item" href="#/legacy/plans">
          <b>学习计划</b><span>PPT · AI Skill · 写作</span>
        </a>
        <a className="legacy-item" href="#/legacy/market">
          <b>技能市场</b><span>浏览与安装 Agent Skill</span>
        </a>
        <a className="legacy-item" href="#/legacy/cases">
          <b>用法案例</b><span>各 Skill 的实际产物</span>
        </a>
        <a className="legacy-item" href="#/legacy/writing">
          <b>写作系统</b><span>写作台账与素材</span>
        </a>
        <a className="legacy-item" href="#/legacy/today">
          <b>今日推荐</b><span>每日双档 Skill 推荐</span>
        </a>
      </div>
      <p className="muted small" style={{ marginTop: 16 }}>
        <a href="#/">← 回到我的书房</a>
      </p>
    </div>
  )
}

export default function App() {
  return <AuthProvider><Shell /></AuthProvider>
}
