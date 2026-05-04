import { cardStyle as card } from '@/lib/styles'
import { useAppSelector } from '@/hooks/store'
import { useAlerts, useDashboardKpi } from '@/hooks/alerts'

/* ─── Mock data (inline) ─────────────────────────────────────── */
const escalations = [
  { priority: 'Pilne'  , title: 'Empik: brak decyzji o waloryzacji',       detail: 'Termin aneksu mija za 4 dni. Wymagany akcept dyrektora sprzedaży.', color: '#e85c04' },
  { priority: 'Wysoki' , title: 'MediaMarkt: ryzyko wypowiedzenia',          detail: 'Klient zgłosił zastrzeżenia do stawek. Zaplanować call zarządczy.', color: '#d69e2e' },
  { priority: 'Średni' , title: 'TechNova: potwierdzić okno wypowiedzenia',  detail: 'Dwie wersje SLA w dokumentacji, wymagana korekta.',                color: '#3182ce' },
  { priority: 'Pilne'  , title: 'Carrefour: nowa oferta ramowa',            detail: 'Klient prosi o weryfikację stawek dla regionu Południe.',          color: '#e85c04' },
  { priority: 'Wysoki' , title: 'Allegro: waloryzacja roczna',              detail: 'Indeksacja o 4.2% zgodnie z GUS. Przygotować aneks.',              color: '#d69e2e' },
]

const contracts = [
  { id: 'HRK/EMP/2024/07', client: 'Empik Sp. z o.o.',  type: 'HR ramowa',         status: 'Do odnowienia', statusType: 'warn',    end: '2026-05-12', notice: '30 dni', owner: 'M. Janowska', val: 'Wymaga decyzji',  valType: 'urgent'  },
  { id: 'HRK/ROS/2025/01', client: 'Rossmann Polska',   type: 'Obsługa kadrowa',   status: 'Aktywna',       statusType: 'good',    end: '2026-07-30', notice: '60 dni', owner: 'M. Janowska', val: 'Zaplanowana',     valType: 'good'    },
  { id: 'HRK/MED/2023/11', client: 'MediaMarkt',        type: 'PPK + płace',       status: 'Wypowiedzenie', statusType: 'danger',  end: '2026-05-02', notice: '30 dni', owner: 'M. Nowak',    val: 'Brak akceptacji', valType: 'urgent'  },
  { id: 'HRK/BIE/2024/03', client: 'Biedronka',         type: 'HR ramowa',         status: 'Aktywna',       statusType: 'good',    end: '2026-09-01', notice: '90 dni', owner: 'A. Kowalski', val: 'Gotowa',          valType: 'good'    },
  { id: 'HRK/LID/2024/08', client: 'Lidl Polska',       type: 'Administracja',     status: 'Aktywna',       statusType: 'good',    end: '2026-08-15', notice: '90 dni', owner: 'K. Lis',      val: 'Gotowa',          valType: 'good'    },
  { id: 'HRK/TN/2025/03',  client: 'TechNova S.A.',     type: 'Outsourcing IT HR', status: 'Aktywna',       statusType: 'good',    end: '2026-06-18', notice: '60 dni', owner: 'M. Nowak',    val: 'W trakcie',       valType: 'warning' },
  { id: 'HRK/CAR/2026/01', client: 'Carrefour Polska',  type: 'HR ramowa',         status: 'Nowa',          statusType: 'info',    end: '2027-01-20', notice: '90 dni', owner: 'T. Nowak',    val: 'Brak',            valType: 'neutral' },
  { id: 'HRK/ALL/2025/12', client: 'Allegro.pl',        type: 'Obsługa płacowa',   status: 'Aktywna',       statusType: 'good',    end: '2026-12-31', notice: '60 dni', owner: 'A. Kowalski', val: 'Zaplanowana',     valType: 'good'    },
  { id: 'HRK/ZAB/2024/05', client: 'Żabka Polska',      type: 'Rekrutacje stałe',  status: 'Aktywna',       statusType: 'good',    end: '2026-10-10', notice: '30 dni', owner: 'M. Janowska', val: 'N/A',             valType: 'neutral' },
  { id: 'HRK/PEP/2023/09', client: 'Pepco Poland',      type: 'Leasing prac.',     status: 'Do odnowienia', statusType: 'warn',    end: '2026-05-25', notice: '30 dni', owner: 'K. Lis',      val: 'W negocjacji',    valType: 'warning' },
]

