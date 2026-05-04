import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

import { cardStyle } from '@/lib/styles'

/* ─── Mock data (inline) ─────────────────────────────────────── */
type MessageRole = 'user' | 'assistant'
interface ChatMessage {
  id: number
  role: MessageRole
  content: string
  sources?: Array<{ title: string; page: string }>
  ts: string
}

const initialMessages: ChatMessage[] = [
  {
    id: 1, role: 'assistant', ts: '09:00',
    content: 'Cześć! Jestem asystentem AI systemu HRK CRM. Mogę odpowiedzieć na pytania dotyczące umów, klientów, waloryzacji oraz historii współpracy. Co chcesz sprawdzić?',
  },
  {
    id: 2, role: 'user', ts: '09:01',
    content: 'Do kiedy obowiązuje nasza umowa z Empik?',
  },
  {
    id: 3, role: 'assistant', ts: '09:01',
    content: 'Umowa z Empik Sp. z o.o. o numerze **HRK/EMP/2024/07** (umowa ramowa HR) obowiązuje do **12 maja 2026 roku**. Okno wypowiedzenia wynosi 30 dni, co oznacza że ostateczny termin podjęcia decyzji o odnowieniu minął **12 kwietnia** – konieczne jest pilne działanie.\n\nW systemie masz aktywne 3 umowy z tym klientem łącznie o wartości 2,4 mln PLN/rok.',
    sources: [
      { title: 'Umowa HRK/EMP/2024/07', page: 'str. 1 – Czas trwania' },
      { title: 'Aneks nr 5 (2025)',      page: 'str. 3 – Warunki odnowienia' },
    ],
  },
  {
    id: 4, role: 'user', ts: '09:02',
    content: 'Kiedy była ostatnia waloryzacja i jaki miała wpływ na stawki?',
  },
  {
    id: 5, role: 'assistant', ts: '09:02',
    content: 'Ostatnia waloryzacja dla Empik została przeprowadzona **1 czerwca 2025 roku**. Zmiana wyniosła **+5,2%** na podstawie wskaźnika CPI GUS (próg umowny: min. 4%).\n\nObecny wskaźnik GUS wynosi **4,5%**, co kwalifikuje kolejną waloryzację. Propozycja aneksu jest gotowa do akceptacji – oczekuje na podpis dyrektora sprzedaży.',
    sources: [
      { title: 'Historia waloryzacji EMP', page: 'rekord 2025-06-01' },
      { title: 'Wskaźnik GUS Q1 2026',    page: 'raport zewnętrzny' },
    ],
  },
]

const suggestions = [
  'Do kiedy obowiązuje nasza umowa z Empik?',
  'Kiedy była ostatnia waloryzacja i jaki miała wpływ?',
  'Ilu pracowników jest przypisanych do Biedronka?',
  'Jakie umowy kończą się w maju 2026?',
  'Generuj projekt aneksu dla Empik – waloryzacja +4,5%',
  'Porównaj stawki Rossmann i MediaMarkt',
]

const aiCapabilities = [
  { icon: '📄', title: 'RAG – dokumenty umów', desc: 'Odpowiedzi z odwołaniem do strony źródłowej dokumentu' },
  { icon: '🔍', title: 'Weryfikacja danych',   desc: 'Sprawdzenie spójności danych pracowniczych z plikiem źródłowym' },
  { icon: '📊', title: 'Sugestia aneksu',      desc: 'Automatyczne przygotowanie projektu aneksu po aktualizacji GUS' },
  { icon: '🧠', title: 'Podsumowanie klienta', desc: 'Generowanie briefu przed spotkaniem na podstawie historii' },
]

const clientOptions = ['Empik Sp. z o.o.', 'Rossmann Polska', 'Biedronka', 'Lidl Polska', 'MediaMarkt']

const card: CSSProperties = cardStyle

import { Modal } from '@/components/ui/modal'

