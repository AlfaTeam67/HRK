import type { CSSProperties } from 'react'

import { cardStyle } from '@/lib/styles'
import { useAppSelector } from '@/hooks/store'
import { useAlerts, useDashboardKpi } from '@/hooks/alerts'
import { useAlertWebSockets } from '@/hooks/useAlertWebSockets'

/* ─── Mock data (inline) ─────────────────────────────────────── */
type AlertType = 'urgent' | 'warning' | 'info' | 'neutral'

const smartPulse = [
  { name: 'Empik', badge: 'Ryzyko utraty', type: 'warn' as const },
  { name: 'Rossmann', badge: 'Wymaga uwagi', type: 'warn' as const },
  { name: 'Biedronka', badge: 'Dobra relacja', type: 'good' as const },
  { name: 'Lidl Polska', badge: 'Dobra relacja', type: 'good' as const },
]

const activity = [
  { client: 'Empik Sp. z o.o.', action: 'Spotkanie kwartalne – omówienie warunków odnowienia.', type: 'Spotkanie' as const, date: '18.03.2026', person: 'M. Janowska' },
  { client: 'Biedronka', action: 'Podpisano aneks nr 6 – aktualizacja stawek PPK', type: 'Dokument' as const, date: '15.03.2026', person: 'A. Kowalski' },
  { client: 'Rossmann', action: 'Notatka: brak odpowiedzi na wysłaną nową usługę', type: 'Notatka' as const, date: '20.03.2026', person: 'M. Janowska' },
  { client: 'Lidl Polska', action: 'Weryfikacja danych pracownika – Jan Kowalczyk', type: 'Weryfikacja' as const, date: '19.03.2026', person: 'System AI' },
]

/* ─── Style maps ─────────────────────────────────────────────── */
const ALERT_STYLE: Record<AlertType, CSSProperties> = {
  urgent: { background: '#fff5f0', border: '1px solid #fdd5b8', borderLeft: '3px solid #e85c04', borderRadius: 6, padding: '9px 14px', marginBottom: 6 },
  warning: { background: '#fffbeb', border: '1px solid #fef3c7', borderLeft: '3px solid #d69e2e', borderRadius: 6, padding: '9px 14px', marginBottom: 6 },
  info: { background: '#ebf8ff', border: '1px solid #bee3f8', borderLeft: '3px solid #3182ce', borderRadius: 6, padding: '9px 14px', marginBottom: 6 },
  neutral: { background: '#f0fff4', border: '1px solid #c6f6d5', borderLeft: '3px solid #38a169', borderRadius: 6, padding: '9px 14px', marginBottom: 6 },
}

const BADGE_STYLE: Record<typeof activity[number]['type'], CSSProperties> = {
  Spotkanie: { background: '#fff5f0', color: '#c94f02', fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600 },
  Dokument: { background: '#fef3c7', color: '#92400e', fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600 },
  Notatka: { background: '#f3f4f6', color: '#374151', fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600 },
  Weryfikacja: { background: '#f0fff4', color: '#276749', fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600 },
}

const card: CSSProperties = cardStyle

