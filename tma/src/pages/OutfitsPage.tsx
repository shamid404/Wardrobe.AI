import { useEffect, useState } from 'react'
import { getOutfits, createOutfit, deleteOutfit, getWardrobe } from '../api/client'
import type { Outfit, WardrobeItem } from '../types'

const BACKEND = import.meta.env.VITE_API_URL?.replace('/api', '') ?? 'http://localhost:8000'

function thumb(url?: string) {
  if (!url) return null
  return url.startsWith('http') ? url : `${BACKEND}${url}`
}

export default function OutfitsPage() {
  const [outfits, setOutfits] = useState<Outfit[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  const load = () => getOutfits().then(setOutfits).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Удалить образ «${name}»?`)) return
    await deleteOutfit(id)
    load()
  }

  return (
    <div className="page">
      <div style={{ padding: '16px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 20, fontWeight: 700 }}>Образы</span>
        <span style={{ color: 'var(--hint)', fontSize: 13 }}>{outfits.length} образов</span>
      </div>

      <div className="page-content">
        {loading ? (
          <div className="empty-state"><div className="spinner" /></div>
        ) : outfits.length === 0 ? (
          <div className="empty-state">
            <div className="icon">✨</div>
            <p>Создай свой первый образ</p>
            <p style={{ fontSize: 13 }}>Собери вещи из гардероба в комплект</p>
          </div>
        ) : (
          <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {outfits.map((outfit) => (
              <OutfitCard key={outfit.id} outfit={outfit} onDelete={() => handleDelete(outfit.id, outfit.name)} />
            ))}
          </div>
        )}
      </div>

      <button className="fab" onClick={() => setShowCreate(true)}>+</button>

      {showCreate && (
        <CreateOutfitSheet
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); load() }}
        />
      )}
    </div>
  )
}

function OutfitCard({ outfit, onDelete }: { outfit: Outfit; onDelete: () => void }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{outfit.name}</div>
          <div style={{ fontSize: 12, color: 'var(--hint)', marginTop: 2 }}>
            {outfit.ai_suggested ? '🤖 ИИ · ' : ''}{outfit.created_at}
          </div>
        </div>
        <button onClick={onDelete} style={{ color: 'var(--hint)', fontSize: 18, padding: '4px 8px' }}>🗑</button>
      </div>

      {/* Item thumbnails */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {outfit.items.map((oi) => {
          const src = thumb(oi.image_url)
          return (
            <div key={oi.item_id} style={{ flexShrink: 0, textAlign: 'center' }}>
              <div style={{
                width: 60, height: 60, borderRadius: 10, overflow: 'hidden',
                background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {src
                  ? <img src={src} alt={oi.name} style={{ width: '100%', height: '100%' }} />
                  : <span style={{ fontSize: 24 }}>{catIcon(oi.category)}</span>
                }
              </div>
              <div style={{ fontSize: 10, color: 'var(--hint)', marginTop: 3, maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {oi.name}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function catIcon(cat: string) {
  const m: Record<string, string> = { top: '👕', bottom: '👖', outer: '🧥', shoes: '👟', headwear: '🧢', accessory: '👜' }
  return m[cat] ?? '👗'
}

function CreateOutfitSheet({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('')
  const [items, setItems] = useState<WardrobeItem[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { getWardrobe().then(setItems) }, [])

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const submit = async () => {
    if (!name.trim()) { setError('Введите название образа'); return }
    if (selected.size === 0) { setError('Выберите хотя бы одну вещь'); return }
    setLoading(true)
    setError('')
    try {
      await createOutfit(name.trim(), [...selected])
      onSaved()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-title">Новый образ</div>

        <div className="form-group">
          <div className="form-label">Название</div>
          <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Casual Friday" />
        </div>

        <div className="section-header">Выбери вещи ({selected.size})</div>

        <div style={{ padding: '0 12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
          {items.map((item) => {
            const src = thumb(item.image_url)
            const active = selected.has(item.id)
            return (
              <button key={item.id} onClick={() => toggle(item.id)}
                style={{
                  textAlign: 'left', background: 'none', padding: 0,
                  border: `2px solid ${active ? 'var(--btn)' : 'transparent'}`,
                  borderRadius: 12, overflow: 'hidden',
                }}>
                <div style={{ aspectRatio: '1', background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {src
                    ? <img src={src} alt={item.name} style={{ width: '100%', height: '100%' }} />
                    : <span style={{ fontSize: 28 }}>{catIcon(item.category)}</span>
                  }
                </div>
                <div style={{ padding: '4px 6px', fontSize: 12, fontWeight: 500, background: active ? 'var(--btn)' : 'var(--bg2)', color: active ? 'var(--btn-text)' : 'var(--text)' }}>
                  {item.name}
                </div>
              </button>
            )
          })}
        </div>

        {error && <div style={{ padding: '12px 16px', color: '#e53e3e', fontSize: 13 }}>{error}</div>}

        <div className="form-actions" style={{ marginTop: 12 }}>
          <button className="btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn-primary" style={{ flex: 1 }} onClick={submit} disabled={loading}>
            {loading ? 'Сохранение...' : 'Создать'}
          </button>
        </div>
      </div>
    </div>
  )
}