/* ─── Component ──────────────────────────────────────────────── */
export function AdvisorPage() {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [activeClient, setActiveClient] = useState('Empik Sp. z o.o.')
  const [isAiMode, setIsAiMode] = useState(false)
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false)
  const nextIdRef = useRef(6)
  const timeoutIdsRef = useRef<number[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const clientContextSelectId = 'client-context'

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, isTyping])

  useEffect(() => {
    return () => {
      timeoutIdsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId))
      timeoutIdsRef.current = []
    }
  }, [])

  const sendMessage = (text: string) => {
    if (!text.trim()) return
    const now = new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
    setMessages((prev) => [...prev, { id: nextIdRef.current++, role: 'user', content: text, ts: now }])
    setInput('')
    setIsTyping(true)

    // AI Mode response simulation
    const delay = isAiMode ? 3500 : 1800
    const timeoutId = window.setTimeout(() => {
      setMessages((prev) => [...prev, {
        id: nextIdRef.current++, role: 'assistant', ts: new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }),
        content: isAiMode 
          ? `Dokładna analiza prawno-biznesowa dla klienta **${activeClient}** zakończona.\n\nZastosowałem zaawansowane wnioskowanie na podstawie wszystkich umów i aneksów. Moja interpretacja: zapytanie dotyczy ryzyka operacyjnego. Wymaga to uwzględnienia paragrafów o karach umownych oraz terminach wypowiedzenia zawartych w umowie ramowej i aneksie z 2025 roku.`
          : `Analizuję dane dla klienta **${activeClient}**...\n\nNa podstawie dokumentów w systemie: to pytanie dotyczy kluczowych informacji kontraktowych. W środowisku produkcyjnym ta odpowiedź byłaby oparta o rzeczywiste dokumenty klienta z indeksu RAG.`,
        sources: [{ title: 'Baza CRM HRK', page: isAiMode ? 'analiza semantyczna + LLM reasoning' : 'wyszukiwanie semantyczne' }],
      }])
      setIsTyping(false)
      timeoutIdsRef.current = timeoutIdsRef.current.filter((id) => id !== timeoutId)
    }, delay)
    timeoutIdsRef.current.push(timeoutId)
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
            <select id={clientContextSelectId} value={activeClient} onChange={(e) => setActiveClient(e.target.value)} style={{ border: '1px solid #e3e0db', borderRadius: 6, padding: '6px 12px', fontSize: 13, fontWeight: 600, color: '#1a1714', background: 'white', cursor: 'pointer', outline: 'none' }}>
              {clientOptions.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      <Modal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)} title="Tryby pracy Asystenta AI">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f5f2ef', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 20 }}>🔍</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1714', marginBottom: 4 }}>Tryb Wyszukiwania (Standard)</div>
              <div style={{ fontSize: 12.5, color: '#6b6b6b', lineHeight: 1.5 }}>
                Szybkie przeszukiwanie bazy wektorowej (RAG). Idealne do prostych pytań o fakty, np.:
                <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
                  <li>"Do kiedy trwa umowa?"</li>
                  <li>"Jakie są stawki w aneksie nr 2?"</li>
                  <li>"Kto jest opiekunem firmy X?"</li>
                </ul>
                Odpowiedź otrzymasz w ciągu 1-2 sekund.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#fff5f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 20 }}>🧠</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#e85c04', marginBottom: 4 }}>Tryb Rozumowania AI (Głębokie wnioskowanie)</div>
              <div style={{ fontSize: 12.5, color: '#6b6b6b', lineHeight: 1.5 }}>
                Model nie tylko szuka fragmentów, ale <strong>interpretuje i syntetyzuje</strong> dane z wielu źródeł. Wykorzystaj go do trudnych zadań:
                <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
                  <li>"Jakie ryzyka grożą nam przy zerwaniu umowy?"</li>
                  <li>"Porównaj warunki SLA u 3 największych klientów."</li>
                  <li>"Przygotuj argumentację do negocjacji stawek."</li>
                </ul>
                Proces trwa dłużej (5-10 sekund), ale daje znacznie głębszą analizę.
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
                  {msg.sources && (
                    <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #fdd5b8' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#c94f02', marginBottom: 4 }}>📎 ŹRÓDŁA</div>
                      {msg.sources.map((src, i) => (
                        <div key={i} style={{ fontSize: 11, color: '#c94f02', display: 'flex', gap: 4 }}>
                          <span>→</span><span><strong>{src.title}</strong> · {src.page}</span>
                        </div>
                      ))}
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
            {suggestions.slice(0, 3).map((s) => (
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
              style={{ 
                background: 'linear-gradient(135deg, #e85c04, #c94f02)', 
                border: 'none', 
                borderRadius: 12, 
                padding: '12px 20px', 
                cursor: 'pointer', 
                color: 'white', 
                fontSize: 14, 
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'all 0.2s',
                boxShadow: '0 4px 12px rgba(232, 92, 4, 0.2)'
              }}
              onMouseEnter={e => {
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
              { label: 'Klient',    value: activeClient        },
              { label: 'Dokumenty', value: '14 w indeksie'     },
              { label: 'Vektory',   value: '2 841 fragmentów'  },
              { label: 'Model',     value: 'Gemma 4 (Ollama)'  },
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
              <button key={s} onClick={() => sendMessage(s)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', marginBottom: 5, fontSize: 12, borderRadius: 6, border: '1px solid #f2f0ed', background: '#fafaf9', color: '#e85c04', cursor: 'pointer', lineHeight: 1.4, fontWeight: 500 }}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
