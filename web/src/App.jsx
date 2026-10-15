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

// 极简 hash 路由
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

  // 会话恢复完成前先占位，避免刷新时闪登录页/误判未登录
  if (!ready) return (
    <div className="boot">
      <div className="boot-in">
        <div className="boot-mark"><i /></div>
        <div className="boot-name">我的书房</div>
        <div className="boot-spin" />
        <div className="boot-tip">正在恢复会话…</div>
      </div>
    </div>
  )

  // 登录/注册页
  if (route === '/login') return <Login />
  if (route === '/register') return <Register />
  if (!user) return <Login />

  // 路由匹配
  const isReader = route.startsWith('/reader/')
  const readerId = isReader ? route.slice('/reader/'.length) : null
  const isPlanDetail = route.startsWith('/plans/')
  const planId = isPlanDetail ? route.slice('/plans/'.length) : null
  const isLegacy = route.startsWith('/legacy')
  const legacyPath = route.replace(/^\/legacy/, '') || '/plans'

  // 阅读器：独立沉浸布局
  if (isReader) return <Reader id={readerId} key={readerId} />

  // 导航：主页是「我的书房」，旧学习中心收进不显眼归档入口
  const nav = [
    ...(isAdmin ? [{ to: '/admin', label: '管理' }] : []),
  ]

  // 归档入口映射：/legacy/xxx → 旧路由 xxx
  if (isLegacy && legacyPath !== '/plans') {
    const p = legacyPath
    let legacyPage = <LegacyLanding />
    if (p === '/today') legacyPage = <Home />
    else if (p === '/market') legacyPage = <Market />
    else if (p === '/plans') legacyPage = <Plans />
    else if (p.startsWith('/plans/')) legacyPage = <PlanDetail id={p.slice('/plans/'.length)} key={p} />
    else if (p === '/writing') legacyPage = <Writing />
    else if (p === '/cases') legacyPage = <Cases />
    else if (p === '/admin') legacyPage = <Admin stats={stats} />
    page = legacyPage
  } else if (isLegacy) {
    page = <LegacyLanding />
  }

  const isArchiveView = route === '/' || isLegacy || route === '/plans' || isPlanDetail
  return (
    <div>
      <div className="topbar">
        <div className="topbar-brand" onClick={() => { window.location.hash = '#/' }}>
          <span className="brand-mark"><i /></span>
          <b>我的书房</b>
        </div>
        <span className="topbar-sub">个人学习</span>
        <nav className="nav">
          {nav.map(n => (
            <a key={n.to} href={'#' + n.to} className={
              (route === n.to) ||
              (n.to === '/' && (route === '/plans' || isPlanDetail)) ? 'on' : ''}>{n.label}</a>
          ))}
        </nav>
        <span className="spacer" />
        <div className="topbar-user">
          <a className="arch-link" href="#/legacy" title="旧版学习中心（归档）">学习中心</a>
          <span className="uname">{user.nickname || user.email}</span>
          {isAdmin && <span className="urole">管理员</span>}
          <button className="btn sub" onClick={logout}>退出</button>
        </div>
      </div>
      <div className="rack">
        <span className="seg"><span className="lbl">账号</span><b>{user.email}</b></span>
        <span className="seg"><span className="lbl">API</span><b className="mono">api.ilovelearning.top</b></span>
        <span className="spacer" />
        <span className="seg"><span className="lbl">版本</span><b>v0.4</b></span>
      </div>
      <div className="main">
        {route !== '/' && <BackBar />}
        {page}
      </div>
    </div>
  )
}

// 归档入口：旧版学习中心（三个学习计划 + 技能管理）统一收在这里
function LegacyLanding() {
  return (
    <div className="legacy card">
      <h2>学习中心（旧版 · 已归档）</h2>
      <p className="muted">以下为早期功能，已归档保留，可按需继续使用。</p>
      <div className="legacy-grid">
        <a className="legacy-item" href="#/legacy/plans">
          <b>学习计划</b><span>PPT 视觉提升 · AI Skill 使用 · 写作系统</span>
        </a>
        <a className="legacy-item" href="#/legacy/market">
          <b>技能市场</b><span>浏览与安装 AI Agent Skill</span>
        </a>
        <a className="legacy-item" href="#/legacy/cases">
          <b>用法案例</b><span>各 Skill 的实际产物案例</span>
        </a>
        <a className="legacy-item" href="#/legacy/writing">
          <b>写作系统</b><span>写作台账与素材</span>
        </a>
      </div>
      <p className="muted small">主页面「我的书房」已上线：书籍/课程自托管 + 划线笔记。旧入口会长期保留，不着急迁移。</p>
    </div>
  )
}

export default function App() {
  return <AuthProvider><Shell /></AuthProvider>
}