/* ─── Component ──────────────────────────────────────────────── */
export function DashboardPage() {
  const today = new Intl.DateTimeFormat('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())
  const user = useAppSelector((s) => s.auth.user)
  const firstName = user?.displayName.split(' ')[0] ?? 'użytkowniku'

  const { data: kpiData, refetch: refetchKpi } = useDashboardKpi(user?.id)
  const { data: realAlerts, refetch: refetchAlerts } = useAlerts(user?.id)
  const { isConnected } = useAlertWebSockets(user?.id)

  const kpis = kpiData ? [
    { label: 'AKTYWNYCH KLIENTÓW', value: String(kpiData.active_customers), trend: 'aktualne dane', trendUp: true },
    { label: 'AKTYWNYCH UMÓW', value: String(kpiData.active_contracts), trend: `♦ ${kpiData.contracts_expiring_30d} kończy się w 30 dni`, trendUp: kpiData.contracts_expiring_30d === 0 },
    { label: 'WALORYZACJE DO ZROBIENIA', value: String(kpiData.valorizations_pending), trend: `⚡ ${kpiData.valorizations_overdue} po terminie`, trendUp: kpiData.valorizations_overdue === 0 },
    { label: 'PRACOWNICY (ŁĄCZNIE)', value: '—', trend: 'dane wkrótce', trendUp: true },
  ] : []

  const severityToType: Record<string, AlertType> = {
    urgent: 'urgent',
    high: 'warning',
    medium: 'info'
  }

  const alerts = realAlerts?.map(a => ({
    type: severityToType[a.severity] || 'neutral',
    title: a.title,
    detail: a.detail
  })) || []

  const urgentCount = alerts.filter(a => a.type === 'urgent').length

  return (
    <div style={{ width: '100%' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 12, color: '#9e9389', textTransform: 'capitalize' }}>{today}</div>
          {isConnected && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f0fff4', padding: '2px 8px', borderRadius: 4, border: '1px solid #c6f6d5' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#38a169' }} />
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => { refetchKpi(); refetchAlerts(); }}
            style={{ background: 'white', border: '1px solid #e3e0db', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', color: '#6b6b6b', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            Odśwież
          </button>
          <button style={{ background: '#e85c04', border: 'none', borderRadius: 6, padding: '6px 16px', cursor: 'pointer', color: 'white', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Nowy aneks
          </button>
        </div>
      </div>

      {/* Greeting */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1714', margin: 0, marginBottom: 4 }}>Dzień dobry, {firstName}</h1>
        <p style={{ fontSize: 12.5, color: '#9e9389', margin: 0 }}>Masz {alerts.length} alerty wymagające uwagi dzisiaj.</p>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        {kpis.map((kpi) => (
          <div key={kpi.label} style={{ ...card, padding: '16px 18px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#9e9389', letterSpacing: '0.07em', marginBottom: 8 }}>{kpi.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#1a1714', marginBottom: 6, lineHeight: 1 }}>{kpi.value}</div>
            <div style={{ fontSize: 11, color: kpi.trendUp ? '#38a169' : '#e85c04' }}>{kpi.trend}</div>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
        {/* Left */}
        <div>
          {/* Alerts */}
          <div style={{ ...card, padding: '16px 18px', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1714' }}>Alerty i terminy</div>
              <span style={{ background: '#e85c04', color: 'white', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{urgentCount} pilne</span>
            </div>
            {realAlerts === undefined ? (
              <div style={{ fontSize: 13, color: '#6b6b6b' }}>Ładowanie alertów...</div>
            ) : alerts.length === 0 ? (
              <div style={{ fontSize: 13, color: '#6b6b6b' }}>Brak alertów.</div>
            ) : (
              alerts.map((a, index) => (
                <div key={`${a.type}-${a.title}-${a.detail}-${index}`} style={ALERT_STYLE[a.type]}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1714', marginBottom: 2 }}>{a.title}</div>
                  <div style={{ fontSize: 11.5, color: '#6b6b6b' }}>{a.detail}</div>
                </div>
              ))
            )}
          </div>

          {/* Activity table */}
          <div style={{ ...card, padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1714' }}>Ostatnia aktywność</div>
              <span style={{ fontSize: 12, color: '#e85c04', cursor: 'pointer', fontWeight: 600 }}>Zobacz wszystkie</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>{['KLIENT', 'ZDARZENIE', 'TYP', 'DATA', 'OSOBA'].map(col => (
                  <th key={col} style={{ textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#9e9389', letterSpacing: '0.07em', paddingBottom: 8, borderBottom: '1px solid #f2f0ed' }}>{col}</th>
                ))}</tr>
              </thead>
              <tbody>
                {activity.map((row, i) => (
                  <tr key={i} style={{ borderBottom: i < activity.length - 1 ? '1px solid #f9f8f6' : 'none' }}>
                    <td style={{ padding: '10px 0', fontWeight: 700, color: '#1a1714', whiteSpace: 'nowrap' }}>{row.client}</td>
                    <td style={{ padding: '10px 12px 10px 8px', color: '#4b5563', maxWidth: 240 }}>{row.action}</td>
                    <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}><span style={BADGE_STYLE[row.type]}>{row.type}</span></td>
                    <td style={{ padding: '10px 8px', color: '#9e9389', whiteSpace: 'nowrap', fontSize: 12 }}>{row.date}</td>
                    <td style={{ padding: '10px 0', color: '#9e9389', whiteSpace: 'nowrap', fontSize: 12 }}>{row.person}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Smart Pulse */}
        <div>
          <div style={{ ...card, padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1714' }}>Smart Pulse – relacje</div>
              <span style={{ background: '#e85c04', color: 'white', fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 20, letterSpacing: '0.05em' }}>AI</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {smartPulse.map((item) => (
                <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f9f8f6' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: item.type === 'good' ? '#38a169' : '#e85c04', flexShrink: 0, display: 'inline-block' }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1714' }}>{item.name}</span>
                  </div>
                  <span style={item.type === 'good'
                    ? { fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#f0fff4', color: '#276749', fontWeight: 500 }
                    : { fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#fff5f0', color: '#c94f02', fontWeight: 500 }
                  }>{item.badge}</span>
                </div>
              ))}
            </div>
            {/* AI tip */}
            <div style={{ marginTop: 16, background: '#fff5f0', border: '1px solid #fdd5b8', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#c94f02', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="#c94f02"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" /></svg>
                Rekomendacja AI
              </div>
              <div style={{ fontSize: 11.5, color: '#9a3d02', lineHeight: 1.5 }}>
                Zadzwoń do Rossmann – brak kontaktu od 87 dni. Ryzyko rozejścia umowy.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
