import type { CSSProperties } from 'react'

import { cardStyle } from '@/lib/styles'
import { useAppSelector } from '@/hooks/store'

/* ─── Mock data (inline) ─────────────────────────────────────── */
const kpis = [
  { label: 'AKTYWNYCH KLIENTÓW', value: '12', trend: '+2 nowych w tym kwartale', trendUp: true },
  { label: 'AKTYWNYCH UMÓW', value: '18', trend: '♦ 3 kończą się w tym miesiącu', trendUp: false },
  { label: 'WALORYZACJE DO ZROBIENIA', value: '3', trend: '⚡ 1 po terminie', trendUp: false },
  { label: 'PRACOWNICY (ŁĄCZNIE)', value: '1 847', trend: '▲ 54 od ostatniego miesiąca', trendUp: true },
]

type AlertType = 'urgent' | 'warning' | 'info' | 'neutral'
const alerts: Array<{ type: AlertType; title: string; detail: string }> = [
  { type: 'urgent',  title: 'Empik – umowa kończy się za 28 dni',      detail: 'Umowa nr 000123/43 · data wypowiedzenia: 30 dni' },
  { type: 'warning', title: 'Waloryzacja po terminie – MediaMarkt',     detail: 'Planowana na 01.03.2026 · brak reakcji' },
  { type: 'urgent',  title: 'TechNova – błąd w rozliczeniu PPK',        detail: 'Niezgodność składek dla 12 pracowników · wymagana korekta' },
  { type: 'info',    title: 'Rossmann – brak kontaktu od 87 dni',       detail: 'Ostatni kontakt: 04.01.2026' },
  { type: 'neutral', title: 'Biedronka – waloryzacja za 14 dni',        detail: 'GUS inflacja: 4,5% · sugestia według gotowe' },
  { type: 'warning', title: 'Lidl – brak podpisanego aneksu nr 4',      detail: 'Wysłano 10.02.2026 · status: weryfikacja prawna' },
  { type: 'info',    title: 'Nowe zapytanie – Carrefour',               detail: 'Klient pyta o rozszerzenie outsourcingu IT' },
]

const smartPulse = [
  { name: 'Empik',      badge: 'Ryzyko utraty', type: 'warn' as const },
  { name: 'Rossmann',   badge: 'Wymaga uwagi',  type: 'warn' as const },
  { name: 'Biedronka',  badge: 'Dobra relacja', type: 'good' as const },
  { name: 'Lidl Polska',badge: 'Dobra relacja', type: 'good' as const },
  { name: 'MediaMarkt', badge: 'Negocjacje',    type: 'warn' as const },
  { name: 'TechNova',   badge: 'Wzrost skali',  type: 'good' as const },
]

const activity = [
  { client: 'Empik Sp. z o.o.', action: 'Spotkanie kwartalne – omówienie warunków odnowienia.',   type: 'Spotkanie'   as const, date: '18.03.2026', person: 'M. Janowska' },
  { client: 'Biedronka',        action: 'Podpisano aneks nr 6 – aktualizacja stawek PPK',          type: 'Dokument'    as const, date: '15.03.2026', person: 'A. Kowalski' },
  { client: 'Rossmann',         action: 'Notatka: brak odpowiedzi na wysłaną nową usługę',         type: 'Notatka'     as const, date: '20.03.2026', person: 'M. Janowska' },
  { client: 'Lidl Polska',      action: 'Weryfikacja danych pracownika – Jan Kowalczyk',           type: 'Weryfikacja' as const, date: '19.03.2026', person: 'System AI'   },
  { client: 'MediaMarkt',       action: 'Wysłano ofertę na obsługę kadr i płac (nowy moduł)',     type: 'Dokument'    as const, date: '21.03.2026', person: 'T. Nowak'     },
  { client: 'TechNova',         action: 'Telefoniczne potwierdzenie warunków SLA na kwiecień',     type: 'Spotkanie'   as const, date: '21.03.2026', person: 'M. Nowak'     },
  { client: 'Carrefour',        action: 'Założono kartę klienta – nowe zapytanie ofertowe',        type: 'Notatka'     as const, date: '22.03.2026', person: 'K. Lis'       },
]

/* ─── Style maps ─────────────────────────────────────────────── */
const ALERT_STYLE: Record<AlertType, CSSProperties> = {
  urgent:  { background: '#fff5f0', border: '1px solid #fdd5b8', borderLeft: '3px solid #e85c04', borderRadius: 6, padding: '9px 14px', marginBottom: 6 },
  warning: { background: '#fffbeb', border: '1px solid #fef3c7', borderLeft: '3px solid #d69e2e', borderRadius: 6, padding: '9px 14px', marginBottom: 6 },
  info:    { background: '#ebf8ff', border: '1px solid #bee3f8', borderLeft: '3px solid #3182ce', borderRadius: 6, padding: '9px 14px', marginBottom: 6 },
  neutral: { background: '#f0fff4', border: '1px solid #c6f6d5', borderLeft: '3px solid #38a169', borderRadius: 6, padding: '9px 14px', marginBottom: 6 },
}

