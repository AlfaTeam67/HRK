import { useState } from 'react'
import type { CSSProperties } from 'react'

import { cardStyle } from '@/lib/styles'

/* ─── Mock data (inline) ─────────────────────────────────────── */
const clients = [
  { id: 1, name: 'Empik Sp. z o.o.', nip: '123-456-78-90', segment: 'Enterprise', status: 'Aktywny', owner: 'Małgorzata Janowska', deputy: 'Adam Kowalski', employees: 312, activeContracts: 3, contractValue: '2,4 mln PLN/rok', since: '2019-03-15', lastContact: '2026-03-18', paymentDays: 30, risk: 'Ryzyko utraty', riskType: 'warn' as const, aiSummary: 'Klient strategiczny. Najbliższy termin: odnowienie umowy za 27 dni. Waloryzacja wymaga decyzji po aktualizacji wskaźnika inflacji GUS (4,5%). Klient sygnalizował zainteresowanie rozszerzeniem zakresu PPK.' },
  { id: 2, name: 'Rossmann Polska',  nip: '987-654-32-10', segment: 'Enterprise', status: 'Aktywny', owner: 'Małgorzata Janowska', deputy: 'Karolina Lis',   employees: 527, activeContracts: 2, contractValue: '1,8 mln PLN/rok', since: '2020-06-01', lastContact: '2026-01-04', paymentDays: 30, risk: 'Wymaga uwagi',  riskType: 'warn' as const, aiSummary: 'Brak kontaktu od 87 dni. Klient nie odpowiedział na ofertę rozszerzenia usług z lutego. Ryzyko nieodnowienia umowy w Q3.' },
  { id: 3, name: 'Biedronka (Jeronimo)', nip: '456-123-09-87', segment: 'Key Account', status: 'Aktywny', owner: 'Adam Kowalski', deputy: 'Małgorzata Janowska', employees: 1008, activeContracts: 4, contractValue: '4,1 mln PLN/rok', since: '2018-01-10', lastContact: '2026-03-15', paymentDays: 45, risk: 'Dobra relacja', riskType: 'good' as const, aiSummary: 'Klient flagowy. Waloryzacja zaplanowana na wrzesień 2026 – próg CPI 3% zostanie prawdopodobnie przekroczony. Relacja oceniana pozytywnie.' },
  { id: 4, name: 'Lidl Polska',     nip: '321-654-78-12', segment: 'Key Account', status: 'Aktywny', owner: 'Karolina Lis',          deputy: 'Marek Nowak',           employees: 892, activeContracts: 2, contractValue: '3,2 mln PLN/rok', since: '2021-04-20', lastContact: '2026-03-10', paymentDays: 30, risk: 'Dobra relacja', riskType: 'good' as const, aiSummary: 'Stabilna relacja. Umowy aktywne do 2026 Q3. Klient zainteresowany poszerzeniem obsługi o nowe lokalizacje.' },
  { id: 5, name: 'MediaMarkt Polska', nip: '654-321-12-34', segment: 'Mid-Market', status: 'W trakcie rozmów', owner: 'Marek Nowak', deputy: 'Adam Kowalski', employees: 143, activeContracts: 1, contractValue: '0,6 mln PLN/rok', since: '2023-11-01', lastContact: '2026-02-20', paymentDays: 30, risk: 'Ryzyko utraty', riskType: 'warn' as const, aiSummary: 'Waloryzacja po terminie. Klient nie zaakceptował progów CPI. Wymaga interwencji zarządczej.' },
]

