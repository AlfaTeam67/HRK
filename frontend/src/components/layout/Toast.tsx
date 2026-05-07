import { useEffect, useState } from 'react'

import { type AppNotification, registerSubscriber } from '@/lib/notifications'

const TYPE_STYLE: Record<string, { bg: string; border: string; icon: string; iconColor: string }> = {
  error:   { bg: '#fff5f0', border: '#fdd5b8', icon: '✕', iconColor: '#c94f02' },
  warning: { bg: '#fffbeb', border: '#fbd38d', icon: '!', iconColor: '#92400e' },
  info:    { bg: '#ebf8ff', border: '#bee3f8', icon: 'i', iconColor: '#2b6cb0' },
}

interface ToastItemProps {
  notification: AppNotification
  onDismiss: (id: string) => void
}

function ToastItem({ notification: n, onDismiss }: ToastItemProps) {
  const s = TYPE_STYLE[n.type] ?? TYPE_STYLE.error
  return (
    <div
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        background: s.bg, border: `1px solid ${s.border}`,
        borderRadius: 10, padding: '12px 14px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.10)',
        minWidth: 300, maxWidth: 400,
        fontFamily: "'Figtree Variable', sans-serif",
        animation: 'slideInRight 0.2s ease',
      }}
    >
      <div style={{
        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
        background: s.iconColor + '20', color: s.iconColor,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 800,
      }}>
        {s.icon}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1714' }}>{n.title}</div>
        {n.description && (
          <div style={{ fontSize: 12, color: '#6b6b6b', marginTop: 2, lineHeight: 1.4 }}>
            {n.description}
          </div>
        )}
      </div>

      <button
        onClick={() => onDismiss(n.id)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#9e9389', fontSize: 14, padding: 2, flexShrink: 0, lineHeight: 1,
        }}
        aria-label="Zamknij"
      >
        ×
      </button>
    </div>
  )
}

export function Toast() {
  const [notifications, setNotifications] = useState<AppNotification[]>([])

  useEffect(() => {
    registerSubscriber((n) => {
      setNotifications((prev) => [...prev, n].slice(-4))
      setTimeout(() => {
        setNotifications((prev) => prev.filter((x) => x.id !== n.id))
      }, 5000)
    })
    return () => registerSubscriber(null)
  }, [])

  function dismiss(id: string) {
    setNotifications((prev) => prev.filter((x) => x.id !== id))
  }

  if (notifications.length === 0) return null

  return (
    <>
      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
      <div style={{
        position: 'fixed', top: 20, right: 20,
        display: 'flex', flexDirection: 'column', gap: 8,
        zIndex: 9999, pointerEvents: 'none',
      }}>
        {notifications.map((n) => (
          <div key={n.id} style={{ pointerEvents: 'all' }}>
            <ToastItem notification={n} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </>
  )
}
