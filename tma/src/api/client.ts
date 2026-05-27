const API_BASE = import.meta.env.VITE_API_URL ?? '/api'

const TOKEN_KEY = 'tma_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  if (res.status === 401) {
    clearToken()
    window.location.reload()
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? 'Request failed')
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

async function upload<T>(path: string, formData: FormData): Promise<T> {
  const token = getToken()
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? 'Upload failed')
  }
  return res.json()
}

// ── Auth ────────────────────────────────────────────────────────────────────
export async function authTelegram(initData: string) {
  return request<{ access_token: string; user: { id: string; name: string; email: string; avatar_url?: string } }>(
    '/auth/telegram',
    { method: 'POST', body: JSON.stringify({ initData }) }
  )
}

export async function getMe() {
  return request<{ id: string; name: string; email: string; avatar_url?: string }>('/auth/me')
}

// ── Wardrobe ────────────────────────────────────────────────────────────────
export async function getWardrobe() {
  return request<import('../types').WardrobeItem[]>('/wardrobe')
}

export async function addWardrobeItem(data: {
  name: string; category: string; brand?: string; size?: string; color?: string; season?: string
}) {
  return request<import('../types').WardrobeItem>('/wardrobe', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateWardrobeItem(id: string, data: Partial<{
  name: string; category: string; brand: string; size: string; color: string; season: string
}>) {
  return request<import('../types').WardrobeItem>(`/wardrobe/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function deleteWardrobeItem(id: string) {
  return request<void>(`/wardrobe/${id}`, { method: 'DELETE' })
}

export async function uploadItemImage(itemId: string, file: File) {
  const fd = new FormData()
  fd.append('file', file)
  return upload<import('../types').WardrobeItem>(`/wardrobe/${itemId}/image`, fd)
}

// ── Outfits ─────────────────────────────────────────────────────────────────
export async function getOutfits() {
  return request<import('../types').Outfit[]>('/outfits')
}

export async function createOutfit(name: string, itemIds: string[], aiSuggested = false) {
  return request<import('../types').Outfit>('/outfits', {
    method: 'POST',
    body: JSON.stringify({ name, item_ids: itemIds, ai_suggested: aiSuggested }),
  })
}

export async function deleteOutfit(id: string) {
  return request<void>(`/outfits/${id}`, { method: 'DELETE' })
}

// ── Assistant ────────────────────────────────────────────────────────────────
export async function chatWithAssistant(message: string, sessionId?: string, lat?: number, lon?: number) {
  return request<{ reply: string; recommended_items: string[]; session_id: string }>(
    '/assistant/chat',
    {
      method: 'POST',
      body: JSON.stringify({ message, session_id: sessionId, lat, lon }),
    }
  )
}

export async function getChatSessions() {
  return request<import('../types').ChatSession[]>('/chat/sessions')
}

export async function getSessionMessages(sessionId: string) {
  return request<import('../types').ChatMessage[]>(`/chat/sessions/${sessionId}/messages`)
}

export async function deleteChatSession(sessionId: string) {
  return request<void>(`/chat/sessions/${sessionId}`, { method: 'DELETE' })
}