const clientContracts: Record<number, Array<{ id: string; name: string; status: string; end: string; value: string }>> = {
  1: [
    { id: 'HRK/EMP/2024/07', name: 'Umowa ramowa HR',       status: 'Do odnowienia', end: '2026-05-12', value: '1,2 mln PLN' },
    { id: 'HRK/EMP/2023/02', name: 'Obsługa kadrowo-płacowa', status: 'Aktywna',      end: '2027-02-28', value: '0,8 mln PLN' },
    { id: 'HRK/EMP/2025/01', name: 'PPK – administracja',   status: 'Aktywna',      end: '2027-01-31', value: '0,4 mln PLN' },
  ],
  2: [
    { id: 'HRK/ROS/2025/01', name: 'Obsługa kadrowa', status: 'Aktywna', end: '2026-07-30', value: '1,0 mln PLN' },
    { id: 'HRK/ROS/2023/04', name: 'PPK',             status: 'Aktywna', end: '2027-04-01', value: '0,8 mln PLN' },
  ],
  3: [
    { id: 'HRK/BIE/2024/03', name: 'Umowa ramowa HR',  status: 'Aktywna', end: '2026-09-01', value: '2,0 mln PLN' },
    { id: 'HRK/BIE/2023/07', name: 'Obsługa płac',     status: 'Aktywna', end: '2027-07-01', value: '1,2 mln PLN' },
    { id: 'HRK/BIE/2025/02', name: 'PPK – administracja', status: 'Aktywna', end: '2027-02-28', value: '0,6 mln PLN' },
    { id: 'HRK/BIE/2024/11', name: 'Rekrutacja masowa', status: 'Aktywna', end: '2026-11-30', value: '0,3 mln PLN' },
  ],
  4: [
    { id: 'HRK/LID/2024/08', name: 'Administracja HR', status: 'Aktywna', end: '2026-08-15', value: '1,8 mln PLN' },
    { id: 'HRK/LID/2025/03', name: 'PPK',              status: 'Aktywna', end: '2027-03-15', value: '1,4 mln PLN' },
  ],
  5: [{ id: 'HRK/MED/2023/11', name: 'PPK + płace', status: 'Wypowiedzenie', end: '2026-05-02', value: '0,6 mln PLN' }],
}

const clientNotes: Record<number, Array<{ date: string; author: string; text: string }>> = {
  1: [
    { date: '18.03.2026', author: 'M. Janowska', text: 'Spotkanie kwartalne. Klient zainteresowany rozszerzeniem PPK. Poprosił o ofertę do 01.04.' },
    { date: '15.02.2026', author: 'A. Kowalski', text: 'Przekazano aneks nr 6 do podpisu. Akceptacja stawek na poziomie +5,2%.' },
    { date: '10.01.2026', author: 'System AI',   text: 'Automatyczna weryfikacja danych – wykryto rozbieżność w 3 rekordach pracowniczych.' },
  ],
  2: [
    { date: '04.01.2026', author: 'M. Janowska', text: 'Wysłano ofertę rozszerzenia – brak odpowiedzi.' },
    { date: '10.12.2025', author: 'K. Lis',      text: 'Rozmowa telefoniczna – klient sygnalizuje problemy budżetowe na 2026.' },
  ],
  3: [{ date: '15.03.2026', author: 'A. Kowalski', text: 'Podpisano aneks nr 6 – aktualizacja stawek PPK.' }],
  4: [{ date: '10.03.2026', author: 'K. Lis', text: 'Klient zainteresowany rozszerzeniem obsługi o 2 nowe magazyny.' }],
  5: [{ date: '20.02.2026', author: 'M. Nowak', text: 'Klient złożył zastrzeżenia do stawek – wymagany call zarządczy.' }],
}

/* ─── Timeline data ──────────────────────────────────────────── */
type TimelineEventType = 'contract_signed' | 'contract_expiring' | 'valorization' | 'meeting' | 'note' | 'alert' | 'today'

interface TimelineEvent {
  id: string
  date: string       // ISO date string — for sorting
  label: string      // formatted date to display
  type: TimelineEventType
  title: string
  detail?: string
  author?: string
  future?: boolean   // true = event hasn't happened yet
}

const TODAY_ISO = new Date().toISOString().slice(0, 10)
const TODAY_LABEL = new Date().toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })

