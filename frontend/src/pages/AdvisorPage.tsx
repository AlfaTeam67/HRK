import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

import axios from 'axios'
import { apiClient } from '@/lib/axios'
import { cardStyle } from '@/lib/styles'
import { Modal } from '@/components/ui/modal'
import { useDocumentsQuery } from '@/hooks/documents'
import { useCustomers } from '@/hooks/customers'
import { useRagSearch } from '@/hooks/rag'
import { useAppSelector } from '@/hooks/store'
import type { DocumentRead } from '@/types/models'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

/* ─── Types ─────────────────────────────────────────────────── */
type MessageRole = 'user' | 'assistant'

interface MessageSource {
  title: string
  page: string
  attachment_id: string
  page_number?: number | null
  highlight?: string | null
}

interface ChatMessage {
  id: number
  role: MessageRole
  content: string
  sources?: MessageSource[]
  ts: string
}

interface ActiveDocView {
  attachmentId: string
  pageNumber: number
  highlightText: string | null
  title: string
}

/* ─── Constants ──────────────────────────────────────────────── */
const initialMessages: ChatMessage[] = [
  {
    id: 1,
    role: 'assistant',
    ts: new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }),
    content:
      'Cześć! Jestem asystentem AI HRK CRM. Wybierz klienta z listy powyżej, abyśmy mogli rozmawiać o jego umowach i dokumentach. W czym mogę Ci dzisiaj pomóc?',
  },
]

const suggestions = [
  'Jaki jest termin obowiązywania obecnej umowy?',
  'Czy w dokumentach są zapisy o karach umownych?',
  'Kiedy była ostatnia waloryzacja stawek?',
  'Jakie są warunki wypowiedzenia umowy?',
  'Podsumuj ostatnie zmiany w aneksach.',
]

const card: CSSProperties = cardStyle

/* ─── Helpers ────────────────────────────────────────────────── */
function fmtBytes(bytes: number | null | undefined): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function docIcon(mime: string | null | undefined): string {
  if (!mime) return '📄'
  if (mime.includes('pdf')) return '📕'
  if (mime.includes('word') || mime.includes('docx') || mime.includes('doc')) return '📝'
  if (mime.includes('image')) return '🖼️'
  if (mime.includes('text')) return '📄'
  return '📎'
}

/* ─── DocumentList ───────────────────────────────────────────── */
function DocumentList({
  docs,
  onOpen,
}: {
  docs: DocumentRead[]
  onOpen: (doc: DocumentRead) => void
}) {
  if (docs.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32, background: 'linear-gradient(160deg, #fafaf9 0%, #f5f2ef 100%)' }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: '#f0ede9', border: '1px solid #e3e0db', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>📂</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#9e9389', textAlign: 'center' }}>Brak dokumentów</div>
        <div style={{ fontSize: 12, color: '#b5afa8', textAlign: 'center', maxWidth: 200, lineHeight: 1.6 }}>
          Dla tego klienta nie ma jeszcze żadnych dokumentów.
        </div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10, background: 'linear-gradient(160deg, #fafaf9 0%, #f5f2ef 100%)' }}>
      {docs.map((doc) => (
        <button
          key={doc.id}
          onClick={() => onOpen(doc)}
          style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '14px 16px', borderRadius: 12, textAlign: 'left',
            background: 'white', border: '1px solid #e8e4df',
            cursor: 'pointer', fontFamily: 'inherit', width: '100%',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.1s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#fdd5b8'
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(232,92,4,0.10)'
            e.currentTarget.style.transform = 'translateY(-1px)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#e8e4df'
            e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'
            e.currentTarget.style.transform = 'translateY(0)'
          }}
        >
          {/* Icon */}
          <div style={{ width: 44, height: 44, borderRadius: 10, background: 'linear-gradient(135deg, #fff5f0, #fde8d8)', border: '1px solid #fdd5b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
            {docIcon(doc.mime_type)}
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1714', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 3 }}>
              {doc.original_filename}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: '#c94f02', background: '#fff5f0', border: '1px solid #fdd5b8', borderRadius: 4, padding: '1px 6px', letterSpacing: '0.02em' }}>
                {doc.document_type}
              </span>
              {doc.file_size_bytes ? (
                <span style={{ fontSize: 10, color: '#b5afa8' }}>{fmtBytes(doc.file_size_bytes)}</span>
              ) : null}
            </div>
          </div>

          {/* Arrow */}
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#f5f2ef', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9e9389" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </button>
      ))}
    </div>
  )
}

