/* ─── Mock data (inline) ─────────────────────────────────────── */
const kpis = [
  { label: 'WALORYZACJE DO ZROBIENIA', value: '3',    sub: 'Wymagają decyzji',     color: '#e85c04' },
  { label: 'PRZETERMINOWANE',          value: '2',    sub: 'Wymagana eskalacja',   color: '#d69e2e' },
  { label: 'ZAPLANOWANE',              value: '9',    sub: 'W harmonogramie',      color: '#38a169' },
  { label: 'AKTUALNY WSKAŹNIK GUS',    value: '4,5%', sub: 'CPI Q1 2026',         color: '#3182ce' },
]

const rules = [
  { contract: 'HRK/EMP/2024/07', client: 'Empik',     index: 'CPI GUS',      threshold: 'min. 4%', current: '4,5%', effective: '2026-06-01', last: '+5,2%', lastDate: '2025-06-01', status: 'Wymaga decyzji', statusType: 'urgent'  },
  { contract: 'HRK/TN/2025/03',  client: 'TechNova',  index: 'CPI GUS',      threshold: 'min. 3%', current: '4,5%', effective: '2026-07-01', last: '+3,4%', lastDate: '2025-07-01', status: 'W trakcie',     statusType: 'warning' },
  { contract: 'HRK/MED/2023/11', client: 'MediaMarkt', index: 'CPI + koszyk', threshold: 'min. 5%', current: '4,5%', effective: '2026-05-15', last: '+0,0%', lastDate: 'brak',       status: 'Blokada',       statusType: 'urgent'  },
  { contract: 'HRK/BIE/2024/03', client: 'Biedronka', index: 'CPI GUS',      threshold: 'min. 3%', current: '4,5%', effective: '2026-09-01', last: '+4,1%', lastDate: '2025-09-01', status: 'Gotowa',        statusType: 'good'    },
  { contract: 'HRK/LID/2024/08', client: 'Lidl Polska',index: 'CPI GUS',     threshold: 'min. 3%', current: '4,5%', effective: '2026-09-01', last: '+3,8%', lastDate: '2025-09-01', status: 'Gotowa',        statusType: 'good'    },
]

const pipeline = [
  { stage: 'Identyfikacja ryzyka', count: 5, value: '1,1 mln PLN', color: '#e85c04' },
  { stage: 'Analiza i propozycja', count: 8, value: '2,4 mln PLN', color: '#d69e2e' },
  { stage: 'Negocjacje',           count: 4, value: '1,8 mln PLN', color: '#3182ce' },
  { stage: 'Akceptacja klienta',   count: 3, value: '0,9 mln PLN', color: '#38a169' },
]

import { cardStyle as card } from '@/lib/styles'
import { useCan } from '@/hooks/usePermission'

/* ─── Helpers ────────────────────────────────────────────────── */
const VAL_S: Record<string, { bg: string; color: string }> = {
  urgent:  { bg: '#fff5f0', color: '#c94f02' },
  warning: { bg: '#fffbeb', color: '#92400e' },
  good:    { bg: '#f0fff4', color: '#276749' },
}

/* ─── Component ──────────────────────────────────────────────── */
export function ValorizationPage() {
  const canCreate = useCan('valorization', 'create')
  return (
    <div style={{ width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1714', margin: 0, marginBottom: 2 }}>Waloryzacja</h1>
          <p style={{ fontSize: 12.5, color: '#9e9389', margin: 0 }}>Reguły waloryzacji, wskaźniki GUS i pipeline odnowień umów.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ background: 'white', border: '1px solid #e3e0db', borderRadius: 6, padding: '7px 14px', fontSize: 13, color: '#6b6b6b', cursor: 'pointer' }}>
            Eksportuj raport
          </button>
          {canCreate && (
            <button style={{ background: '#e85c04', border: 'none', borderRadius: 6, padding: '7px 16px', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Generuj aneks
            </button>
          )}
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        {kpis.map((kpi) => (
          <div key={kpi.label} style={{ ...card, padding: '16px 18px', borderTop: `3px solid ${kpi.color}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#9e9389', letterSpacing: '0.07em', marginBottom: 8 }}>{kpi.label}</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: '#1a1714', lineHeight: 1, marginBottom: 6 }}>{kpi.value}</div>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600, background: kpi.color + '18', color: kpi.color }}>{kpi.sub}</span>
          </div>
        ))}
      </div>

      {/* Valorization rules table */}
      <div style={{ ...card, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #f2f0ed' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1714' }}>Reguły waloryzacji</div>
          <div style={{ fontSize: 12, color: '#9e9389', marginTop: 2 }}>Wskaźniki indeksacji i statusy dla aktywnych umów</div>
        </div>
        <div style={{ padding: '0 18px 18px' }}>
          {rules.map((v, i) => {
            const bc = v.statusType === 'urgent' ? '#e85c04' : v.statusType === 'warning' ? '#d69e2e' : '#38a169'
            return (
              <div key={v.contract} style={{
                display: 'grid', gridTemplateColumns: '1.8fr 1fr 1fr 1fr 1fr 100px',
                alignItems: 'center', gap: 12, padding: '14px 16px',
                borderRadius: 8, background: i % 2 === 0 ? '#fafaf9' : 'white',
                border: '1px solid #f2f0ed', borderLeft: `3px solid ${bc}`,
                marginTop: 10,
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#1a1714' }}>{v.client}</div>
                  <div style={{ fontSize: 11, color: '#9e9389', marginTop: 1 }}>{v.contract}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#9e9389', marginBottom: 2, fontWeight: 600 }}>INDEKS / PRÓG</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1714' }}>{v.index} · {v.threshold}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#9e9389', marginBottom: 2, fontWeight: 600 }}>OBECNY GUS</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#e85c04' }}>{v.current}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#9e9389', marginBottom: 2, fontWeight: 600 }}>OSTATNIA ZMIANA</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#276749' }}>{v.last}</div>
                  <div style={{ fontSize: 10, color: '#9e9389' }}>{v.lastDate}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#9e9389', marginBottom: 2, fontWeight: 600 }}>PLANOWANA OD</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1714' }}>{v.effective}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, fontWeight: 600, background: VAL_S[v.statusType]?.bg, color: VAL_S[v.statusType]?.color }}>
                    {v.status}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Pipeline */}
      <div style={card}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #f2f0ed' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1714' }}>Pipeline odnowień</div>
          <div style={{ fontSize: 12, color: '#9e9389', marginTop: 2 }}>Etapy procesu renegocjacji i waloryzacji umów</div>
        </div>
        <div style={{ padding: '18px', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
          {pipeline.map((stage, i) => (
            <div key={stage.stage} style={{ position: 'relative' }}>
              {/* Arrow connector */}
              {i < pipeline.length - 1 && (
                <div style={{ position: 'absolute', right: -14, top: '50%', transform: 'translateY(-50%)', color: '#e3e0db', fontSize: 20, zIndex: 1 }}>›</div>
              )}
              <div style={{ borderRadius: 8, background: '#fafaf9', border: '1px solid #f2f0ed', borderTop: `3px solid ${stage.color}`, padding: '18px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#9e9389', marginBottom: 10, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  {stage.stage}
                </div>
                <div style={{ fontSize: 34, fontWeight: 800, color: '#1a1714', lineHeight: 1, marginBottom: 4 }}>{stage.count}</div>
                <div style={{ fontSize: 11, color: '#9e9389', marginBottom: 10 }}>umów</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: stage.color }}>{stage.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