const BADGE_STYLE: Record<typeof activity[number]['type'], CSSProperties> = {
  Spotkanie:   { background: '#fff5f0', color: '#c94f02', fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600 },
  Dokument:    { background: '#fef3c7', color: '#92400e', fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600 },
  Notatka:     { background: '#f3f4f6', color: '#374151', fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600 },
  Weryfikacja: { background: '#f0fff4', color: '#276749', fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600 },
}

const card: CSSProperties = cardStyle

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'

/* ─── Component ──────────────────────────────────────────────── */
export function DashboardPage() {
  const [isAnnexModalOpen, setIsAnnexModalOpen] = useState(false)
  const today = new Intl.DateTimeFormat('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())
  const user = useAppSelector((s) => s.auth.user)
  const firstName = user?.displayName.split(' ')[0] ?? 'użytkowniku'

  return (
    <div style={{ width: '100%' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: '#9e9389', textTransform: 'capitalize' }}>{today}</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={{ background: 'white', border: '1px solid #e3e0db', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', color: '#6b6b6b', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            Odśwież
          </button>
          <button 
            onClick={() => setIsAnnexModalOpen(true)}
            style={{ background: '#e85c04', border: 'none', borderRadius: 6, padding: '6px 16px', cursor: 'pointer', color: 'white', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Generuj aneks
          </button>
        </div>
      </div>

      <Modal isOpen={isAnnexModalOpen} onClose={() => setIsAnnexModalOpen(false)} title="Generuj aneks do umowy">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#4a4340' }}>Wybierz klienta</label>
            <select style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #e3e0db', fontSize: 13, outline: 'none' }}>
              <option>Empik Sp. z o.o. (HRK/EMP/2024/07)</option>
              <option>Rossmann Polska (HRK/ROS/2025/01)</option>
              <option>Biedronka (HRK/BIE/2024/03)</option>
              <option>Lidl Polska (HRK/LID/2024/08)</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#4a4340' }}>Powód aneksu</label>
            <select style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #e3e0db', fontSize: 13, outline: 'none' }}>
              <option>Waloryzacja (inflacja/GUS)</option>
              <option>Zmiana stawek za usługę</option>
              <option>Przedłużenie okresu obowiązywania</option>
              <option>Zmiana warunków SLA</option>
              <option>Inny...</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#4a4340' }}>Data obowiązywania</label>
              <input type="date" defaultValue="2026-04-01" style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #e3e0db', fontSize: 13, outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#4a4340' }}>Nowa stawka (opcjonalnie)</label>
              <input type="text" placeholder="np. 4500 PLN" style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #e3e0db', fontSize: 13, outline: 'none' }} />
            </div>
          </div>

          <div style={{ background: '#f5f2ef', padding: '12px', borderRadius: 8, border: '1px solid #e3e0db' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#e85c04', marginBottom: 4 }}>💡 Podpowiedź AI</div>
            <div style={{ fontSize: 11, color: '#6b6b6b', lineHeight: 1.4 }}>
              Dla klienta Empik sugerowana waloryzacja wynosi <strong>4.8%</strong> (zgodnie z komunikatem GUS ze stycznia).
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <button 
              onClick={() => setIsAnnexModalOpen(false)}
              style={{ flex: 1, padding: '10px', borderRadius: 6, border: '1px solid #e3e0db', background: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Anuluj
            </button>
            <button 
              onClick={() => setIsAnnexModalOpen(false)}
              style={{ flex: 1, padding: '10px', borderRadius: 6, border: 'none', background: '#e85c04', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Generuj dokument
            </button>
          </div>
        </div>
      </Modal>

      {/* Greeting */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1714', margin: 0, marginBottom: 4 }}>Dzień dobry, {firstName}</h1>
        <p style={{ fontSize: 12.5, color: '#9e9389', margin: 0 }}>Masz 3 alerty wymagające uwagi dzisiaj.</p>
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
              <span style={{ background: '#e85c04', color: 'white', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>3 pilne</span>
            </div>
            {alerts.map((a) => (
              <div key={a.title} style={ALERT_STYLE[a.type]}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1714', marginBottom: 2 }}>{a.title}</div>
                <div style={{ fontSize: 11.5, color: '#6b6b6b' }}>{a.detail}</div>
              </div>
            ))}
          </div>

          {/* Activity table */}
          <div style={{ ...card, padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1714' }}>Ostatnia aktywność</div>
              <span style={{ fontSize: 12, color: '#e85c04', cursor: 'pointer', fontWeight: 600 }}>Zobacz wszystkie</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>{['KLIENT','ZDARZENIE','TYP','DATA','OSOBA'].map(col => (
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
                <svg width="11" height="11" viewBox="0 0 24 24" fill="#c94f02"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
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