const clientTimeline: Record<number, TimelineEvent[]> = {
  1: [
    { id: 't1-1',  date: '2026-05-12', label: '12 maja 2026',     type: 'contract_expiring', title: 'Koniec umowy HRK/EMP/2024/07', detail: 'Umowa ramowa HR — wymaga odnowienia lub wypowiedzenia', future: true },
    { id: 't1-2',  date: '2026-06-01', label: '1 czerwca 2026',   type: 'valorization',      title: 'Planowana waloryzacja +4,5%', detail: 'Wskaźnik GUS CPI Q1 2026 — próg umowny 4% przekroczony', future: true },
    { id: 'today', date: TODAY_ISO,    label: TODAY_LABEL,         type: 'today',             title: 'Dziś' },
    { id: 't1-3',  date: '2026-03-18', label: '18 marca 2026',    type: 'meeting',           title: 'Spotkanie kwartalne', detail: 'Zainteresowanie rozszerzeniem PPK. Oferta do 01.04.', author: 'M. Janowska' },
    { id: 't1-4',  date: '2026-02-15', label: '15 lutego 2026',   type: 'valorization',      title: 'Waloryzacja +5,2% zatwierdzona', detail: 'Aneks nr 6 przekazany do podpisu. Stawki zaakceptowane.', author: 'A. Kowalski' },
    { id: 't1-5',  date: '2026-01-10', label: '10 stycznia 2026', type: 'alert',             title: 'Anomalia danych pracowniczych', detail: 'Automatyczna weryfikacja — 3 rozbieżne rekordy', author: 'System AI' },
    { id: 't1-6',  date: '2025-06-01', label: '1 czerwca 2025',   type: 'valorization',      title: 'Waloryzacja +3,8% zastosowana', detail: 'Poprzednia waloryzacja roczna — CPI 3,8%', author: 'System' },
    { id: 't1-7',  date: '2024-07-01', label: 'Lipiec 2024',      type: 'contract_signed',   title: 'Podpisano umowę HRK/EMP/2024/07', detail: 'Umowa ramowa HR · wartość 1,2 mln PLN', author: 'M. Janowska' },
    { id: 't1-8',  date: '2023-02-01', label: 'Luty 2023',        type: 'contract_signed',   title: 'Podpisano umowę HRK/EMP/2023/02', detail: 'Obsługa kadrowo-płacowa · 0,8 mln PLN', author: 'A. Kowalski' },
    { id: 't1-9',  date: '2019-03-15', label: 'Marzec 2019',      type: 'contract_signed',   title: 'Pierwsza umowa z klientem', detail: 'Nawiązanie współpracy HRK × Empik', author: 'System' },
  ],
  2: [
    { id: 't2-1',  date: '2026-07-30', label: '30 lipca 2026',    type: 'contract_expiring', title: 'Koniec umowy HRK/ROS/2025/01', detail: 'Obsługa kadrowa — decyzja o odnowieniu wymagana', future: true },
    { id: 'today', date: TODAY_ISO,    label: TODAY_LABEL,         type: 'today',             title: 'Dziś' },
    { id: 't2-2',  date: '2026-01-04', label: '4 stycznia 2026',  type: 'note',              title: 'Wysłano ofertę rozszerzenia usług', detail: 'Brak odpowiedzi od klienta', author: 'M. Janowska' },
    { id: 't2-3',  date: '2025-12-10', label: '10 grudnia 2025',  type: 'meeting',           title: 'Rozmowa telefoniczna', detail: 'Klient sygnalizuje problemy budżetowe na 2026', author: 'K. Lis' },
    { id: 't2-4',  date: '2025-01-15', label: 'Styczeń 2025',     type: 'contract_signed',   title: 'Odnowienie umowy kadrowej', detail: 'HRK/ROS/2025/01 · wartość 1,0 mln PLN', author: 'M. Janowska' },
    { id: 't2-5',  date: '2020-06-01', label: 'Czerwiec 2020',    type: 'contract_signed',   title: 'Pierwsza umowa z klientem', detail: 'Nawiązanie współpracy HRK × Rossmann', author: 'System' },
  ],
  3: [
    { id: 't3-1',  date: '2026-09-01', label: 'Wrzesień 2026',    type: 'valorization',      title: 'Planowana waloryzacja (CPI > 3%)', detail: 'Próg CPI zostanie prawdopodobnie przekroczony', future: true },
    { id: 'today', date: TODAY_ISO,    label: TODAY_LABEL,         type: 'today',             title: 'Dziś' },
    { id: 't3-2',  date: '2026-03-15', label: '15 marca 2026',    type: 'note',              title: 'Podpisano aneks nr 6', detail: 'Aktualizacja stawek PPK — nowe warunki od 01.04.2026', author: 'A. Kowalski' },
    { id: 't3-3',  date: '2025-09-01', label: 'Wrzesień 2025',    type: 'valorization',      title: 'Waloryzacja +4,1% zatwierdzona', detail: 'Roczna waloryzacja stawek PPK', author: 'System' },
    { id: 't3-4',  date: '2024-11-01', label: 'Listopad 2024',    type: 'contract_signed',   title: 'Nowa umowa — Rekrutacja masowa', detail: 'HRK/BIE/2024/11 · 0,3 mln PLN', author: 'A. Kowalski' },
    { id: 't3-5',  date: '2024-03-01', label: 'Marzec 2024',      type: 'contract_signed',   title: 'Odnowienie umowy ramowej HR', detail: 'HRK/BIE/2024/03 · wartość 2,0 mln PLN', author: 'A. Kowalski' },
    { id: 't3-6',  date: '2018-01-10', label: 'Styczeń 2018',     type: 'contract_signed',   title: 'Pierwsza umowa z klientem', detail: 'Nawiązanie współpracy HRK × Biedronka (Jeronimo Martins)', author: 'System' },
  ],
  4: [
    { id: 't4-1',  date: '2026-08-15', label: '15 sierpnia 2026', type: 'contract_expiring', title: 'Koniec umowy HRK/LID/2024/08', detail: 'Administracja HR — planowane odnowienie', future: true },
    { id: 'today', date: TODAY_ISO,    label: TODAY_LABEL,         type: 'today',             title: 'Dziś' },
    { id: 't4-2',  date: '2026-03-10', label: '10 marca 2026',    type: 'meeting',           title: 'Spotkanie handlowe', detail: 'Zainteresowanie obsługą 2 nowych magazynów', author: 'K. Lis' },
    { id: 't4-3',  date: '2025-03-15', label: 'Marzec 2025',      type: 'contract_signed',   title: 'Nowa umowa PPK', detail: 'HRK/LID/2025/03 · wartość 1,4 mln PLN', author: 'K. Lis' },
    { id: 't4-4',  date: '2024-08-01', label: 'Sierpień 2024',    type: 'contract_signed',   title: 'Podpisano umowę administracji HR', detail: 'HRK/LID/2024/08 · wartość 1,8 mln PLN', author: 'K. Lis' },
    { id: 't4-5',  date: '2021-04-20', label: 'Kwiecień 2021',    type: 'contract_signed',   title: 'Pierwsza umowa z klientem', detail: 'Nawiązanie współpracy HRK × Lidl Polska', author: 'System' },
  ],
  5: [
    { id: 't5-1',  date: '2026-05-02', label: '2 maja 2026',      type: 'contract_expiring', title: 'Koniec umowy HRK/MED/2023/11', detail: 'Wypowiedzenie — PPK + płace. Wymaga interwencji.', future: true },
    { id: 'today', date: TODAY_ISO,    label: TODAY_LABEL,         type: 'today',             title: 'Dziś' },
    { id: 't5-2',  date: '2026-02-20', label: '20 lutego 2026',   type: 'alert',             title: 'Sprzeciw klienta wobec waloryzacji', detail: 'Klient nie zaakceptował progów CPI. Wymagany call zarządczy.', author: 'M. Nowak' },
    { id: 't5-3',  date: '2025-11-15', label: 'Listopad 2025',    type: 'meeting',           title: 'Negocjacje warunków', detail: 'Omówiono propozycję nowych stawek na 2026', author: 'M. Nowak' },
    { id: 't5-4',  date: '2023-11-01', label: 'Listopad 2023',    type: 'contract_signed',   title: 'Pierwsza umowa z klientem', detail: 'PPK + obsługa płac · 0,6 mln PLN', author: 'M. Nowak' },
  ],
}

