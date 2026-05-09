import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

import { cardStyle } from '@/lib/styles'
import { Modal } from '@/components/ui/modal'
import { useCustomers } from '@/hooks/customers'
import { useRagSearch } from '@/hooks/rag'
import { useDocumentDownloadUrl } from '@/hooks/documents'
import { useAppSelector } from '@/hooks/store'

/* ─── Types ─────────────────────────────────────────────────── */
type MessageRole = 'user' | 'assistant'

interface ChatMessage {
  id: number
  role: MessageRole
  content: string
  sources?: Array<{ 
    title: string; 
    page: string; 
    attachment_id: string; 
    page_number?: number | null;
  }>
  ts: string
}

/* ─── Constants ──────────────────────────────────────────────── */
const initialMessages: ChatMessage[] = [
  {
    id: 1, 
    role: 'assistant', 
    ts: new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }),
    content: 'Cześć! Jestem asystentem AI HRK CRM. Wybierz klienta z listy powyżej, abyśmy mogli rozmawiać o jego umowach i dokumentach. W czym mogę Ci dzisiaj pomóc?',
  },
]

const suggestions = [
  'Jaki jest termin obowiązywania obecnej umowy?',
  'Czy w dokumentach są zapisy o karach umownych?',
  'Kiedy była ostatnia waloryzacja stawek?',
  'Jakie są warunki wypowiedzenia umowy?',
  'Podsumuj ostatnie zmiany w aneksach.',
]

const aiCapabilities = [
  { icon: '📄', title: 'RAG – dokumenty umów', desc: 'Odpowiedzi z odwołaniem do strony źródłowej dokumentu' },
  { icon: '🔍', title: 'Weryfikacja danych',   desc: 'Sprawdzenie spójności danych pracowniczych z plikiem źródłowym' },
  { icon: '📊', title: 'Sugestia aneksu',      desc: 'Automatyczne przygotowanie projektu aneksu po aktualizacji GUS' },
  { icon: '🧠', title: 'Podsumowanie klienta', desc: 'Generowanie briefu przed spotkaniem na podstawie historii' },
]

const card: CSSProperties = cardStyle

