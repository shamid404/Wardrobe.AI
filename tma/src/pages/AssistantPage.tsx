import { useEffect, useRef, useState } from 'react'
import { chatWithAssistant, getChatSessions, getSessionMessages, deleteChatSession } from '../api/client'
import type { ChatMessage, ChatSession } from '../types'

const BACKEND = import.meta.env.VITE_API_URL?.replace('/api', '') ?? 'http://localhost:8000'

function thumb(url?: string) {
  if (!url) return null
  return url.startsWith('http') ? url : `${BACKEND}${url}`
}

export default function AssistantPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSession, setActiveSession] = useState<string | undefined>()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showSessions, setShowSessions] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadSessions = () => getChatSessions().then(setSessions)

  useEffect(() => { loadSessions() }, [])

  useEffect(() => {
    if (!activeSession) { setMessages([]); return }
    getSessionMessages(activeSession).then(setMessages)
  }, [activeSession])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setSending(true)

    const optimistic: ChatMessage = {
      id: `tmp_${Date.now()}`,
      role: 'user',
      content: text,
      recommended_items: [],
      created_at: new Date().toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }),
    }
    setMessages((prev) => [...prev, optimistic])

    try {
      const res = await chatWithAssistant(text, activeSession)
      if (!activeSession) {
        setActiveSession(res.session_id)
        loadSessions()
      }
      const reply: ChatMessage = {
        id: `tmp_reply_${Date.now()}`,
        role: 'assistant',
        content: res.reply,
        recommended_items: [],
        created_at: new Date().toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages((prev) => [...prev, reply])
      // reload to get proper recommended_items from DB
      if (res.session_id) {
        getSessionMessages(res.session_id).then(setMessages)
        setActiveSession(res.session_id)
      }
    } catch (e: any) {
      const errMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: `Ошибка: ${e.message}`,
        recommended_items: [],
        created_at: '',
      }
      setMessages((prev) => [...prev, errMsg])
    } finally {
      setSending(false)
    }
  }

  const handleDeleteSession = async (id: string) => {
    await deleteChatSession(id)
    if (activeSession === id) { setActiveSession(undefined); setMessages([]) }
    loadSessions()
  }

  const newChat = () => { setActiveSession(undefined); setMessages([]); setShowSessions(false) }

  return (
    <div className="page">
      {/* Header */}
      <div style={{ padding: '16px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ fontSize: 20, fontWeight: 700 }}>🤖 ИИ-стилист</span>
        <button onClick={() => setShowSessions(true)} style={{ color: 'var(--link)', fontSize: 14 }}>
          История
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 80 }}>
        {messages.length === 0 && !sending && (
          <div className="empty-state" style={{ paddingTop: 40 }}>
            <div className="icon">👗</div>
            <p style={{ fontWeight: 600 }}>Привет! Я твой стилист</p>
            <p style={{ fontSize: 13 }}>Спроси что надеть сегодня, к чему подобрать аксессуар или какой образ подойдёт для события</p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}

        {sending && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--btn)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🤖</div>
            <div style={{ background: 'var(--bg2)', borderRadius: 16, padding: '10px 14px' }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{
                    width: 6, height: 6, borderRadius: '50%', background: 'var(--hint)',
                    animation: 'bounce 1.2s infinite',
                    animationDelay: `${i * 0.2}s`,
                  }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        position: 'fixed', bottom: 'var(--nav-height)', left: 0, right: 0,
        padding: '10px 12px', background: 'var(--bg)',
        borderTop: '1px solid var(--bg2)', display: 'flex', gap: 8,
      }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Что надеть сегодня?.."
          style={{ flex: 1, padding: '10px 14px', borderRadius: 20 }}
        />
        <button
          onClick={send}
          disabled={!input.trim() || sending}
          style={{
            width: 40, height: 40, borderRadius: '50%',
            background: input.trim() && !sending ? 'var(--btn)' : 'var(--bg2)',
            color: input.trim() && !sending ? 'var(--btn-text)' : 'var(--hint)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, transition: 'all 0.15s', flexShrink: 0,
          }}
        >
          ↑
        </button>
      </div>

      {/* Sessions sheet */}
      {showSessions && (
        <div className="sheet-overlay" onClick={() => setShowSessions(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px 12px' }}>
              <div className="sheet-title" style={{ padding: 0 }}>История чатов</div>
              <button onClick={newChat} style={{ color: 'var(--link)', fontWeight: 600, fontSize: 14 }}>+ Новый чат</button>
            </div>

            {sessions.length === 0 ? (
              <div className="empty-state"><p>Нет сохранённых чатов</p></div>
            ) : (
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {sessions.map((s) => (
                  <div key={s.id}
                    style={{
                      display: 'flex', alignItems: 'center', padding: '12px 16px',
                      background: activeSession === s.id ? 'var(--bg2)' : 'transparent',
                      gap: 10,
                    }}>
                    <button style={{ flex: 1, textAlign: 'left' }}
                      onClick={() => { setActiveSession(s.id); setShowSessions(false) }}>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{s.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--hint)', marginTop: 2 }}>{s.created_at}</div>
                    </button>
                    <button onClick={() => handleDeleteSession(s.id)} style={{ color: 'var(--hint)', fontSize: 16, padding: '4px 6px' }}>🗑</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  )
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexDirection: isUser ? 'row-reverse' : 'row', maxWidth: '85%' }}>
        {!isUser && (
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--btn)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
            🤖
          </div>
        )}
        <div style={{
          background: isUser ? 'var(--btn)' : 'var(--bg2)',
          color: isUser ? 'var(--btn-text)' : 'var(--text)',
          borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
          padding: '10px 14px',
          fontSize: 14,
          lineHeight: 1.4,
        }}>
          {msg.content}
          {msg.created_at && (
            <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4, textAlign: 'right' }}>{msg.created_at}</div>
          )}
        </div>
      </div>

      {/* Recommended items */}
      {msg.recommended_items?.length > 0 && (
        <div style={{ maxWidth: '90%', display: 'flex', gap: 8, overflowX: 'auto', paddingLeft: 40, scrollbarWidth: 'none' }}>
          {msg.recommended_items.map((item) => {
            const src = thumb(item.image_url)
            return (
              <div key={item.id} style={{
                flexShrink: 0, background: 'var(--bg2)', borderRadius: 10, overflow: 'hidden', width: 80,
              }}>
                <div style={{ width: 80, height: 80, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {src ? <img src={src} alt={item.name} style={{ width: '100%', height: '100%' }} /> : <span style={{ fontSize: 28 }}>👗</span>}
                </div>
                <div style={{ padding: '4px 6px', fontSize: 10, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.name}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