const card: CSSProperties = cardStyle

/* ─── Helpers ────────────────────────────────────────────────── */
function initials(name: string) {
  const words = name.replace(/[()]/g, '').split(/\s+/).filter(Boolean)
  return words.length >= 2 ? words[0][0] + words[1][0] : (words[0] ?? '?')[0]
}

function yearsAsClient(since: string) {
  const years = new Date().getFullYear() - new Date(since).getFullYear()
  return years === 0 ? 'w tym roku' : `${years} ${years === 1 ? 'rok' : years < 5 ? 'lata' : 'lat'}`
}

const RISK_STYLE = {
  good: { dot: '#38a169', text: '#276749', bg: '#f0fff4', border: '#c6f6d5' },
  warn: { dot: '#e85c04', text: '#c94f02', bg: '#fff5f0', border: '#fdd5b8' },
}

const KPI_ICONS: Record<string, React.ReactNode> = {
  'Pracownicy': (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  'Aktywne umowy': (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>
    </svg>
  ),
  'Wartość kontraktu': (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  ),
  'Ostatni kontakt': (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
}

const TAB_ICONS: Record<string, React.ReactNode> = {
  info: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
  contracts: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
    </svg>
  ),
  notes: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  timeline: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="2" x2="12" y2="22"/><circle cx="12" cy="7" r="2.5" fill="currentColor" stroke="none"/>
      <circle cx="12" cy="17" r="2.5" fill="currentColor" stroke="none"/>
      <line x1="9" y1="7" x2="4" y2="7"/><line x1="9" y1="17" x2="4" y2="17"/>
    </svg>
  ),
}

