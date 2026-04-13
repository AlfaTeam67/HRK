import { useState } from 'react'

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

const card: React.CSSProperties = { background: 'white', borderRadius: 8, border: '1px solid #e3e0db', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }

/* ─── Component ──────────────────────────────────────────────── */
export function PortfolioPage() {
  const [selectedId, setSelectedId] = useState<number>(clients[0].id)
  const [activeTab, setActiveTab] = useState<'info' | 'contracts' | 'notes'>('info')
  const selected = clients.find((c) => c.id === selectedId)!
  const contracts = clientContracts[selected.id] ?? []
  const notes = clientNotes[selected.id] ?? []

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1714', margin: 0, marginBottom: 2 }}>Klienci</h1>
          <p style={{ fontSize: 12.5, color: '#9e9389', margin: 0 }}>Profil 360°: dane firmy, opiekunowie, historia i statusy umów.</p>
        </div>
        <button style={{ background: '#e85c04', border: 'none', borderRadius: 6, padding: '7px 16px', cursor: 'pointer', color: 'white', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Dodaj klienta
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16 }}>
        {/* List */}
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #f2f0ed' }}>
            <div style={{ position: 'relative' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9e9389" strokeWidth="2" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                name="client-search"
                placeholder="Szukaj klienta…"
                style={{ width: '100%', border: '1px solid #e3e0db', borderRadius: 6, padding: '7px 10px 7px 32px', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#1a1714', background: '#fafaf9' }}
              />
            </div>
          </div>
          {clients.map((client) => (
            <div key={client.id} onClick={() => { setSelectedId(client.id); setActiveTab('info') }} style={{ padding: '11px 14px', borderBottom: '1px solid #f9f8f6', cursor: 'pointer', background: selectedId === client.id ? '#fff8f4' : 'white', borderLeft: selectedId === client.id ? '3px solid #e85c04' : '3px solid transparent', transition: 'all 0.1s' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1714' }}>{client.name}</span>
                <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 600, background: client.riskType === 'good' ? '#f0fff4' : '#fff5f0', color: client.riskType === 'good' ? '#276749' : '#c94f02' }}>{client.risk}</span>
              </div>
              <div style={{ fontSize: 11, color: '#9e9389' }}>{client.segment} · {client.employees} prac. · {client.owner.split(' ')[1]}</div>
            </div>
          ))}
        </div>

        {/* Detail */}
        <div style={card}>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid #f2f0ed' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1a1714', margin: 0, marginBottom: 4 }}>{selected.name}</h2>
                <div style={{ fontSize: 12, color: '#9e9389', display: 'flex', gap: 12 }}>
                  <span>NIP: {selected.nip}</span><span>·</span>
                  <span>Klient od: {new Date(selected.since).toLocaleDateString('pl-PL')}</span><span>·</span>
                  <span>Płatność: {selected.paymentDays} dni</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ background: '#f0fff4', color: '#276749', fontSize: 11, padding: '4px 12px', borderRadius: 20, fontWeight: 600 }}>{selected.status}</span>
                <span style={{ background: '#fff5f0', color: '#c94f02', fontSize: 11, padding: '4px 12px', borderRadius: 20, fontWeight: 600 }}>{selected.segment}</span>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginTop: 16 }}>
              {[
                { label: 'Pracownicy', value: selected.employees.toString() },
                { label: 'Aktywne umowy', value: selected.activeContracts.toString() },
                { label: 'Wartość kontraktu', value: selected.contractValue },
                { label: 'Ostatni kontakt', value: new Date(selected.lastContact).toLocaleDateString('pl-PL') },
              ].map((kpi) => (
                <div key={kpi.label} style={{ background: '#fafaf9', borderRadius: 6, padding: '10px 12px', border: '1px solid #f2f0ed' }}>
                  <div style={{ fontSize: 10, color: '#9e9389', fontWeight: 600, marginBottom: 4 }}>{kpi.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#1a1714' }}>{kpi.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #f2f0ed', padding: '0 22px' }}>
            {(['info', 'contracts', 'notes'] as const).map((tab) => {
              const labels = { info: 'Informacje', contracts: `Umowy (${contracts.length})`, notes: `Notatki (${notes.length})` }
              return (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '11px 16px', fontSize: 13, fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer', color: activeTab === tab ? '#e85c04' : '#9e9389', borderBottom: activeTab === tab ? '2px solid #e85c04' : '2px solid transparent', transition: 'all 0.15s' }}>{labels[tab]}</button>
              )
            })}
          </div>

          <div style={{ padding: '18px 22px' }}>
            {activeTab === 'info' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ gridColumn: 'span 2', background: '#fff8f4', border: '1px solid #fdd5b8', borderRadius: 8, padding: '12px 16px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#c94f02', marginBottom: 6, display: 'flex', gap: 5, alignItems: 'center' }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="#c94f02"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
                    Podsumowanie AI
                  </div>
                  <p style={{ fontSize: 13, color: '#7a3c01', lineHeight: 1.6, margin: 0 }}>{selected.aiSummary}</p>
                </div>
                {[
                  { label: 'Opiekun główny', value: selected.owner },
                  { label: 'Zastępca opiekuna', value: selected.deputy },
                  { label: 'Segment', value: selected.segment },
                  { label: 'Termin płatności', value: `${selected.paymentDays} dni` },
                ].map((item) => (
                  <div key={item.label} style={{ background: '#fafaf9', borderRadius: 6, padding: '10px 14px', border: '1px solid #f2f0ed' }}>
                    <div style={{ fontSize: 11, color: '#9e9389', fontWeight: 600, marginBottom: 3 }}>{item.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1714' }}>{item.value}</div>
                  </div>
                ))}
              </div>
            )}
            {activeTab === 'contracts' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {contracts.map((c) => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 8, border: '1px solid #f2f0ed', background: '#fafaf9' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1714', marginBottom: 2 }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: '#9e9389' }}>{c.id} · do: {c.end}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1714' }}>{c.value}</span>
                      <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 600, background: c.status === 'Aktywna' ? '#f0fff4' : '#fff5f0', color: c.status === 'Aktywna' ? '#276749' : '#c94f02' }}>{c.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {activeTab === 'notes' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {notes.map((note, i) => (
                  <div key={i} style={{ padding: '12px 16px', borderRadius: 8, border: '1px solid #f2f0ed', background: '#fafaf9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: '#9e9389' }}>{note.date}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: note.author === 'System AI' ? '#c94f02' : '#1a1714', background: note.author === 'System AI' ? '#fff5f0' : '#f2f0ed', padding: '1px 8px', borderRadius: 20 }}>{note.author}</span>
                    </div>
                    <p style={{ fontSize: 13, color: '#374151', margin: 0, lineHeight: 1.5 }}>{note.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