/* ─── PdfErrorCard ───────────────────────────────────────────── */
function PdfErrorCard({ message, blobUrl }: { message: string; blobUrl: string | null }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 32, textAlign: 'center' }}>
      <div style={{ fontSize: 32, opacity: 0.4 }}>⚠️</div>
      <div style={{ fontSize: 13, color: '#c4bdb5', fontWeight: 600 }}>{message}</div>
      {blobUrl && (
        <>
          <div style={{ fontSize: 11, color: '#d4cfc9', maxWidth: 200, lineHeight: 1.5 }}>
            Plik ma niestandardowy format. Otwórz go w przeglądarce.
          </div>
          <a
            href={blobUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 12, fontWeight: 700, color: '#e85c04', textDecoration: 'none',
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '8px 14px', borderRadius: 8, border: '1px solid #fdd5b8', background: '#fff8f4',
            }}
          >
            Otwórz w nowej karcie
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        </>
      )}
    </div>
  )
}

/* ─── Component ──────────────────────────────────────────────── */
export function AdvisorPage() {
  const { data: customers = [] } = useCustomers()
  const ragSearch = useRagSearch()
  const user = useAppSelector((s) => s.auth.user)

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')

  const { data: customerDocs = [], isLoading: docsLoading } = useDocumentsQuery(
    selectedCustomerId ? { customer_id: selectedCustomerId } : undefined,
  )
  const [isAiMode, setIsAiMode] = useState(false)
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false)

  const [activeDocView, setActiveDocView] = useState<ActiveDocView | null>(null)
  const [numPages, setNumPages] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [docContainerWidth, setDocContainerWidth] = useState<number>(500)
  const [pdfData, setPdfData] = useState<{ data: Uint8Array } | null>(null)
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null)
  const [pdfFetching, setPdfFetching] = useState(false)
  const [pdfFetchError, setPdfFetchError] = useState<string | null>(null)

  const prevAttachmentIdRef = useRef<string | null>(null)
  const nextIdRef = useRef(100)
  const scrollRef = useRef<HTMLDivElement>(null)
  const docBodyRef = useRef<HTMLDivElement>(null)
  const clientContextSelectId = 'client-context'

  useEffect(() => {
    if (customers.length > 0 && !selectedCustomerId) {
      setSelectedCustomerId(customers[0].id)
    }
  }, [customers, selectedCustomerId])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, isTyping])

  /* Fetch PDF bytes when active document changes */
  useEffect(() => {
    if (!activeDocView || !user?.id) {
      setPdfData(null)
      setPdfBlobUrl(null)
      setPdfFetchError(null)
      return
    }
    setCurrentPage(activeDocView.pageNumber)
    if (prevAttachmentIdRef.current === activeDocView.attachmentId) return

    prevAttachmentIdRef.current = activeDocView.attachmentId
    setNumPages(0)
    setPdfData(null)
    setPdfBlobUrl(null)
    setPdfFetchError(null)
    setPdfFetching(true)

    console.log('[AdvisorPage] Fetching PDF:', {
      attachmentId: activeDocView.attachmentId,
      userId: user.id,
      baseURL: apiClient.defaults.baseURL,
    })

    apiClient
      .get<ArrayBuffer>(`/api/v1/documents/${activeDocView.attachmentId}/stream`, {
        params: { requester_user_id: user.id },
        responseType: 'arraybuffer',
      })
      .then((response) => {
        const bytes = new Uint8Array(response.data)
        const blob = new Blob([bytes], { type: 'application/pdf' })
        setPdfData({ data: bytes })
        setPdfBlobUrl(URL.createObjectURL(blob))
      })
      .catch((err: unknown) => {
        let message = 'Nieznany błąd'
        if (axios.isAxiosError(err)) {
          const status = err.response?.status ?? 0
          const data = err.response?.data
          if (data instanceof ArrayBuffer && data.byteLength > 0) {
            try {
              const text = new TextDecoder().decode(data)
              const json = JSON.parse(text) as { detail?: string }
              message = `HTTP ${status}: ${json.detail ?? text.slice(0, 120)}`
            } catch {
              message = `HTTP ${status}: ${err.message}`
            }
          } else {
            message = `HTTP ${status}: ${err.message}`
          }
        } else if (err instanceof Error) {
          message = err.message
        }
        console.error('[AdvisorPage] PDF fetch failed:', {
          attachmentId: activeDocView?.attachmentId,
          userId: user?.id,
          error: message,
          raw: err,
        })
        setPdfFetchError(message)
      })
      .finally(() => setPdfFetching(false))
  }, [activeDocView, user?.id])

  /* Revoke blob URL on cleanup */
  useEffect(() => {
    return () => {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl)
    }
  }, [pdfBlobUrl])

  /* Measure document panel width for react-pdf Page sizing */
  useLayoutEffect(() => {
    const el = docBodyRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      setDocContainerWidth(entry.contentRect.width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

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
        top_k: 5,
      })

      const assistantMsg: ChatMessage = {
        id: nextIdRef.current++,
        role: 'assistant',
        ts: new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }),
        content:
          response.ai_answer ||
          (response.chunks.length > 0
            ? response.chunks
                .map((c, i) => `**Fragment ${i + 1}:**\n"${c.highlight || c.content.substring(0, 300) + '...'}"`)
                .join('\n\n')
            : 'Niestety nie znalazłem informacji na ten temat w dostępnych dokumentach tego klienta.'),
        sources: response.chunks.map((chunk) => ({
          title: chunk.section_title || 'Dokument',
          page: chunk.page_number ? `str. ${chunk.page_number}` : 'fragment',
          attachment_id: chunk.attachment_id,
          page_number: chunk.page_number,
          highlight: chunk.highlight || chunk.content.substring(0, 300),
        })),
      }

      setMessages((prev) => [...prev, assistantMsg])
    } catch (err) {
      console.error('RAG Search failed:', err)
      setMessages((prev) => [
        ...prev,
        {
          id: nextIdRef.current++,
          role: 'assistant',
          ts: new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }),
          content:
            'Przepraszam, wystąpił błąd podczas komunikacji z serwisem AI. Upewnij się, że serwery są uruchomione i dokumenty zostały przetworzone.',
        },
      ])
    } finally {
      setIsTyping(false)
    }
  }

  const handleSourceClick = (
    attachmentId: string,
    title: string,
    pageNumber?: number | null,
    highlight?: string | null,
  ) => {
    if (!user?.id) return
    setActiveDocView({ attachmentId, pageNumber: pageNumber ?? 1, highlightText: highlight ?? null, title })
  }

  const handleDocOpen = (doc: DocumentRead) => {
    if (!user?.id) return
    setActiveDocView({ attachmentId: doc.id, pageNumber: 1, highlightText: null, title: doc.original_filename })
  }


  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Mode info modal */}
      <Modal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)} title="Tryby pracy Asystenta AI">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', gap: 14 }}>
            <div
              style={{
                width: 40, height: 40, borderRadius: 10, background: '#f5f2ef',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 20,
              }}
            >
              🔍
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1714', marginBottom: 4 }}>
                Tryb Wyszukiwania (Standard)
              </div>
              <div style={{ fontSize: 12.5, color: '#6b6b6b', lineHeight: 1.5 }}>
                Szybkie przeszukiwanie bazy wektorowej (RAG). Idealne do prostych pytań o fakty. Odpowiedź otrzymasz w
                ciągu 1-2 sekund.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14 }}>
            <div
              style={{
                width: 40, height: 40, borderRadius: 10, background: '#fff5f0',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 20,
              }}
            >
              🧠
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#e85c04', marginBottom: 4 }}>
                Tryb Rozumowania AI (Głębokie wnioskowanie)
              </div>
              <div style={{ fontSize: 12.5, color: '#6b6b6b', lineHeight: 1.5 }}>
                Model nie tylko szuka fragmentów, ale <strong>interpretuje i syntetyzuje</strong> dane z wielu źródeł.
                Proces trwa dłużej (5-10 sekund).
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsInfoModalOpen(false)}
            style={{
              padding: '12px', borderRadius: 8, border: 'none', background: '#e85c04',
              color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: 10,
            }}
          >
            Rozumiem
          </button>
        </div>
      </Modal>

      {/* Main split layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, flex: 1, minHeight: 0 }}>

        {/* ── Document Panel – Left ───────────────────────────────────── */}
        <div style={{ ...card, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Panel header */}
          <div
            style={{
              padding: '10px 14px', borderBottom: '1px solid #f2f0ed',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
            }}
          >
            {activeDocView ? (
              /* Back button + filename */
              <button
                onClick={() => setActiveDocView(null)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  color: '#9e9389', fontFamily: 'inherit', transition: 'color 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#e85c04')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#9e9389')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                <span style={{ fontSize: 11, fontWeight: 600 }}>Dokumenty</span>
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ width: 26, height: 26, borderRadius: 7, background: '#f5f2ef', border: '1px solid #e3e0db', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
                  📂
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1714', lineHeight: 1.2 }}>Dokumenty klienta</div>
                  {!docsLoading && (
                    <div style={{ fontSize: 10, color: '#9e9389' }}>
                      {customerDocs.length} {customerDocs.length === 1 ? 'plik' : 'pliki/plików'}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeDocView && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1, marginLeft: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1714', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {activeDocView.title}
                </div>
                {numPages > 0 && (
                  <div style={{ fontSize: 10, color: '#9e9389', flexShrink: 0 }}>· {numPages} str.</div>
                )}
              </div>
            )}
          </div>

          {/* Panel body: document list OR pdf viewer */}
          {activeDocView ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
              {/* Scroll container — ref here for width measurement */}
              <div
                ref={docBodyRef}
                style={{ flex: 1, overflow: 'auto', background: 'linear-gradient(160deg, #ede9e4 0%, #e4dfd9 100%)' }}
              >
                {/* Inner centering wrapper — minHeight keeps justify-center working while still allowing scroll */}
                <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '12px 4px' }}>
                  {(pdfFetching || (!pdfData && !pdfFetchError)) && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {[0, 1, 2].map((i) => (
                          <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#e85c04', animation: `dot-bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                        ))}
                      </div>
                      <div style={{ fontSize: 12, color: '#9e9389' }}>Pobieranie dokumentu...</div>
                    </div>
                  )}
                  {pdfFetchError && (
                    <PdfErrorCard message={`Nie udało się pobrać pliku (${pdfFetchError})`} blobUrl={null} />
                  )}
                  {pdfData && (
                    <div style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.18)', borderRadius: 2 }}>
                      <Document
                        file={pdfData}
                        onLoadSuccess={({ numPages: n }) => setNumPages(n)}
                        loading={null}
                        error={<PdfErrorCard message="Nie udało się wyrenderować PDF" blobUrl={pdfBlobUrl} />}
                      >
                        <Page
                          pageNumber={currentPage}
                          width={Math.max(docContainerWidth - 8, 100)}
                          renderTextLayer
                          renderAnnotationLayer
                        />
                      </Document>
                    </div>
                  )}
                </div>
              </div>

              {numPages > 0 && (
                <div style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', background: 'rgba(26,23,20,0.72)', backdropFilter: 'blur(6px)', color: 'white', fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20, pointerEvents: 'none', letterSpacing: '0.04em' }}>
                  {currentPage} / {numPages}
                </div>
              )}

              {numPages > 1 && (
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  title="Poprzednia strona"
                  style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 38, height: 38, borderRadius: '50%', background: currentPage <= 1 ? 'rgba(200,190,180,0.5)' : 'white', border: 'none', cursor: currentPage <= 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: currentPage <= 1 ? '#b5afa8' : '#1a1714', boxShadow: currentPage <= 1 ? 'none' : '0 2px 12px rgba(0,0,0,0.18)', transition: 'all 0.15s' }}
                  onMouseEnter={(e) => { if (currentPage > 1) { e.currentTarget.style.boxShadow = '0 4px 18px rgba(232,92,4,0.22)'; e.currentTarget.style.color = '#e85c04' } }}
                  onMouseLeave={(e) => { if (currentPage > 1) { e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.18)'; e.currentTarget.style.color = '#1a1714' } }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                </button>
              )}

              {numPages > 1 && (
                <button
                  onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                  disabled={currentPage >= numPages}
                  title="Następna strona"
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 38, height: 38, borderRadius: '50%', background: currentPage >= numPages ? 'rgba(200,190,180,0.5)' : 'white', border: 'none', cursor: currentPage >= numPages ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: currentPage >= numPages ? '#b5afa8' : '#1a1714', boxShadow: currentPage >= numPages ? 'none' : '0 2px 12px rgba(0,0,0,0.18)', transition: 'all 0.15s' }}
                  onMouseEnter={(e) => { if (currentPage < numPages) { e.currentTarget.style.boxShadow = '0 4px 18px rgba(232,92,4,0.22)'; e.currentTarget.style.color = '#e85c04' } }}
                  onMouseLeave={(e) => { if (currentPage < numPages) { e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.18)'; e.currentTarget.style.color = '#1a1714' } }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                </button>
              )}
            </div>
          ) : (
            /* Document list */
            docsLoading ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'linear-gradient(160deg, #fafaf9 0%, #f5f2ef 100%)' }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#e85c04', animation: `dot-bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                ))}
              </div>
            ) : (
              <DocumentList docs={customerDocs} onOpen={handleDocOpen} />
            )

          )}
        </div>

        {/* ── Chat Panel – Right ──────────────────────────────────────── */}
        <div style={{ ...card, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Chat header with context selector */}
          <div
            style={{
              padding: '10px 16px', borderBottom: '1px solid #f2f0ed',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #e85c04, #c94f02)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                🤖
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1714', lineHeight: 1.2 }}>AI Asystent</div>
                <div style={{ fontSize: 10, color: '#9e9389' }}>RAG · dokumenty klienta</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <label htmlFor={clientContextSelectId} style={{ fontSize: 11, color: '#9e9389', fontWeight: 500 }}>
                Kontekst:
              </label>
              <select
                id={clientContextSelectId}
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                style={{
                  border: '1px solid #e3e0db', borderRadius: 6,
                  padding: '5px 10px', fontSize: 12, fontWeight: 600,
                  color: '#1a1714', background: 'white', cursor: 'pointer', outline: 'none',
                }}
              >
                <option value="" disabled>Wybierz klienta...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.company_name || c.ckk}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}
              >
                {msg.role === 'assistant' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg, #e85c04, #c94f02)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
                      🤖
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#c94f02' }}>AI Asystent</span>
                    <span style={{ fontSize: 10, color: '#9e9389' }}>{msg.ts}</span>
                  </div>
                )}
                <div
                  style={{
                    maxWidth: '85%', padding: '10px 14px',
                    borderRadius: msg.role === 'user' ? '14px 14px 2px 14px' : '2px 14px 14px 14px',
                    background: msg.role === 'user' ? '#e85c04' : '#fafaf9',
                    color: msg.role === 'user' ? 'white' : '#1a1714',
                    fontSize: 13, lineHeight: 1.6,
                    border: msg.role === 'assistant' ? '1px solid #f2f0ed' : 'none',
                  }}
                >
                  {msg.content.split('\n').map((line, i) => {
                    const parts = line.split(/\*\*(.*?)\*\*/g)
                    return (
                      <p key={i} style={{ margin: i === 0 ? 0 : '4px 0 0 0' }}>
                        {parts.map((part, j) => (j % 2 === 1 ? <strong key={j}>{part}</strong> : part))}
                      </p>
                    )
                  })}
                  {msg.sources && msg.sources.length > 0 && (
                    <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #fdd5b8' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#c94f02', marginBottom: 4 }}>
                        📎 ŹRÓDŁA (KLIKNIJ ABY OTWORZYĆ)
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {msg.sources.map((src, i) => (
                          <button
                            key={i}
                            onClick={() => handleSourceClick(src.attachment_id, src.title, src.page_number, src.highlight)}
                            style={{
                              fontSize: 11, color: '#c94f02', background: 'none', border: 'none',
                              padding: 0, textAlign: 'left', cursor: 'pointer',
                              display: 'flex', gap: 4, transition: 'opacity 0.2s',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.7')}
                            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                          >
                            <span>→</span>
                            <span>
                              <strong>{src.title}</strong> · {src.page}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {msg.role === 'user' && (
                  <span style={{ fontSize: 10, color: '#9e9389', marginTop: 3 }}>{msg.ts}</span>
                )}
              </div>
            ))}
            {isTyping && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg, #e85c04, #c94f02)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
                  🤖
                </div>
                <div style={{ background: '#fafaf9', border: '1px solid #f2f0ed', borderRadius: '2px 14px 14px 14px', padding: '10px 16px', display: 'flex', gap: 4, alignItems: 'center' }}>
                  {[0, 1, 2].map((i) => (
                    <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#e85c04', animation: `dot-bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quick suggestions */}
          <div style={{ padding: '8px 16px', borderTop: '1px solid #f2f0ed', display: 'flex', gap: 6, flexWrap: 'wrap', flexShrink: 0 }}>
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                style={{
                  padding: '4px 10px', fontSize: 11, borderRadius: 20,
                  border: '1px solid #e3e0db', background: '#fafaf9',
                  color: '#4b5563', cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap',
                }}
              >
                {s.length > 45 ? s.slice(0, 42) + '…' : s}
              </button>
            ))}
          </div>

          {/* Input */}
          <div
            style={{
              padding: '16px 20px', borderTop: '1px solid #f2f0ed',
              display: 'flex', gap: 10, alignItems: 'center',
              background: 'white', flexShrink: 0,
            }}
          >
            <input
              name="assistant-question"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
              placeholder="Zadaj pytanie o klienta, umowę lub waloryzację…"
              style={{
                flex: 1, border: '1px solid #e3e0db', borderRadius: 12,
                padding: '12px 16px', fontSize: 14, outline: 'none', color: '#1a1714',
                transition: 'all 0.2s', background: '#fafaf9',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)',
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

            {/* Mode toggle */}
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: '#f5f2ef', padding: '4px', borderRadius: 14, border: '1px solid #e3e0db',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <button
                  onClick={() => setIsAiMode(false)}
                  style={{
                    padding: '8px 14px', borderRadius: 10, border: 'none',
                    background: !isAiMode ? 'white' : 'transparent',
                    color: !isAiMode ? '#1a1714' : '#9e9389',
                    fontSize: 10, fontWeight: 800, cursor: 'pointer',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: !isAiMode ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                    letterSpacing: '0.02em',
                  }}
                >
                  WYSZUKIWANIE
                </button>
                <button
                  onClick={() => setIsAiMode(true)}
                  style={{
                    padding: '8px 14px', borderRadius: 10, border: 'none',
                    background: isAiMode ? '#e85c04' : 'transparent',
                    color: isAiMode ? 'white' : '#9e9389',
                    fontSize: 10, fontWeight: 800, cursor: 'pointer',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: isAiMode ? '0 4px 12px rgba(232, 92, 4, 0.25)' : 'none',
                    letterSpacing: '0.02em',
                  }}
                >
                  ROZUMOWANIE AI
                </button>
              </div>
              <div style={{ width: 1, height: 16, background: '#e3e0db', margin: '0 2px' }} />
              <button
                onClick={() => setIsInfoModalOpen(true)}
                style={{
                  background: 'white', border: '1px solid #e3e0db', color: '#9e9389',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 28, height: 28, borderRadius: 8, transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#e85c04'; e.currentTarget.style.borderColor = '#fdd5b8' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#9e9389'; e.currentTarget.style.borderColor = '#e3e0db' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </button>
            </div>

            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isTyping}
              style={{
                background: 'linear-gradient(135deg, #e85c04, #c94f02)', border: 'none', borderRadius: 12,
                padding: '12px 20px', cursor: !input.trim() || isTyping ? 'not-allowed' : 'pointer',
                color: 'white', fontSize: 14, fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s',
                opacity: !input.trim() || isTyping ? 0.7 : 1,
                boxShadow: '0 4px 12px rgba(232, 92, 4, 0.2)',
              }}
              onMouseEnter={(e) => {
                if (!input.trim() || isTyping) return
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(232, 92, 4, 0.3)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(232, 92, 4, 0.2)'
              }}
            >
              Wyślij
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
