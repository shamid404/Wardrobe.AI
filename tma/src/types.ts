export interface WardrobeItem {
  id: string
  name: string
  category: string
  brand?: string
  size?: string
  color?: string
  season?: string
  image_url?: string
  uploaded_at: string
}

export interface OutfitItem {
  item_id: string
  name: string
  category: string
  image_url?: string
}

export interface Outfit {
  id: string
  name: string
  ai_suggested: boolean
  created_at: string
  items: OutfitItem[]
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  recommended_items: WardrobeItem[]
  created_at: string
}

export interface ChatSession {
  id: string
  title: string
  created_at: string
}

export interface User {
  id: string
  name: string
  email: string
  avatar_url?: string
}

export type Category = 'all' | 'top' | 'bottom' | 'outer' | 'shoes' | 'headwear' | 'accessory'
