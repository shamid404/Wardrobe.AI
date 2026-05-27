import { useLocation, useNavigate } from 'react-router-dom'

const TABS = [
  { path: '/wardrobe', label: 'Гардероб', icon: '👗' },
  { path: '/outfits',  label: 'Образы',   icon: '✨' },
  { path: '/assistant',label: 'ИИ',       icon: '🤖' },
]

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: 'var(--nav-height)',
      background: 'var(--bg)',
      borderTop: '1px solid var(--bg2)',
      display: 'flex',
      zIndex: 50,
    }}>
      {TABS.map((tab) => {
        const active = location.pathname === tab.path
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              color: active ? 'var(--btn)' : 'var(--hint)',
              transition: 'color 0.15s',
            }}
          >
            <span style={{ fontSize: 22 }}>{tab.icon}</span>
            <span style={{ fontSize: 11, fontWeight: active ? 600 : 400 }}>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
