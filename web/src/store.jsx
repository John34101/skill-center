import React, { createContext, useContext, useEffect, useState } from 'react'
import { api, setToken, clearToken, getToken } from './api'

const AuthCtx = createContext(null)
export function useAuth() { return useContext(AuthCtx) }

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)
  /** 启动时与 /auth/me 并行预取的书架，避免 ready 后再串行等 /books */
  const [prefetchBooks, setPrefetchBooks] = useState(null)

  useEffect(() => {
    (async () => {
      if (!getToken() && !localStorage.getItem('sc_token')) {
        setReady(true)
        return
      }
      const [me, books] = await Promise.all([api.me(), api.books()])
      if (me.ok && me.user) setUser(me.user)
      else if (me.status === 401) clearToken()
      if (books.ok) setPrefetchBooks(books.books || [])
      setReady(true)
    })()
  }, [])

  const login = async (email, password) => {
    const d = await api.login(email, password)
    if (d.ok) {
      setToken(d.token)
      setUser(d.user)
      // 登录后立刻拉书架，进首页可秒开
      api.books().then(b => { if (b.ok) setPrefetchBooks(b.books || []) })
    }
    return d
  }
  const register = async (email, password, invite_code) => {
    const d = await api.register(email, password, invite_code)
    if (d.ok) {
      setToken(d.token)
      setUser(d.user)
      setPrefetchBooks([])
    }
    return d
  }
  const logout = () => { clearToken(); setUser(null); setPrefetchBooks(null) }
  const refresh = async () => { const d = await api.me(); if (d.ok && d.user) setUser(d.user) }
  const consumePrefetchBooks = () => {
    const v = prefetchBooks
    setPrefetchBooks(null)
    return v
  }

  return (
    <AuthCtx.Provider value={{
      user, ready, login, register, logout, refresh,
      prefetchBooks, consumePrefetchBooks, setPrefetchBooks,
    }}>
      {children}
    </AuthCtx.Provider>
  )
}
