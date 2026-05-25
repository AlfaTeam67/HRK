import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import axios from 'axios'

import { apiClient } from '@/lib/axios'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

interface Props {
  attachmentId: string
  title: string
  userId: string
  onClose: () => void
}

const ZOOM_STEP = 0.25
const ZOOM_MIN = 0.5
const ZOOM_MAX = 3.0

export function PdfPreviewModal({ attachmentId, title, userId, onClose }: Props) {
  const [pdfData, setPdfData] = useState<{ data: Uint8Array } | null>(null)
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [containerSize, setContainerSize] = useState({ width: 700, height: 700 })
  const [zoom, setZoom] = useState(1.0)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    apiClient
      .get<ArrayBuffer>(`/api/v1/documents/${attachmentId}/stream`, {
        params: { requester_user_id: userId },
        responseType: 'arraybuffer',
      })
      .then((res) => {
        const bytes = new Uint8Array(res.data)
        const blob = new Blob([bytes], { type: 'application/pdf' })
        setPdfData({ data: bytes })
        setPdfBlobUrl(URL.createObjectURL(blob))
      })
      .catch((err: unknown) => {
        let msg = 'Nieznany błąd'
        if (axios.isAxiosError(err)) {
          msg = `HTTP ${err.response?.status ?? 0}: ${err.message}`
        } else if (err instanceof Error) {
          msg = err.message
        }
        setError(msg)
      })
      .finally(() => setFetching(false))
  }, [attachmentId, userId])

  useEffect(() => {
    return () => {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl)
    }
  }, [pdfBlobUrl])

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(([entry]) => {
      setContainerSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  function handleZoomIn() {
    setZoom((z) => Math.min(ZOOM_MAX, Math.round((z + ZOOM_STEP) * 100) / 100))
  }

  function handleZoomOut() {
    setZoom((z) => Math.max(ZOOM_MIN, Math.round((z - ZOOM_STEP) * 100) / 100))
  }

  function handleZoomReset() {
    setZoom(1.0)
  }

  const pageHeight = Math.max(containerSize.height - 32, 100)
  const canPrev = currentPage > 1
  const canNext = currentPage < numPages

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        background: 'rgba(26,23,20,0.6)', backdropFilter: 'blur(3px)',
        display: 'flex', flexDirection: 'column',
      }}
      onClick={onClose}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', background: 'white', flexShrink: 0,
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title */}
        <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1714', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300, flexShrink: 1 }}>
          {title}
        </span>

        {/* Center: page counter */}
        {numPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
            <span style={{ fontSize: 12, color: '#6b6b6b', minWidth: 56, textAlign: 'center' }}>
              {currentPage} / {numPages}
            </span>
          </div>
        )}

        {/* Right: zoom + download + close */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {pdfData && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button onClick={handleZoomOut} disabled={zoom <= ZOOM_MIN} style={navBtn(zoom <= ZOOM_MIN)} title="Pomniejsz">−</button>
              <button
                onClick={handleZoomReset}
                style={{ fontSize: 11, fontWeight: 600, color: '#6b6361', background: '#f5f2ef', border: '1px solid #e3e0db', borderRadius: 5, padding: '3px 8px', cursor: 'pointer', minWidth: 44, textAlign: 'center' }}
              >
                {Math.round(zoom * 100)}%
              </button>
              <button onClick={handleZoomIn} disabled={zoom >= ZOOM_MAX} style={navBtn(zoom >= ZOOM_MAX)} title="Powiększ">+</button>
            </div>
          )}
          {pdfBlobUrl && (
            <a
              href={pdfBlobUrl}
              download={title}
              style={{
                fontSize: 11, fontWeight: 600, color: '#e85c04', textDecoration: 'none',
                padding: '4px 10px', border: '1px solid #fdd5b8', borderRadius: 5, background: '#fff8f4',
              }}
            >
              Pobierz
            </a>
          )}
          <button
            onClick={onClose}
            style={{
              background: 'none', border: '1px solid #e3e0db', borderRadius: 5,
              padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: '#6b6361',
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* PDF body */}
      <div
        ref={containerRef}
        style={{
          flex: 1, overflow: 'auto',
          background: 'linear-gradient(160deg, #ede9e4 0%, #e4dfd9 100%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: fetching || error || !pdfData ? 'center' : 'flex-start',
          padding: '16px 4px',
        }}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={handleZoomIn}
      >
        {fetching && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    width: 7, height: 7, borderRadius: '50%', background: '#e85c04',
                    animation: `dot-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }}
                />
              ))}
            </div>
            <div style={{ fontSize: 12, color: '#9e9389' }}>Pobieranie dokumentu...</div>
          </div>
        )}

        {error && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, opacity: 0.3, marginBottom: 10 }}>⚠️</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#c94f02' }}>Nie udało się pobrać pliku</div>
            <div style={{ fontSize: 11, color: '#9e9389', marginTop: 4, maxWidth: 280 }}>{error}</div>
          </div>
        )}

        {pdfData && (
          <div style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.18)', borderRadius: 2, transformOrigin: 'top center', transform: `scale(${zoom})`, marginBottom: zoom > 1 ? `${(zoom - 1) * pageHeight}px` : 0 }}>
            <Document
              file={pdfData}
              onLoadSuccess={({ numPages: n }) => setNumPages(n)}
              loading={null}
              error={
                <div style={{ padding: '32px 24px', textAlign: 'center', color: '#c94f02', fontSize: 13, fontWeight: 600 }}>
                  Nie udało się wyrenderować PDF
                </div>
              }
            >
              <Page
                pageNumber={currentPage}
                height={pageHeight}
                renderTextLayer
                renderAnnotationLayer
              />
            </Document>
          </div>
        )}
      </div>

      {numPages > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setCurrentPage((p) => Math.max(1, p - 1))
            }}
            disabled={!canPrev}
            style={sideNavBtn(!canPrev, 'left')}
            aria-label="Poprzednia strona"
          >
            ←
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setCurrentPage((p) => Math.min(numPages, p + 1))
            }}
            disabled={!canNext}
            style={sideNavBtn(!canNext, 'right')}
            aria-label="Następna strona"
          >
            →
          </button>
        </>
      )}
    </div>
  )
}

function navBtn(disabled: boolean): React.CSSProperties {
  return {
    background: disabled ? '#f5f2ef' : 'white',
    border: '1px solid #e3e0db', borderRadius: 5,
    width: 26, height: 26, padding: 0,
    cursor: disabled ? 'not-allowed' : 'pointer',
    color: disabled ? '#c8c2ba' : '#1a1714',
    fontSize: 14, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }
}

function sideNavBtn(disabled: boolean, side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'fixed',
    top: '50%',
    transform: 'translateY(-50%)',
    ...(side === 'left' ? { left: 16 } : { right: 16 }),
    background: disabled ? 'rgba(245,242,239,0.9)' : 'rgba(255,255,255,0.95)',
    border: '1px solid #e3e0db',
    borderRadius: 999,
    width: 36,
    height: 36,
    padding: 0,
    cursor: disabled ? 'not-allowed' : 'pointer',
    color: disabled ? '#c8c2ba' : '#1a1714',
    fontSize: 16,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 6px 18px rgba(0,0,0,0.15)',
    zIndex: 1202,
  }
}