/* ─── Component ──────────────────────────────────────────────── */
export function AdvisorPage() {
  const { data: customers = [] } = useCustomers()
  const ragSearch = useRagSearch()
  const getDownloadUrl = useDocumentDownloadUrl()
  const user = useAppSelector((s) => s.auth.user)

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')
  const [isAiMode, setIsAiMode] = useState(false)
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false)
  
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  
  const nextIdRef = useRef(100)
  const scrollRef = useRef<HTMLDivElement>(null)
  const clientContextSelectId = 'client-context'

  // Initialize selectedCustomerId when customers load
  useEffect(() => {
    if (customers.length > 0 && !selectedCustomerId) {
      setSelectedCustomerId(customers[0].id)
    }
  }, [customers, selectedCustomerId])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, isTyping])

  const sendMessage = async (text: string) => {
    if (!text.trim() || !selectedCustomerId) return
    
    const now = new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
    setMessages((prev) => [...prev, { id: nextIdRef.current++, role: 'user', content: text, ts: now }])
    setInput('')
    setIsTyping(true)

    try {
      const response = await ragSearch.mutateAsync({
        query: text,
        customer_id: selectedCustomerId,
        ai_mode: isAiMode,
        top_k: 5
      })

      const assistantMsg: ChatMessage = {
        id: nextIdRef.current++,
        role: 'assistant',
        ts: new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }),
        content: response.ai_answer || (response.chunks.length > 0 
          ? `**Najbardziej trafny fragment z dokumentów:**\n\n"${response.chunks[0].highlight || response.chunks[0].content.substring(0, 300) + '...'}"\n\nPozostałe fragmenty i źródła znajdziesz poniżej:` 
          : "Niestety nie znalazłem informacji na ten temat w dostępnych dokumentach tego klienta."),
        sources: response.chunks.map(chunk => ({
          title: chunk.section_title || 'Dokument',
          page: chunk.page_number ? `str. ${chunk.page_number}` : 'fragment',
          attachment_id: chunk.attachment_id,
          page_number: chunk.page_number
        }))
      }

      setMessages((prev) => [...prev, assistantMsg])
    } catch (err) {
      console.error('RAG Search failed:', err)
      setMessages((prev) => [...prev, {
        id: nextIdRef.current++,
        role: 'assistant',
        ts: new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }),
        content: "Przepraszam, wystąpił błąd podczas komunikacji z serwisem AI. Upewnij się, że serwery są uruchomione i dokumenty zostały przetworzone.",
      }])
    } finally {
      setIsTyping(false)
    }
  }

  const handleSourceClick = async (attachmentId: string, pageNumber?: number | null) => {
    if (!user?.id) return
    try {
      const { url } = await getDownloadUrl.mutateAsync({ id: attachmentId, userId: user.id })
      // Append #page=N to the PDF URL
      const finalUrl = pageNumber ? `${url}#page=${pageNumber}` : url
      setPreviewUrl(finalUrl)
      setIsPreviewOpen(true)
    } catch (err) {
      console.error('Failed to get preview URL:', err)
      alert('Nie udało się wygenerować podglądu dokumentu.')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Header */}
      <div style={{ marginBottom: 16, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1714', margin: 0, marginBottom: 2 }}>Chat z asystentem AI</h1>
            <p style={{ fontSize: 12.5, color: '#9e9389', margin: 0 }}>Kontekstowy asystent oparty o dokumenty klienta, umowy i historię współpracy.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label htmlFor={clientContextSelectId} style={{ fontSize: 12, color: '#9e9389' }}>
              Kontekst:
            </label>
            <select 
              id={clientContextSelectId} 
              value={selectedCustomerId} 
              onChange={(e) => setSelectedCustomerId(e.target.value)} 
              style={{ border: '1px solid #e3e0db', borderRadius: 6, padding: '6px 12px', fontSize: 13, fontWeight: 600, color: '#1a1714', background: 'white', cursor: 'pointer', outline: 'none' }}
            >
              <option value="" disabled>Wybierz klienta...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name || c.ckk}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <Modal 
        isOpen={isPreviewOpen} 
        onClose={() => {
          setIsPreviewOpen(false)
          setPreviewUrl(null)
        }} 
        title="Podgląd źródła dokumentu"
        maxWidth="1200px"
      >
        <div style={{ height: '80vh', background: '#f5f2ef', borderRadius: 8, overflow: 'hidden' }}>
          {previewUrl ? (
            <iframe 
              src={previewUrl} 
              style={{ width: '100%', height: '100%', border: 'none' }} 
              title="Document Source Preview"
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9e9389' }}>
              Ładowanie podglądu...
            </div>
          )}
        </div>
      </Modal>

      <Modal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)} title="Tryby pracy Asystenta AI">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f5f2ef', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 20 }}>🔍</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1714', marginBottom: 4 }}>Tryb Wyszukiwania (Standard)</div>
              <div style={{ fontSize: 12.5, color: '#6b6b6b', lineHeight: 1.5 }}>
                Szybkie przeszukiwanie bazy wektorowej (RAG). Idealne do prostych pytań o fakty. Odpowiedź otrzymasz w ciągu 1-2 sekund.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#fff5f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 20 }}>🧠</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#e85c04', marginBottom: 4 }}>Tryb Rozumowania AI (Głębokie wnioskowanie)</div>
              <div style={{ fontSize: 12.5, color: '#6b6b6b', lineHeight: 1.5 }}>
                Model nie tylko szuka fragmentów, ale <strong>interpretuje i syntetyzuje</strong> dane z wielu źródeł. Proces trwa dłużej (5-10 sekund).
              </div>
            </div>
          </div>

          <button 
            onClick={() => setIsInfoModalOpen(false)}
            style={{ padding: '12px', borderRadius: 8, border: 'none', background: '#e85c04', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: 10 }}
          >
            Rozumiem
          </button>
        </div>
      </Modal>

      {/* Main */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16, flex: 1, minHeight: 0 }}>
        {/* Chat */}
        <div style={{ ...card, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Messages */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {messages.map((msg) => (
              <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {msg.role === 'assistant' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg, #e85c04, #c94f02)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>🤖</div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#c94f02' }}>AI Asystent</span>
                    <span style={{ fontSize: 10, color: '#9e9389' }}>{msg.ts}</span>
                  </div>
                )}
                <div style={{
                  maxWidth: '85%', padding: '10px 14px',
                  borderRadius: msg.role === 'user' ? '14px 14px 2px 14px' : '2px 14px 14px 14px',
                  background: msg.role === 'user' ? '#e85c04' : '#fafaf9',
                  color: msg.role === 'user' ? 'white' : '#1a1714',
                  fontSize: 13, lineHeight: 1.6,
                  border: msg.role === 'assistant' ? '1px solid #f2f0ed' : 'none',
                }}>
                  {msg.content.split('\n').map((line, i) => {
                    const parts = line.split(/\*\*(.*?)\*\*/g)
                    return (
                      <p key={i} style={{ margin: i === 0 ? 0 : '4px 0 0 0' }}>
                        {parts.map((part, j) => j % 2 === 1 ? <strong key={j}>{part}</strong> : part)}
                      </p>
                    )
                  })}
                  {msg.sources && msg.sources.length > 0 && (
                    <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #fdd5b8' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#c94f02', marginBottom: 4 }}>📎 ŹRÓDŁA (KLIKNIJ ABY OTWORZYĆ)</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {msg.sources.map((src, i) => (
                          <button 
                            key={i} 
                            onClick={() => handleSourceClick(src.attachment_id, src.page_number)}
                            style={{ 
                              fontSize: 11, color: '#c94f02', background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', display: 'flex', gap: 4, transition: 'opacity 0.2s' 
                            }}
                            onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
                            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                          >
                            <span>→</span><span><strong>{src.title}</strong> · {src.page}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {msg.role === 'user' && <span style={{ fontSize: 10, color: '#9e9389', marginTop: 3 }}>{msg.ts}</span>}
              </div>
            ))}
            {isTyping && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg, #e85c04, #c94f02)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>🤖</div>
                <div style={{ background: '#fafaf9', border: '1px solid #f2f0ed', borderRadius: '2px 14px 14px 14px', padding: '10px 16px', display: 'flex', gap: 4, alignItems: 'center' }}>
                  {[0, 1, 2].map((i) => (
                    <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#e85c04', animation: `dot-bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quick suggestions */}
          <div style={{ padding: '8px 16px', borderTop: '1px solid #f2f0ed', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {suggestions.map((s) => (
              <button key={s} onClick={() => sendMessage(s)} style={{ padding: '4px 10px', fontSize: 11, borderRadius: 20, border: '1px solid #e3e0db', background: '#fafaf9', color: '#4b5563', cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap' }}>
                {s.length > 45 ? s.slice(0, 42) + '…' : s}
              </button>
            ))}
          </div>

          {/* Input */}
          <div style={{ padding: '16px 20px', borderTop: '1px solid #f2f0ed', display: 'flex', gap: 10, alignItems: 'center', background: 'white' }}>
            <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                name="assistant-question"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
                placeholder="Zadaj pytanie o klienta, umowę lub waloryzację…"
                style={{ 
                  flex: 1, 
                  border: '1px solid #e3e0db', 
                  borderRadius: 12, 
                  padding: '12px 16px', 
                  paddingRight: 40,
                  fontSize: 14, 
                  outline: 'none', 
                  color: '#1a1714',
                  transition: 'all 0.2s',
                  background: '#fafaf9',
                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#e85c04'
                  e.currentTarget.style.background = 'white'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232, 92, 4, 0.1)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#e3e0db'
                  e.currentTarget.style.background = '#fafaf9'
                  e.currentTarget.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.02)'
                }}
              />
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f5f2ef', padding: '4px', borderRadius: 14, border: '1px solid #e3e0db' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <button 
                  onClick={() => setIsAiMode(false)}
                  style={{ 
                    padding: '8px 14px', 
                    borderRadius: 10, 
                    border: 'none', 
                    background: !isAiMode ? 'white' : 'transparent', 
                    color: !isAiMode ? '#1a1714' : '#9e9389', 
                    fontSize: 10, 
                    fontWeight: 800, 
                    cursor: 'pointer', 
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)', 
                    boxShadow: !isAiMode ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                    letterSpacing: '0.02em'
                  }}
                >
                  WYSZUKIWANIE
                </button>
                <button 
                  onClick={() => setIsAiMode(true)}
                  style={{ 
                    padding: '8px 14px', 
                    borderRadius: 10, 
                    border: 'none', 
                    background: isAiMode ? '#e85c04' : 'transparent', 
                    color: isAiMode ? 'white' : '#9e9389', 
                    fontSize: 10, 
                    fontWeight: 800, 
                    cursor: 'pointer', 
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)', 
                    boxShadow: isAiMode ? '0 4px 12px rgba(232, 92, 4, 0.25)' : 'none',
                    letterSpacing: '0.02em'
                  }}
                >
                  ROZUMOWANIE AI
                </button>
              </div>
              <div style={{ width: 1, height: 16, background: '#e3e0db', margin: '0 2px' }} />
              <button 
                onClick={() => setIsInfoModalOpen(true)}
                style={{ background: 'white', border: '1px solid #e3e0db', color: '#9e9389', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, transition: 'all 0.2s' }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = '#e85c04'
                  e.currentTarget.style.borderColor = '#fdd5b8'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = '#9e9389'
                  e.currentTarget.style.borderColor = '#e3e0db'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
              </button>
            </div>

            <button 
              onClick={() => sendMessage(input)} 
              disabled={!input.trim() || isTyping}
              style={{ 
                background: 'linear-gradient(135deg, #e85c04, #c94f02)', 
                border: 'none', 
                borderRadius: 12, 
                padding: '12px 20px', 
                cursor: (!input.trim() || isTyping) ? 'not-allowed' : 'pointer', 
                color: 'white', 
                fontSize: 14, 
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'all 0.2s',
                opacity: (!input.trim() || isTyping) ? 0.7 : 1,
                boxShadow: '0 4px 12px rgba(232, 92, 4, 0.2)'
              }}
              onMouseEnter={e => {
                if (!input.trim() || isTyping) return
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(232, 92, 4, 0.3)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(232, 92, 4, 0.2)'
              }}
            >
              Wyślij
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto' }}>
          {/* Capabilities */}
          <div style={{ ...card, padding: '14px 16px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1714', marginBottom: 12 }}>Funkcje asystenta</div>
            {aiCapabilities.map((cap) => (
              <div key={cap.title} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                <div style={{ fontSize: 18, flexShrink: 0 }}>{cap.icon}</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1714', marginBottom: 2 }}>{cap.title}</div>
                  <div style={{ fontSize: 11, color: '#9e9389', lineHeight: 1.4 }}>{cap.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Context */}
          <div style={{ background: '#fff8f4', borderRadius: 8, border: '1px solid #fdd5b8', padding: '14px 16px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#c94f02', marginBottom: 10, display: 'flex', gap: 5, alignItems: 'center' }}>
              🌐 Aktywny kontekst
            </div>
            {[
              { label: 'Klient',    value: customers.find(c => c.id === selectedCustomerId)?.company_name || 'Nie wybrano' },
              { label: 'Indeks',    value: 'Dokumenty RAG' },
              { label: 'Silnik',    value: isAiMode ? 'Gemma 4' : 'pgvector' },
            ].map((item) => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                <span style={{ color: '#9e9389' }}>{item.label}</span>
                <span style={{ fontWeight: 600, color: '#7a3c01' }}>{item.value}</span>
              </div>
            ))}
          </div>

          {/* Suggested questions */}
          <div style={{ ...card, padding: '14px 16px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1714', marginBottom: 10 }}>Propozycje pytań</div>
            {suggestions.map((s) => (
              <button key={s} onClick={() => sendMessage(s)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', marginBottom: 5, fontSize: 11, borderRadius: 6, border: '1px solid #f2f0ed', background: '#fafaf9', color: '#e85c04', cursor: 'pointer', lineHeight: 1.4, fontWeight: 500 }}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
