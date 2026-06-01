import { useState } from 'react'
import { useAppSelector } from '@/hooks/store'
import {
  useActivityLog,
  type ActivityLogReportItem,
  type ActivityReportPeriod,
} from '@/hooks/useActivityLog'
import { cardStyle as card } from '@/lib/styles'
import type { components } from '@/types/api'

type ActivityType = components['schemas']['ActivityType']

const PERIODS: { label: string; value: ActivityReportPeriod }[] = [
  { label: 'Ostatnie 7 dni',    value: 7   },
  { label: 'Ostatnie 30 dni',   value: 30  },
  { label: 'Ostatnie 90 dni',   value: 90  },
  { label: 'Ostatnie pół roku', value: 180 },
  { label: 'Ostatni rok',       value: 365 },
]

const ACTIVITY_TYPES: { label: string; value: ActivityType }[] = [
  { label: 'Spotkanie',    value: 'meeting'      },
  { label: 'E-mail',       value: 'email'        },
  { label: 'Notatka',      value: 'note'         },
  { label: 'Dokument',     value: 'document'     },
  { label: 'Weryfikacja',  value: 'verification' },
  { label: 'Telefon',      value: 'call'         },
  { label: 'System',       value: 'system'       },
]

const TYPE_BADGE: Record<ActivityType, { bg: string; color: string; label: string; dot: string }> = {
  meeting:      { bg: '#ebf8ff', color: '#2b6cb0', label: 'Spotkanie',   dot: '#3182ce' },
  email:        { bg: '#f0fff4', color: '#276749', label: 'E-mail',      dot: '#38a169' },
  note:         { bg: '#f3f4f6', color: '#374151', label: 'Notatka',     dot: '#718096' },
  document:     { bg: '#fff5f0', color: '#c94f02', label: 'Dokument',    dot: '#e85c04' },
  verification: { bg: '#fffbeb', color: '#92400e', label: 'Weryfikacja', dot: '#d69e2e' },
  call:         { bg: '#faf5ff', color: '#6b21a8', label: 'Telefon',     dot: '#9f7aea' },
  system:       { bg: '#f1f5f9', color: '#475569', label: 'System',      dot: '#94a3b8' },
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const date = d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const time = d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
  return `${date}, ${time}`
}

interface KpiCardProps { label: string; value: number; color: string; icon: string }

