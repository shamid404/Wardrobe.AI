import { useEffect, useRef, useState } from 'react'
import {
  getWardrobe, addWardrobeItem, deleteWardrobeItem, uploadItemImage,
} from '../api/client'
import type { WardrobeItem, Category } from '../types'

const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'all',       label: 'Все' },
  { key: 'top',       label: 'Верх' },
  { key: 'bottom',    label: 'Низ' },
  { key: 'outer',     label: 'Верхняя' },
  { key: 'shoes',     label: 'Обувь' },
  { key: 'headwear',  label: 'Головные' },
  { key: 'accessory', label: 'Аксессуары' },
]

const BACKEND = import.meta.env.VITE_API_URL?.replace('/api', '') ?? 'http://localhost:8000'

function itemImageUrl(url?: string) {
  if (!url) return null
  if (url.startsWith('http')) return url
  return `${BACKEND}${url}`
}

export default function WardrobePage() {
  const [items, setItems] = useState<WardrobeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<Category>('all')
  const [showAdd, setShowAdd] = useState(false)
  const [detail, setDetail] = useState<WardrobeItem | null>(null)

  const load = () =>
    getWardrobe().then(setItems).finally(() => setLoading(false))

  useEffect(() => { load() }, [])

  const filtered = category === 'all' ? items : items.filter((i) => i.category === category)

  return (
    <div className="page">
      {/* Header */}
      <div style={{ padding: '16px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 20, fontWeight: 700 }}>Гардероб</span>
        <span style={{ color: 'var(--hint)', fontSize: 13 }}>{items.length} вещей</span>
      </div>

      {/* Category filter */}
      <div className="chips">
        {CATEGORIES.map((c) => (
          <button key={c.key} className={`chip ${category === c.key ? 'active' : ''}`}
            onClick={() => setCategory(c.key)}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Items grid */}
      <div className="page-content">
        {loading ? (
          <div className="empty-state"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="icon">👔</div>
            <p>Нет вещей в этой категории</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '8px 12px' }}>
            {filtered.map((item) => (
              <ItemCard key={item.id} item={item} onClick={() => setDetail(item)} />
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <button className="fab" onClick={() => setShowAdd(true)}>+</button>

      {/* Add sheet */}
      {showAdd && (
        <AddItemSheet
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load() }}
        />
      )}

      {/* Detail sheet */}
      {detail && (
        <DetailSheet
          item={detail}
          onClose={() => setDetail(null)}
          onDeleted={() => { setDetail(null); load() }}
          onImageUploaded={() => { setDetail(null); load() }}
        />
      )}
    </div>
  )
}

function ItemCard({ item, onClick }: { item: WardrobeItem; onClick: () => void }) {
  const src = itemImageUrl(item.image_url)
  return (
    <button onClick={onClick} style={{ textAlign: 'left', background: 'none', padding: 0 }}>
      <div className="card" style={{ aspectRatio: '3/4', position: 'relative' }}>
        {src ? (
          <img src={src} alt={item.name} style={{ width: '100%', height: '100%' }} />
        ) : (
          <div style={{
            width: '100%', height: '100%', background: 'var(--bg2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32,
          }}>
            {categoryIcon(item.category)}
          </div>
        )}
      </div>
      <div style={{ padding: '6px 2px 0' }}>
        <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.name}
        </div>
        <div style={{ fontSize: 12, color: 'var(--hint)' }}>{item.brand || item.category}</div>
      </div>
    </button>
  )
}

function categoryIcon(cat: string) {
  const map: Record<string, string> = {
    top: '👕', bottom: '👖', outer: '🧥', shoes: '👟', headwear: '🧢', accessory: '👜',
  }
  return map[cat] ?? '👗'
}

function AddItemSheet({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('top')
  const [brand, setBrand] = useState('')
  const [size, setSize] = useState('')
  const [color, setColor] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!name.trim()) { setError('Введите название'); return }
    setLoading(true)
    setError('')
    try {
      await addWardrobeItem({ name: name.trim(), category, brand: brand || undefined, size: size || undefined, color: color || undefined })
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
        <div className="sheet-title">Новая вещь</div>

        <div className="form-group">
          <div className="form-label">Название *</div>
          <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Белая рубашка" />
        </div>

        <div className="form-group">
          <div className="form-label">Категория</div>
          <select className="form-input" value={category} onChange={(e) => setCategory(e.target.value)}
            style={{ width: '100%' }}>
            <option value="top">Верх</option>
            <option value="bottom">Низ</option>
            <option value="outer">Верхняя одежда</option>
            <option value="shoes">Обувь</option>
            <option value="headwear">Головной убор</option>
            <option value="accessory">Аксессуар</option>
          </select>
        </div>

        <div className="form-group">
          <div className="form-label">Бренд</div>
          <input className="form-input" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Необязательно" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
          <div className="form-group">
            <div className="form-label">Размер</div>
            <input className="form-input" value={size} onChange={(e) => setSize(e.target.value)} placeholder="M / 42" />
          </div>
          <div className="form-group">
            <div className="form-label">Цвет</div>
            <input className="form-input" value={color} onChange={(e) => setColor(e.target.value)} placeholder="Белый" />
          </div>
        </div>

        {error && <div style={{ padding: '0 16px 12px', color: '#e53e3e', fontSize: 13 }}>{error}</div>}

        <div className="form-actions">
          <button className="btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn-primary" style={{ flex: 1 }} onClick={submit} disabled={loading}>
            {loading ? 'Добавление...' : 'Добавить'}
          </button>
        </div>
      </div>
    </div>
  )
}

function DetailSheet({ item, onClose, onDeleted, onImageUploaded }: {
  item: WardrobeItem
  onClose: () => void
  onDeleted: () => void
  onImageUploaded: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const src = itemImageUrl(item.image_url)

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      await uploadItemImage(item.id, file)
      onImageUploaded()
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Удалить «${item.name}»?`)) return
    setDeleting(true)
    try {
      await deleteWardrobeItem(item.id)
      onDeleted()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />

        {/* Photo */}
        <div style={{ margin: '0 16px 16px', borderRadius: 12, overflow: 'hidden', aspectRatio: '4/3', background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {src
            ? <img src={src} alt={item.name} style={{ width: '100%', height: '100%' }} />
            : <span style={{ fontSize: 48 }}>{categoryIcon(item.category)}</span>
          }
        </div>

        {/* Info */}
        <div style={{ padding: '0 16px 16px' }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{item.name}</div>
          <div style={{ color: 'var(--hint)', fontSize: 14, marginTop: 4 }}>
            {[item.brand, item.size, item.color].filter(Boolean).join(' · ') || item.category}
          </div>
        </div>

        {/* Actions */}
        <div className="form-actions">
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImage} />
          <button className="btn-secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? 'Загрузка...' : '📷 Фото'}
          </button>
          <button className="btn-secondary" style={{ color: '#e53e3e' }} onClick={handleDelete} disabled={deleting}>
            {deleting ? '...' : '🗑 Удалить'}
          </button>
        </div>
      </div>
    </div>
  )
}