/* ─── Style helpers ──────────────────────────────────────────── */
const STATUS_S: Record<string, { bg: string; color: string }> = {
  'Do odnowienia': { bg: '#fff5f0', color: '#c94f02' },
  'Aktywna':       { bg: '#f0fff4', color: '#276749' },
  'Wypowiedzenie': { bg: '#fef3c7', color: '#92400e' },
}

const VAL_S: Record<string, { bg: string; color: string }> = {
  urgent:  { bg: '#fff5f0', color: '#c94f02' },
  warning: { bg: '#fffbeb', color: '#92400e' },
  good:    { bg: '#f0fff4', color: '#276749' },
}

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'

/* ─── Component ──────────────────────────────────────────────── */
export function ContractsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const user = useAppSelector((s) => s.auth.user)
  const { data: realAlerts, isLoading: alertsLoading } = useAlerts(user?.id)
  const { data: kpiData, isLoading: kpiLoading } = useDashboardKpi(user?.id)

  const exp30 = alertsLoading ? null : (realAlerts?.filter(a => a.type === 'contract_expiry_30').length ?? 0)
  const exp60 = alertsLoading ? null : (realAlerts?.filter(a => a.type === 'contract_expiry_60').length ?? 0)
  const exp90 = alertsLoading ? null : (realAlerts?.filter(a => a.type === 'contract_expiry_90').length ?? 0)
  const activeContracts = kpiLoading ? null : (kpiData?.active_contracts ?? 0)

  const kpis = [
    { label: 'KOŃCZĄ SIĘ W 30 DNI',        value: exp30 === null ? '—' : String(exp30),              sub: 'Wysoki priorytet',   color: '#e85c04' },
    { label: 'KOŃCZĄ SIĘ W 60 DNI',        value: exp60 === null ? '—' : String(exp60),              sub: 'Przygotuj ofertę',   color: '#d69e2e' },
    { label: 'KOŃCZĄ SIĘ W 90 DNI',        value: exp90 === null ? '—' : String(exp90),              sub: 'Wczesny kontakt',    color: '#3182ce' },
    { label: 'AKTYWNYCH UMÓW',             value: activeContracts === null ? '—' : String(activeContracts), sub: 'Łącznie w systemie', color: '#38a169' },
  ]
  return (
    <div style={{ width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1714', margin: 0, marginBottom: 2 }}>Umowy</h1>
          <p style={{ fontSize: 12.5, color: '#9e9389', margin: 0 }}>Cykl życia umów, alerty 30/60/90 dni i statusy negocjacji.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ background: 'white', border: '1px solid #e3e0db', borderRadius: 6, padding: '7px 14px', fontSize: 13, fontWeight: 500, color: '#6b6b6b', cursor: 'pointer' }}>
            Eksportuj
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            style={{ background: '#e85c04', border: 'none', borderRadius: 6, padding: '7px 16px', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nowa umowa
          </button>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Dodaj nową umowę">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#4a4340' }}>Klient</label>
            <select style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #e3e0db', fontSize: 13, outline: 'none' }}>
              <option>Wybierz klienta...</option>
              <option>Empik Sp. z o.o.</option>
              <option>Rossmann Polska</option>
              <option>MediaMarkt</option>
            </select>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#4a4340' }}>Typ umowy</label>
            <select style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #e3e0db', fontSize: 13, outline: 'none' }}>
              <option>HR ramowa</option>
              <option>Obsługa kadrowa</option>
              <option>PPK + płace</option>
              <option>Outsourcing IT</option>
            </select>
          </div>

          <div style={{ 
            border: '2px dashed #e3e0db', 
            borderRadius: 8, 
            padding: '32px 20px', 
            textAlign: 'center', 
            background: '#fafaf9',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>📄</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1714', marginBottom: 2 }}>Wgraj dokument umowy</div>
            <div style={{ fontSize: 11, color: '#9e9389' }}>Kliknij lub przeciągnij plik PDF (max 15MB)</div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <button 
              onClick={() => setIsModalOpen(false)}
              style={{ flex: 1, padding: '10px', borderRadius: 6, border: '1px solid #e3e0db', background: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Anuluj
            </button>
            <button 
              onClick={() => setIsModalOpen(false)}
              style={{ flex: 1, padding: '10px', borderRadius: 6, border: 'none', background: '#e85c04', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Utwórz umowę
            </button>
          </div>
        </div>
      </Modal>

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

      {/* Escalation queue */}
      <div style={{ ...card, padding: '16px 18px', marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1714', marginBottom: 12 }}>Kolejka eskalacji</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {escalations.map((esc) => (
            <div key={esc.title} style={{ borderRadius: 6, padding: '12px 14px', background: '#fafaf9', border: '1px solid #f2f0ed', borderLeft: `3px solid ${esc.color}` }}>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 8px', borderRadius: 20, background: esc.color + '18', color: esc.color, display: 'inline-block', marginBottom: 6 }}>
                {esc.priority}
              </span>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1a1714', marginBottom: 4 }}>{esc.title}</div>
              <div style={{ fontSize: 11, color: '#9e9389', lineHeight: 1.4 }}>{esc.detail}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Contracts table */}
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #f2f0ed', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1714' }}>Lista umów</div>
          <div style={{ position: 'relative' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9e9389" strokeWidth="2" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              name="contract-search"
              placeholder="Szukaj umowy…"
              readOnly
              aria-label="Wyszukiwarka umów (demo)"
              style={{ border: '1px solid #e3e0db', borderRadius: 6, padding: '6px 10px 6px 32px', fontSize: 13, outline: 'none', color: '#1a1714', background: '#fafaf9', width: 200 }}
            />
          </div>
        </div>
        <div style={{ padding: '0 18px 18px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['KLIENT / UMOWA','TYP','STATUS','TERMIN KOŃCA','OKNO','WALORYZACJA','OPIEKUN'].map(col => (
                  <th key={col} style={{ textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#9e9389', letterSpacing: '0.06em', padding: '12px 8px 10px', borderBottom: '1px solid #f2f0ed' }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contracts.map((c, i) => (
                <tr key={c.id} style={{ borderBottom: i < contracts.length - 1 ? '1px solid #f9f8f6' : 'none', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#fafaf9')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '11px 8px 11px 0' }}>
                    <div style={{ fontWeight: 700, color: '#1a1714' }}>{c.client}</div>
                    <div style={{ fontSize: 11, color: '#9e9389', marginTop: 1 }}>{c.id}</div>
                  </td>
                  <td style={{ padding: '11px 8px', color: '#4b5563' }}>{c.type}</td>
                  <td style={{ padding: '11px 8px' }}>
                    <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 600, background: STATUS_S[c.status]?.bg ?? '#f2f0ed', color: STATUS_S[c.status]?.color ?? '#374151' }}>
                      {c.status}
                    </span>
                  </td>
                  <td style={{ padding: '11px 8px', color: '#4b5563', fontSize: 12 }}>{c.end}</td>
                  <td style={{ padding: '11px 8px', color: '#9e9389', fontSize: 12 }}>{c.notice}</td>
                  <td style={{ padding: '11px 8px' }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600, background: VAL_S[c.valType]?.bg ?? '#f2f0ed', color: VAL_S[c.valType]?.color ?? '#374151' }}>
                      {c.val}
                    </span>
                  </td>
                  <td style={{ padding: '11px 0', color: '#9e9389', fontSize: 12 }}>{c.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
