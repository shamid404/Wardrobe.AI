import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import WebApp from '@twa-dev/sdk'
import { authTelegram, setToken, getToken } from './api/client'
import BottomNav from './components/BottomNav'
import WardrobePage from './pages/WardrobePage'
import OutfitsPage from './pages/OutfitsPage'
import AssistantPage from './pages/AssistantPage'

export default function App() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    WebApp.ready()
    WebApp.expand()

    if (getToken()) {
      setReady(true)
      return
    }

    const initData = WebApp.initData
    if (!initData) {
      // Dev mode: no Telegram context
      setError('Открой приложение через Telegram')
      return
    }

    authTelegram(initData)
      .then((res) => {
        setToken(res.access_token)
        setReady(true)
      })
      .catch((e) => setError(e.message ?? 'Ошибка авторизации'))
  }, [])

  if (error) {
    return (
      <div className="empty-state" style={{ height: '100vh' }}>
        <div className="icon">✈️</div>
        <p style={{ fontWeight: 600, color: 'var(--text)' }}>{error}</p>
        <p style={{ fontSize: 13 }}>Запусти бота и нажми кнопку «Открыть»</p>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="empty-state" style={{ height: '100vh' }}>
        <div className="spinner" />
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/wardrobe" replace />} />
        <Route path="/wardrobe" element={<WardrobePage />} />
        <Route path="/outfits" element={<OutfitsPage />} />
        <Route path="/assistant" element={<AssistantPage />} />
      </Routes>
      <BottomNav />
    </BrowserRouter>
  )
}
