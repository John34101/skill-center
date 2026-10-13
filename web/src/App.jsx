import React, { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './store.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Home from './pages/Home.jsx'
import Market from './pages/Market.jsx'
import Cases from './pages/Cases.jsx'
import Admin from './pages/Admin.jsx'
import { api } from './api'

// 极简 hash 路由
function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash || '#/')
  useEffect(() => {
    const fn = () => setHash(window.location.hash || '#/')
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
  if (!ready) return <div className="boot">正在恢复会话…</div>

  // 登录/注册页
  if (route === '/login') return <Login />
  if (route === '/register') return <Register />
  if (!user) return <Login />

  const nav = [
    { to: '/', label: '今日推荐' },
    { to: '/market', label: '工具箱' },
    { to: '/cases', label: '用法案例' },
    ...(isAdmin ? [{ to: '/admin', label: '管理' }] : []),
  ]

  let page = <Home />
  if (route === '/market') page = <Market />
  else if (route === '/cases') page = <Cases />
  else if (route === '/admin') page = <Admin stats={stats} />

  const myCounts = {
    inst: 0, missing: 0, recover: 0, unload: 0,
  }

  return (
    <div>
      <div className="topbar">
        <div className="topbar-brand" onClick={() => { window.location.hash = '#/' }}>
          <span className="brand-mark"><i /></span>
          <b>Skill 中心</b>
        </div>
        <span className="topbar-sub">产品版</span>
        <nav className="nav">
          {nav.map(n => (
            <a key={n.to} href={'#' + n.to} className={route === n.to ? 'on' : ''}>{n.label}</a>
          ))}
        </nav>
        <span className="spacer" />
        <div className="topbar-user">
          <span className="uname">{user.nickname || user.email}</span>
          {isAdmin && <span className="urole">管理员</span>}
          <button className="btn sub" onClick={logout}>退出</button>
        </div>
      </div>
      <div className="rack">
        <span className="seg"><span className="lbl">账号</span><b>{user.email}</b></span>
        <span className="seg"><span className="lbl">API</span><b className="mono">api.ilovelearning.top</b></span>
        <span className="spacer" />
        <span className="seg"><span className="lbl">版本</span><b>v0.3</b></span>
      </div>
      <div className="main">{page}</div>
    </div>
  )
}

export default function App() {
  return <AuthProvider><Shell /></AuthProvider>
}
