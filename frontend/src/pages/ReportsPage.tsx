/* ─── Mock data (inline) ─────────────────────────────────────── */
const kpis = [
  { label: 'ZDARZEŃ W TYM MIESIĄCU', value: '247', sub: '+23 vs. poprz. miesiąc', color: '#3182ce' },
  { label: 'ZMIANY STATUSÓW',        value: '48',  sub: 'umów i klientów',        color: '#e85c04' },
  { label: 'AKCEPTACJE',             value: '19',  sub: 'waloryzacji i aneksów',  color: '#38a169' },
  { label: 'EKSPORTY DANYCH',        value: '12',  sub: 'pliki PDF/XLSX',         color: '#d69e2e' },
]

const log = [
  { ts: '2026-04-13 12:45', user: 'M. Janowska',  action: 'Zmiana statusu umowy',      detail: 'HRK/EMP/2024/07 → "Do odnowienia"',           type: 'change'  as const },
  { ts: '2026-04-13 11:10', user: 'M. Nowak',      action: 'Zatwierdzenie waloryzacji', detail: 'Empik +5,2% – zaakceptowane',                 type: 'approve' as const },
  { ts: '2026-04-13 09:32', user: 'System',         action: 'Alert automatyczny',       detail: 'HRK/EMP/2024/07 – 30 dni do końca umowy',     type: 'system'  as const },
  { ts: '2026-04-12 16:55', user: 'A. Kowalski',   action: 'Dodanie notatki',           detail: 'Biedronka – spotkanie kwartalne zaplanowane',  type: 'note'    as const },
  { ts: '2026-04-12 14:20', user: 'K. Lis',        action: 'Eksport raportu',           detail: 'Raport waloryzacji Q1 2026 – PDF',             type: 'export'  as const },
  { ts: '2026-04-11 10:03', user: 'A. Wiśniewska', action: 'Podgląd dokumentu',         detail: 'HRK/EMP/2024/07 aneks nr 6',                  type: 'view'    as const },
  { ts: '2026-04-11 09:22', user: 'M. Janowska',  action: 'Zmiana opiekuna',           detail: 'MediaMarkt – nowy opiekun: M. Nowak',          type: 'change'  as const },
  { ts: '2026-04-10 17:01', user: 'M. Nowak',      action: 'Zatwierdzenie waloryzacji', detail: 'Biedronka +4,1% – zaakceptowane',              type: 'approve' as const },
  { ts: '2026-04-10 14:30', user: 'K. Lis',        action: 'Eksport raportu',           detail: 'Lista umów wygasających Q2 2026 – XLSX',       type: 'export'  as const },
  { ts: '2026-04-09 11:15', user: 'System',         action: 'Weryfikacja spójności',    detail: '3 rozbieżności w danych Empik – oznaczono',   type: 'system'  as const },
]

const BADGE: Record<typeof log[number]['type'], { bg: string; color: string; label: string }> = {
  change:  { bg: '#fffbeb', color: '#92400e', label: 'Zmiana'    },
  approve: { bg: '#f0fff4', color: '#276749', label: 'Akceptacja' },
  system:  { bg: '#ebf8ff', color: '#2b6cb0', label: 'System'    },
  note:    { bg: '#f3f4f6', color: '#374151', label: 'Notatka'   },
  export:  { bg: '#fff5f0', color: '#c94f02', label: 'Eksport'   },
  view:    { bg: '#f0fff4', color: '#276749', label: 'Odczyt'    },
}

import { cardStyle as card } from '@/lib/styles'

/* ─── Component ──────────────────────────────────────────────── */
export function ReportsPage() {
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1714', margin: 0, marginBottom: 2 }}>Raporty</h1>
          <p style={{ fontSize: 12.5, color: '#9e9389', margin: 0 }}>Pełny log audytowy wszystkich operacji w systemie HRK CRM.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ background: 'white', border: '1px solid #e3e0db', borderRadius: 6, padding: '7px 14px', fontSize: 13, color: '#6b6b6b', cursor: 'pointer' }}>
            Filtruj
          </button>
          <button style={{ background: '#e85c04', border: 'none', borderRadius: 6, padding: '7px 16px', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Eksportuj PDF
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        {kpis.map((kpi) => (
          <div key={kpi.label} style={{ ...card, padding: '16px 18px', borderTop: `3px solid ${kpi.color}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#9e9389', letterSpacing: '0.07em', marginBottom: 8 }}>{kpi.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#1a1714', lineHeight: 1, marginBottom: 6 }}>{kpi.value}</div>
            <div style={{ fontSize: 11, color: '#9e9389' }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Audit log */}
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #f2f0ed', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1714' }}>Log audytowy</div>
            <div style={{ fontSize: 12, color: '#9e9389', marginTop: 2 }}>Wszystkie operacje zapisu, odczytu i zatwierdzeń</div>
          </div>
          <div style={{ position: 'relative' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9e9389" strokeWidth="2" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              name="audit-log-search"
              placeholder="Szukaj w logu…"
              readOnly
              aria-label="Wyszukiwarka logu audytowego (demo)"
              style={{ border: '1px solid #e3e0db', borderRadius: 6, padding: '6px 10px 6px 32px', fontSize: 13, outline: 'none', color: '#1a1714', background: '#fafaf9', width: 200 }}
            />
          </div>
        </div>

        {/* Column headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '160px 120px 180px 1fr 90px', gap: 8, padding: '8px 18px', fontSize: 10, fontWeight: 700, color: '#9e9389', letterSpacing: '0.06em', borderBottom: '1px solid #f2f0ed' }}>
          <span>CZAS</span><span>UŻYTKOWNIK</span><span>AKCJA</span><span>SZCZEGÓŁY</span><span>TYP</span>
        </div>

        {log.map((entry, i) => (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '160px 120px 180px 1fr 90px',
            gap: 8, padding: '10px 18px', alignItems: 'center',
            background: i % 2 === 0 ? '#fafaf9' : 'white',
            borderBottom: i < log.length - 1 ? '1px solid #f2f0ed' : 'none',
          }}>
            <span style={{ fontSize: 11, color: '#9e9389', fontFamily: 'monospace' }}>{entry.ts}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#1a1714' }}>{entry.user}</span>
            <span style={{ fontSize: 12, color: '#374151' }}>{entry.action}</span>
            <span style={{ fontSize: 11, color: '#9e9389', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.detail}</span>
            <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, fontWeight: 600, textAlign: 'center', background: BADGE[entry.type]?.bg, color: BADGE[entry.type]?.color }}>
              {BADGE[entry.type]?.label}
            </span>
          </div>
        ))}

        <div style={{ padding: '12px 18px', borderTop: '1px solid #f2f0ed', fontSize: 12, color: '#9e9389', textAlign: 'center' }}>
          Wyświetlono 10 z 247 zdarzeń · <span style={{ color: '#e85c04', cursor: 'pointer', fontWeight: 600 }}>Załaduj więcej</span>
        </div>
      </div>
    </div>
  )
}