/* ─── Component ──────────────────────────────────────────────── */
export function ClientsPage() {
  const [selectedId, setSelectedId] = useState<number>(clients[0].id)
  const [activeTab, setActiveTab] = useState<'info' | 'contracts' | 'notes' | 'timeline'>('info')
  const selected = clients.find((c) => c.id === selectedId)!
  const contracts = clientContracts[selected.id] ?? []
  const notes = clientNotes[selected.id] ?? []
  const timelineEvents = (clientTimeline[selected.id] ?? []).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )
  const risk = RISK_STYLE[selected.riskType]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: 16 }}>
      {/* ── Page header ─────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1a1714', margin: 0, marginBottom: 2 }}>Klienci</h1>
          <p style={{ fontSize: 12.5, color: '#9e9389', margin: 0 }}>Profil 360°: dane firmy, opiekunowie, historia i statusy umów.</p>
        </div>
        <button
          style={{ background: '#e85c04', border: 'none', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', color: 'white', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 7, boxShadow: '0 2px 8px rgba(232,92,4,0.25)', fontFamily: 'inherit' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#d45203' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#e85c04' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Dodaj klienta
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 16, flex: 1, minHeight: 0 }}>

        {/* ── Client list ─────────────────────────────────── */}
        <div style={{ ...card, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* Search */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #f2f0ed' }}>
            <div style={{ position: 'relative' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#b5afa8" strokeWidth="2" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                name="client-search"
                placeholder="Szukaj klienta…"
                readOnly
                aria-label="Wyszukiwarka klientów (demo)"
                style={{ width: '100%', border: '1px solid #e3e0db', borderRadius: 7, padding: '8px 10px 8px 32px', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#1a1714', background: '#fafaf9', fontFamily: 'inherit' }}
              />
            </div>
          </div>

          {/* Summary bar */}
          <div style={{ padding: '8px 14px', background: '#fafaf9', borderBottom: '1px solid #f2f0ed', display: 'flex', gap: 12 }}>
            <span style={{ fontSize: 11, color: '#9e9389' }}>
              <span style={{ fontWeight: 700, color: '#1a1714' }}>{clients.length}</span> klientów
            </span>
            <span style={{ fontSize: 11, color: '#38a169', fontWeight: 600 }}>
              ● {clients.filter(c => c.riskType === 'good').length} stabilnych
            </span>
            <span style={{ fontSize: 11, color: '#e85c04', fontWeight: 600 }}>
              ● {clients.filter(c => c.riskType === 'warn').length} wymaga uwagi
            </span>
          </div>

          {/* List */}
          <div role="listbox" aria-label="Lista klientów" style={{ flex: 1, overflowY: 'auto' }}>
            {clients.map((client) => {
              const isActive = selectedId === client.id
              const rs = RISK_STYLE[client.riskType]
              const ini = initials(client.name)
              return (
                <button
                  key={client.id}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => { setSelectedId(client.id); setActiveTab('info') }}
                  style={{
                    width: '100%', textAlign: 'left', border: 'none', fontFamily: 'inherit',
                    padding: '12px 14px', borderBottom: '1px solid #f2f0ed', cursor: 'pointer',
                    background: isActive ? '#fff8f4' : 'white',
                    borderLeft: `3px solid ${isActive ? '#e85c04' : 'transparent'}`,
                    transition: 'all 0.12s',
                  }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = '#fdfcfb' }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'white' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Avatar */}
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: isActive
                        ? 'linear-gradient(135deg, #e85c04 0%, #c94f02 100%)'
                        : 'linear-gradient(135deg, #f2ede8 0%, #e8e2db 100%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 800,
                      color: isActive ? 'white' : '#7a6f67',
                      transition: 'all 0.12s',
                    }}>
                      {ini.toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1714', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>{client.name}</span>
                        <span style={{
                          fontSize: 9.5, padding: '2px 6px', borderRadius: 20, fontWeight: 700,
                          background: rs.bg, color: rs.text, border: `1px solid ${rs.border}`,
                          flexShrink: 0, marginLeft: 4,
                        }}>
                          <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: rs.dot, marginRight: 3, verticalAlign: 'middle' }} />
                          {client.risk}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 10.5, color: '#9e9389' }}>{client.segment}</span>
                        <span style={{ fontSize: 10, color: '#c9c4be' }}>·</span>
                        <span style={{ fontSize: 10.5, color: '#9e9389' }}>{client.contractValue}</span>
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Detail panel ────────────────────────────────── */}
        <div style={{ ...card, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>

          {/* Hero header */}
          <div style={{
            padding: '20px 24px 0',
            background: 'linear-gradient(160deg, #fff8f4 0%, #fdf6f2 60%, white 100%)',
            borderBottom: '1px solid #f2f0ed',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
              {/* Company monogram */}
              <div style={{
                width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                background: 'linear-gradient(135deg, #e85c04 0%, #c94f02 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 900, color: 'white',
                boxShadow: '0 4px 12px rgba(232,92,4,0.25)',
              }}>
                {initials(selected.name).toUpperCase()}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <h2 style={{ fontSize: 19, fontWeight: 800, color: '#1a1714', margin: 0, marginBottom: 3 }}>{selected.name}</h2>
                    <div style={{ fontSize: 11.5, color: '#9e9389', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <span>NIP {selected.nip}</span>
                      <span style={{ color: '#d4cfc9' }}>·</span>
                      <span>Klient od {yearsAsClient(selected.since)}</span>
                      <span style={{ color: '#d4cfc9' }}>·</span>
                      <span>Płatność {selected.paymentDays} dni</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <span style={{
                      fontSize: 11, padding: '4px 12px', borderRadius: 20, fontWeight: 700,
                      background: '#f0fff4', color: '#276749', border: '1px solid #c6f6d5',
                    }}>{selected.status}</span>
                    <span style={{
                      fontSize: 11, padding: '4px 12px', borderRadius: 20, fontWeight: 700,
                      background: risk.bg, color: risk.text, border: `1px solid ${risk.border}`,
                    }}>
                      <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: risk.dot, marginRight: 4, verticalAlign: 'middle' }} />
                      {selected.risk}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* KPI tiles */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
              {[
                { label: 'Pracownicy',        value: selected.employees.toLocaleString('pl-PL'), accent: '#553c9a', lightBg: '#faf5ff' },
                { label: 'Aktywne umowy',     value: selected.activeContracts.toString(),         accent: '#2b6cb0', lightBg: '#ebf8ff' },
                { label: 'Wartość kontraktu', value: selected.contractValue,                       accent: '#276749', lightBg: '#f0fff4' },
                { label: 'Ostatni kontakt',   value: new Date(selected.lastContact).toLocaleDateString('pl-PL'), accent: '#e85c04', lightBg: '#fff8f4' },
              ].map((kpi) => (
                <div key={kpi.label} style={{
                  background: kpi.lightBg, borderRadius: 8, padding: '10px 14px',
                  border: `1px solid ${kpi.accent}18`,
                  borderTop: `2px solid ${kpi.accent}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                    <span style={{ color: kpi.accent, opacity: 0.7 }}>{KPI_ICONS[kpi.label]}</span>
                    <span style={{ fontSize: 9.5, color: '#9e9389', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{kpi.label}</span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#1a1714' }}>{kpi.value}</div>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 2 }}>
              {(['info', 'contracts', 'notes', 'timeline'] as const).map((tab) => {
                const labels = {
                  info:      'Informacje',
                  contracts: `Umowy (${contracts.length})`,
                  notes:     `Notatki (${notes.length})`,
                  timeline:  'Oś czasu',
                }
                const isActive = activeTab === tab
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      padding: '9px 14px', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
                      border: 'none', cursor: 'pointer',
                      color: isActive ? '#e85c04' : '#9e9389',
                      background: isActive ? 'white' : 'transparent',
                      borderRadius: '8px 8px 0 0',
                      borderBottom: isActive ? '2px solid #e85c04' : '2px solid transparent',
                      display: 'flex', alignItems: 'center', gap: 5,
                      transition: 'color 0.12s',
                    }}
                  >
                    <span style={{ opacity: isActive ? 1 : 0.6 }}>{TAB_ICONS[tab]}</span>
                    {labels[tab]}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Tab content */}
          <div style={{ padding: '18px 24px', flex: 1, overflowY: 'auto', minHeight: 0 }}>

            {/* ── Info ── */}
            {activeTab === 'info' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* AI summary */}
                <div style={{
                  background: 'linear-gradient(135deg, #fff8f4 0%, #fff5ef 100%)',
                  border: '1px solid #fdd5b8', borderRadius: 10, padding: '14px 16px',
                  position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{
                    position: 'absolute', top: -10, right: -10, width: 60, height: 60,
                    borderRadius: '50%', background: 'rgba(232,92,4,0.06)',
                  }} />
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#c94f02', marginBottom: 7, display: 'flex', gap: 6, alignItems: 'center' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="#c94f02"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
                    Podsumowanie AI
                  </div>
                  <p style={{ fontSize: 13, color: '#7a3c01', lineHeight: 1.65, margin: 0 }}>{selected.aiSummary}</p>
                </div>

                {/* Owner + details grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { label: 'Opiekun główny',    value: selected.owner,   icon: '👤' },
                    { label: 'Zastępca opiekuna', value: selected.deputy,  icon: '👤' },
                    { label: 'Segment',           value: selected.segment, icon: '🏢' },
                    { label: 'Termin płatności',  value: `${selected.paymentDays} dni`, icon: '📅' },
                  ].map((item) => (
                    <div key={item.label} style={{
                      background: '#fafaf9', borderRadius: 8, padding: '11px 14px',
                      border: '1px solid #ede9e4', display: 'flex', gap: 10, alignItems: 'flex-start',
                    }}>
                      <div style={{ fontSize: 14, lineHeight: 1, marginTop: 1 }}>{item.icon}</div>
                      <div>
                        <div style={{ fontSize: 10.5, color: '#9e9389', fontWeight: 700, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{item.label}</div>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1a1714' }}>{item.value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Contracts ── */}
            {activeTab === 'contracts' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {contracts.map((c) => {
                  const isActive = c.status === 'Aktywna'
                  const isExpiring = c.status === 'Do odnowienia'
                  const accentColor = isActive ? '#276749' : isExpiring ? '#c94f02' : '#92400e'
                  const accentBg = isActive ? '#f0fff4' : isExpiring ? '#fff5f0' : '#fffbeb'
                  return (
                    <div key={c.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '13px 16px', borderRadius: 10,
                      border: `1px solid ${accentColor}20`,
                      borderLeft: `3px solid ${accentColor}`,
                      background: accentBg + '60',
                      transition: 'box-shadow 0.12s',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                          background: accentBg, border: `1px solid ${accentColor}30`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: accentColor,
                        }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                          </svg>
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1714', marginBottom: 2 }}>{c.name}</div>
                          <div style={{ fontSize: 11, color: '#9e9389' }}>{c.id} · wygasa: {c.end}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: '#1a1714' }}>{c.value}</span>
                        <span style={{ fontSize: 10.5, padding: '2px 9px', borderRadius: 20, fontWeight: 700, background: accentBg, color: accentColor, border: `1px solid ${accentColor}30` }}>{c.status}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* ── Notes ── */}
            {activeTab === 'notes' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {notes.map((note, i) => {
                  const isAI = note.author === 'System AI'
                  const authorInitials = note.author.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
                  return (
                    <div key={i} style={{
                      padding: '13px 16px', borderRadius: 10,
                      border: '1px solid #ede9e4',
                      background: isAI ? '#fff8f4' : 'white',
                      borderLeft: `3px solid ${isAI ? '#e85c04' : '#e3e0db'}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <div style={{
                          width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                          background: isAI ? 'linear-gradient(135deg,#e85c04,#c94f02)' : 'linear-gradient(135deg,#e8e2db,#d4cfc9)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 9, fontWeight: 800, color: 'white',
                        }}>
                          {isAI ? 'AI' : authorInitials}
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1714' }}>{note.author}</span>
                        <span style={{ fontSize: 11, color: '#b5afa8' }}>{note.date}</span>
                      </div>
                      <p style={{ fontSize: 13, color: '#374151', margin: 0, lineHeight: 1.55 }}>{note.text}</p>
                    </div>
                  )
                })}
              </div>
            )}

            {/* ── Timeline ── */}
            {activeTab === 'timeline' && (
              <TimelineTab events={timelineEvents} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Timeline Tab ───────────────────────────────────────────── */

const EVENT_META: Record<TimelineEventType, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  contract_signed: {
    color: '#276749', bg: '#f0fff4', label: 'Umowa',
    icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>
      </svg>
    ),
  },
  contract_expiring: {
    color: '#c94f02', bg: '#fff5f0', label: 'Termin umowy',
    icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    ),
  },
  valorization: {
    color: '#2b6cb0', bg: '#ebf8ff', label: 'Waloryzacja',
    icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
      </svg>
    ),
  },
  meeting: {
    color: '#553c9a', bg: '#faf5ff', label: 'Spotkanie',
    icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  note: {
    color: '#374151', bg: '#f3f4f6', label: 'Notatka',
    icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  alert: {
    color: '#92400e', bg: '#fffbeb', label: 'Alert',
    icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
  },
  today: {
    color: '#e85c04', bg: '#fff8f4', label: 'Dziś',
    icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="6"/>
      </svg>
    ),
  },
}

function TimelineTab({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return <p style={{ fontSize: 13, color: '#9e9389', margin: 0 }}>Brak zdarzeń na osi czasu.</p>
  }

  return (
    <div style={{ position: 'relative', paddingLeft: 28 }}>
      {/* Vertical line */}
      <div style={{
        position: 'absolute', left: 10, top: 6, bottom: 6,
        width: 2, background: 'linear-gradient(to bottom, #e3e0db, #f2f0ed)',
        borderRadius: 2,
      }} />

      {events.map((ev, i) => {
        const meta = EVENT_META[ev.type]
        const isToday = ev.type === 'today'

        if (isToday) {
          return (
            <div key={ev.id} style={{
              position: 'relative', marginBottom: 6, display: 'flex', alignItems: 'center',
              marginLeft: -28, paddingLeft: 0,
            }}>
              {/* Today dot */}
              <div style={{
                position: 'absolute', left: 4, width: 14, height: 14, borderRadius: '50%',
                background: '#e85c04', border: '3px solid white',
                boxShadow: '0 0 0 2px #e85c04',
                zIndex: 1,
              }} />
              <div style={{
                marginLeft: 28,
                flex: 1, background: '#fff8f4',
                border: '1.5px solid #f2b48a', borderRadius: 8,
                padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: '#e85c04', animation: 'pulse 2s infinite',
                }} />
                <span style={{ fontSize: 12, fontWeight: 800, color: '#e85c04', letterSpacing: '0.04em' }}>
                  DZIŚ — {ev.label}
                </span>
              </div>
            </div>
          )
        }

        return (
          <div
            key={ev.id}
            style={{
              position: 'relative', marginBottom: i < events.length - 1 ? 10 : 0,
              marginLeft: -28, paddingLeft: 28,
              opacity: ev.future ? 0.75 : 1,
            }}
          >
            {/* Dot */}
            <div style={{
              position: 'absolute', left: 4, top: 14,
              width: 12, height: 12, borderRadius: '50%',
              background: ev.future ? '#f2f0ed' : meta.color,
              border: ev.future ? `2px dashed ${meta.color}` : `2px solid white`,
              boxShadow: ev.future ? 'none' : `0 0 0 1.5px ${meta.color}40`,
              zIndex: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }} />

            {/* Card */}
            <div style={{
              background: ev.future ? '#fafaf9' : 'white',
              border: `1px solid ${ev.future ? '#e3e0db' : meta.color + '30'}`,
              borderLeft: `3px solid ${meta.color}`,
              borderRadius: 8, padding: '10px 14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Badge + title row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                      background: meta.bg, color: meta.color,
                    }}>
                      {meta.icon}
                      {meta.label}
                    </span>
                    {ev.future && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                        background: '#fafaf9', color: '#9e9389', border: '1px dashed #c9c4be',
                      }}>
                        zaplanowane
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1714', marginBottom: ev.detail ? 3 : 0 }}>
                    {ev.title}
                  </div>
                  {ev.detail && (
                    <div style={{ fontSize: 12, color: '#6b6b6b', lineHeight: 1.45 }}>
                      {ev.detail}
                    </div>
                  )}
                </div>
                {/* Date + author */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: ev.future ? meta.color : '#9e9389', whiteSpace: 'nowrap' }}>
                    {ev.label}
                  </div>
                  {ev.author && (
                    <div style={{ fontSize: 10, color: '#b5afa8', marginTop: 2 }}>{ev.author}</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