function KpiCard({ label, value, color, icon }: KpiCardProps) {
  return (
    <div style={{ ...card, padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#9b8f87', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
            {label}
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#1a1714', lineHeight: 1 }}>
            {value}
          </div>
        </div>
        <div style={{ fontSize: 22, opacity: 0.15 }}>{icon}</div>
      </div>
    </div>
  )
}

function LogRow({ item, idx, total }: { item: ActivityLogReportItem; idx: number; total: number }) {
  const badge = TYPE_BADGE[item.activity_type] ?? { bg: '#f3f4f6', color: '#374151', label: item.activity_type, dot: '#718096' }
  const isLast = idx === total - 1

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '14px 1fr',
      gap: 0,
      padding: '0 20px',
      position: 'relative',
    }}>
      {/* Timeline line */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 14 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: badge.dot, flexShrink: 0, border: '2px solid white', boxShadow: `0 0 0 2px ${badge.dot}33` }} />
        {!isLast && <div style={{ width: 1, flexGrow: 1, background: '#e8e4e0', marginTop: 4 }} />}
      </div>

      {/* Content */}
      <div style={{
        paddingLeft: 14,
        paddingBottom: isLast ? 16 : 20,
        paddingTop: 10,
        borderBottom: !isLast ? '1px solid #f5f3f1' : 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          {/* Badge */}
          <span style={{
            fontSize: 10, padding: '2px 7px', borderRadius: 4,
            fontWeight: 700, background: badge.bg, color: badge.color,
            letterSpacing: '0.04em',
          }}>
            {badge.label}
          </span>

          {/* User */}
          <span style={{
            fontSize: 12, fontWeight: item.is_own ? 700 : 500,
            color: item.is_own ? '#e85c04' : '#374151',
          }}>
            {item.performed_by_login ?? 'System'}
            {item.is_own && <span style={{ fontSize: 10, fontWeight: 400, color: '#e85c04', marginLeft: 4, opacity: 0.8 }}>(Ty)</span>}
          </span>

          {/* Time */}
          <span style={{ fontSize: 11, color: '#a09890', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
            {formatDate(item.activity_date)}
          </span>
        </div>

        {/* Description */}
        <div style={{ fontSize: 13, color: '#2d2825', lineHeight: 1.4 }}>
          {item.description}
        </div>
      </div>
    </div>
  )
}

const SELECT: React.CSSProperties = {
  border: '1px solid #e3e0db',
  borderRadius: 6,
  padding: '7px 30px 7px 11px',
  fontSize: 13,
  color: '#1a1714',
  background: 'white',
  outline: 'none',
  cursor: 'pointer',
  appearance: 'none' as const,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237a6f67' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 10px center',
}

const LIMIT = 50

export function ReportsPage() {
  const user = useAppSelector((s) => s.auth.user)
  const isAdmin = user?.department === 'Administrator IT'

  const [period, setPeriod] = useState<ActivityReportPeriod>(30)
  const [activityType, setActivityType] = useState<ActivityType | ''>('')
  const [offset, setOffset]   = useState(0)

  const { data, isLoading, isError } = useActivityLog({
    period,
    activity_type: activityType || undefined,
    limit: LIMIT,
    offset,
  })

  const kpi   = data?.kpi
  const items = data?.items ?? []
  const total = data?.total ?? 0

  return (
    <div style={{ width: '100%' }}>

      {/* Header + filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1a1714', margin: 0, marginBottom: 2 }}>Aktywności</h1>
          <p style={{ fontSize: 12.5, color: '#9b8f87', margin: 0 }}>
            {isAdmin ? 'Wszystkie operacje w systemie.' : 'Twoje działania i działania na Twoich klientach.'}
          </p>
        </div>

        {/* Period dropdown */}
        <div style={{ position: 'relative' }}>
          <select
            value={period}
            onChange={(e) => { setPeriod(Number(e.target.value) as ActivityReportPeriod); setOffset(0) }}
            style={SELECT}
          >
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        {/* Activity type dropdown */}
        <div style={{ position: 'relative' }}>
          <select
            value={activityType}
            onChange={(e) => { setActivityType(e.target.value as ActivityType | ''); setOffset(0) }}
            style={SELECT}
          >
            <option value=''>Wszystkie typy</option>
            {ACTIVITY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        <KpiCard label='Zdarzeń'         value={kpi?.events_count   ?? 0} color='#3182ce' icon='📊' />
        <KpiCard label='Spotkania'        value={kpi?.meetings_count  ?? 0} color='#e85c04' icon='🤝' />
        <KpiCard label='Dokumenty'        value={kpi?.documents_count ?? 0} color='#38a169' icon='📄' />
        <KpiCard label='Notatki'          value={kpi?.notes_count     ?? 0} color='#9f7aea' icon='📝' />
      </div>

      {/* Timeline log */}
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f0ece8', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1714' }}>Oś czasu</div>
            <div style={{ fontSize: 12, color: '#9b8f87', marginTop: 1 }}>
              {isLoading ? 'Ładowanie…' : total === 0 ? 'Brak zdarzeń' : `${total} zdarzeń`}
            </div>
          </div>
          {!isAdmin && (
            <div style={{ fontSize: 11, color: '#9b8f87', background: '#f5f3f1', borderRadius: 5, padding: '4px 10px' }}>
              Twoje + Twoich klientów
            </div>
          )}
        </div>

        {isError && (
          <div style={{ padding: 24, textAlign: 'center', color: '#e53e3e', fontSize: 13 }}>
            Błąd ładowania danych.
          </div>
        )}
        {isLoading && (
          <div style={{ padding: 24, textAlign: 'center', color: '#9b8f87', fontSize: 13 }}>
            Ładowanie…
          </div>
        )}
        {!isLoading && !isError && items.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: '#9b8f87', fontSize: 13 }}>
            Brak danych dla wybranego okresu.
          </div>
        )}

        {items.length > 0 && (
          <div style={{ padding: '8px 0 0' }}>
            {items.map((item, i) => (
              <LogRow key={item.id} item={item} idx={i} total={items.length} />
            ))}
          </div>
        )}

        {total > LIMIT && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid #f0ece8', display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
            <button
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - LIMIT))}
              style={{ border: '1px solid #e3e0db', borderRadius: 6, padding: '5px 14px', cursor: offset === 0 ? 'not-allowed' : 'pointer', color: '#6b6b6b', background: 'white', opacity: offset === 0 ? 0.4 : 1 }}
            >← Poprzednia</button>
            <span style={{ color: '#9b8f87', minWidth: 120, textAlign: 'center' }}>
              {offset + 1}–{Math.min(offset + LIMIT, total)} z {total}
            </span>
            <button
              disabled={offset + LIMIT >= total}
              onClick={() => setOffset(offset + LIMIT)}
              style={{ border: '1px solid #e3e0db', borderRadius: 6, padding: '5px 14px', cursor: offset + LIMIT >= total ? 'not-allowed' : 'pointer', color: '#6b6b6b', background: 'white', opacity: offset + LIMIT >= total ? 0.4 : 1 }}
            >Następna →</button>
          </div>
        )}
      </div>
    </div>
  )
}
