import { useState, useMemo } from 'react'
import { cardStyle } from '@/lib/styles'
import { useAppSelector } from '@/hooks/store'
import { useCustomers } from '@/hooks/customers'
import { useContracts } from '@/hooks/contracts'
import { useNotes, useCreateNote } from '@/hooks/notes'
import { Modal } from '@/components/ui/modal'
import type { components } from '@/types/api'

type NoteType = components['schemas']['NoteType']

export function ManagerDashboardPage() {
  const user = useAppSelector((s) => s.auth.user)
  const { data: managedCustomers, isLoading: loadingCustomers } = useCustomers({
    manager_id: user?.id,
  })

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false)
  const [newNoteContent, setNewNoteContent] = useState('')
  const [newNoteType, setNewNoteType] = useState<NoteType>('internal')

  const activeCustomer = useMemo(() => {
    if (selectedCustomerId) return managedCustomers?.find(c => c.id === selectedCustomerId)
    return managedCustomers?.[0]
  }, [managedCustomers, selectedCustomerId])

  const { data: contracts } = useContracts({
    customer_id: activeCustomer?.id,
  })

  const { data: notes, isLoading: loadingNotes } = useNotes({
    customer_id: activeCustomer?.id,
  })

  const createNoteMutation = useCreateNote()

  const portfolioStats = useMemo(() => {
    if (!managedCustomers) return { totalEmployees: 0, activeCount: 0, attentionCount: 0, riskCount: 0 }
    return managedCustomers.reduce((acc, c) => ({
      totalEmployees: acc.totalEmployees + (c.employee_count || 0),
      activeCount: acc.activeCount + (c.status === 'active' ? 1 : 0),
      attentionCount: acc.attentionCount + (c.status === 'needs_attention' ? 1 : 0),
      riskCount: acc.riskCount + (c.status === 'churn_risk' ? 1 : 0),
    }), { totalEmployees: 0, activeCount: 0, attentionCount: 0, riskCount: 0 })
  }, [managedCustomers])

  const handleAddNote = async () => {
    if (!activeCustomer || !newNoteContent) return
    try {
      await createNoteMutation.mutateAsync({
        customer_id: activeCustomer.id,
        note_type: newNoteType,
        content: newNoteContent,
      })
      setIsNoteModalOpen(false)
      setNewNoteContent('')
      setNewNoteType('internal')
    } catch (err) {
      console.error('Failed to add note:', err)
    }
  }

  if (loadingCustomers) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#9e9389' }}>
      Ładowanie Twojego portfela...
    </div>
  )

  if (!managedCustomers || managedCustomers.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', background: 'white', borderRadius: 12, border: '1px solid #e3e0db' }}>
        <div style={{ fontSize: 48, marginBottom: 20 }}>🏢</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1a1714', marginBottom: 10 }}>Brak przypisanych firm</h2>
        <p style={{ color: '#9e9389', fontSize: 14, maxWidth: 400, margin: '0 auto' }}>
          Jako opiekun klienta, tutaj zobaczysz zestawienie najważniejszych informacji o firmach, za które jesteś odpowiedzialny. 
        </p>
      </div>
    )
  }

  const todayStr = new Intl.DateTimeFormat('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())

  const noteTypeLabels: Record<NoteType, string> = {
    meeting: 'Spotkanie',
    call: 'Telefon',
    internal: 'Wewnętrzna',
    client_request: 'Prośba klienta',
    other: 'Inne'
  }

  return (
    <div className="manager-dashboard" style={{ width: '100%', maxWidth: '100vw', overflowX: 'hidden' }}>
      <style>{`
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 14px;
          margin-bottom: 24px;
        }
        .main-layout {
          display: flex;
          flex-wrap: wrap;
          gap: 20px;
        }
        .left-column {
          flex: 1;
          min-width: 320px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .right-column {
          width: 340px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        @media (max-width: 1200px) {
          .right-column {
            width: 100%;
          }
        }
        .quick-selector {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }
        .quick-btn {
          padding: 6px 12px;
          border-radius: 8px;
          border: 1px solid #e3e0db;
          background: white;
          color: #6b6b6b;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          max-width: 150px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .quick-btn.active {
          border-color: #e85c04;
          background: #fff5f0;
          color: #e85c04;
        }
        .notes-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 16px;
        }
        .header-section {
          display: flex;
          flex-wrap: wrap;
          align-items: flex-end;
          justify-content: space-between;
          margin-bottom: 24px;
          border-bottom: 1px solid #f2f0ed;
          padding-bottom: 16px;
          gap: 16px;
        }
      `}</style>

      {/* Note Modal */}
      <Modal 
        isOpen={isNoteModalOpen} 
        onClose={() => setIsNoteModalOpen(false)} 
        title={`Dodaj notatkę dla: ${activeCustomer?.company_name || activeCustomer?.ckk}`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#1a1714', display: 'block', marginBottom: 6 }}>Typ notatki</label>
            <select 
              value={newNoteType}
              onChange={(e) => setNewNoteType(e.target.value as NoteType)}
              style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #e3e0db', fontSize: 14, background: 'white' }}
            >
              {(Object.keys(noteTypeLabels) as NoteType[]).map(type => (
                <option key={type} value={type}>{noteTypeLabels[type]}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#1a1714', display: 'block', marginBottom: 6 }}>Treść notatki</label>
            <textarea 
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              placeholder="Opisz najważniejsze ustalenia..."
              rows={5}
              style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #e3e0db', fontSize: 14, resize: 'none' }}
            />
          </div>
          <button 
            onClick={handleAddNote}
            disabled={createNoteMutation.isPending || !newNoteContent}
            style={{ 
              marginTop: 10,
              padding: '12px', 
              background: '#e85c04', 
              color: 'white', 
              border: 'none', 
              borderRadius: 8, 
              fontWeight: 800, 
              cursor: 'pointer',
              opacity: createNoteMutation.isPending || !newNoteContent ? 0.6 : 1
            }}
          >
            {createNoteMutation.isPending ? 'Zapisywanie...' : 'ZAPISZ NOTATKĘ'}
          </button>
        </div>
      </Modal>

      {/* Portfolio Header */}
      <div className="header-section">
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#e85c04', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Panel Opiekuna Klienta</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1a1714', margin: 0 }}>Cześć, Katarzyno! 👋</h1>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1714' }}>{user?.displayName || 'Katarzyna Nowakowska'}</div>
          <div style={{ fontSize: 11, color: '#9e9389', textTransform: 'capitalize' }}>{todayStr}</div>
        </div>
      </div>

      {/* Portfolio Stats */}
      <div className="stats-grid">
        <div style={{ ...cardStyle, padding: '18px', background: 'linear-gradient(135deg, #e85c04 0%, #c94f02 100%)', color: 'white', border: 'none', boxShadow: '0 4px 14px rgba(232, 92, 4, 0.25)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.05em', marginBottom: 10 }}>FIRMY</div>
          <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 2 }}>{managedCustomers.length}</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)' }}>Aktywnych podmiotów</div>
        </div>
        <div style={{ ...cardStyle, padding: '18px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9e9389', letterSpacing: '0.05em', marginBottom: 10 }}>PRACOWNICY</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#1a1714', marginBottom: 2 }}>{portfolioStats.totalEmployees.toLocaleString()}</div>
          <div style={{ height: 3, background: '#f5f2ef', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
            <div style={{ width: '70%', height: '100%', background: '#e85c04' }} />
          </div>
        </div>
        <div style={{ ...cardStyle, padding: '18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9e9389', letterSpacing: '0.05em', marginBottom: 6 }}>ZDROWIE PORTFELA</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 32, marginBottom: 4 }}>
            <div title="Active" style={{ flex: portfolioStats.activeCount || 1, background: '#38a169', height: '100%', borderRadius: '4px 0 0 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: 'white' }}>{portfolioStats.activeCount}</div>
            <div title="Needs Attention" style={{ flex: portfolioStats.attentionCount || 0, background: '#d69e2e', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: 'white' }}>{portfolioStats.attentionCount > 0 ? portfolioStats.attentionCount : ''}</div>
            <div title="Churn Risk" style={{ flex: portfolioStats.riskCount || 0, background: '#e53e3e', height: '100%', borderRadius: '0 4px 4px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: 'white' }}>{portfolioStats.riskCount > 0 ? portfolioStats.riskCount : ''}</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontWeight: 700 }}>
            <span style={{ color: '#38a169' }}>AKTYWNE</span>
            <span style={{ color: '#e53e3e' }}>RYZYKO</span>
          </div>
        </div>
        <div style={{ ...cardStyle, padding: '18px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9e9389', letterSpacing: '0.05em', marginBottom: 10 }}>ROZKŁAD BRANŻ</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
               <span style={{ fontSize: 9, fontWeight: 600 }}>Retail</span>
               <div style={{ width: 60, height: 4, background: '#f5f2ef', borderRadius: 2, overflow: 'hidden' }}>
                 <div style={{ width: '80%', height: '100%', background: '#e85c04' }} />
               </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
               <span style={{ fontSize: 9, fontWeight: 600 }}>E-comm</span>
               <div style={{ width: 60, height: 4, background: '#f5f2ef', borderRadius: 2, overflow: 'hidden' }}>
                 <div style={{ width: '40%', height: '100%', background: '#1a1714' }} />
               </div>
            </div>
          </div>
        </div>
        <div style={{ ...cardStyle, padding: '18px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9e9389', letterSpacing: '0.05em', marginBottom: 10 }}>WALORYZACJE</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#1a1714', marginBottom: 2 }}>3</div>
          <div style={{ fontSize: 10, color: '#e53e3e', fontWeight: 700 }}>Wymagane akcje</div>
        </div>
      </div>

      <div className="main-layout">
        {/* Left Column */}
        <div className="left-column">
          <div style={{ ...cardStyle, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: '#1a1714', margin: 0 }}>Szybki wybór:</h3>
            <div className="quick-selector">
              {managedCustomers.slice(0, 6).map(c => (
                <button 
                  key={c.id} 
                  onClick={() => setSelectedCustomerId(c.id)}
                  className={`quick-btn ${activeCustomer?.id === c.id ? 'active' : ''}`}
                  title={c.company_name || c.ckk}
                >
                  {c.company_name || c.ckk}
                </button>
              ))}
              <select 
                value={activeCustomer?.id} 
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #e3e0db', fontSize: 12, fontWeight: 600, background: '#fafaf9', minWidth: 120 }}
              >
                {managedCustomers.map(c => <option key={c.id} value={c.id}>{c.company_name || c.ckk}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
            <div style={{ ...cardStyle, padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: '#fff5f0', color: '#e85c04', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🏢</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#1a1714', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={activeCustomer?.company_name || activeCustomer?.ckk}>
                    {activeCustomer?.company_name || activeCustomer?.ckk}
                  </div>
                  <div style={{ fontSize: 12, color: '#9e9389', fontWeight: 600 }}>{activeCustomer?.industry} · {activeCustomer?.segment}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div style={{ padding: '12px', background: '#fafaf9', borderRadius: 10, border: '1px solid #f2f0ed' }}>
                  <div style={{ fontSize: 10, color: '#9e9389', fontWeight: 700, marginBottom: 4 }}>NIP</div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{activeCustomer?.invoice_nip || '—'}</div>
                </div>
                <div style={{ padding: '12px', background: '#fafaf9', borderRadius: 10, border: '1px solid #f2f0ed' }}>
                  <div style={{ fontSize: 10, color: '#9e9389', fontWeight: 700, marginBottom: 4 }}>PRACOWNICY</div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{activeCustomer?.employee_count?.toLocaleString()} os.</div>
                </div>
              </div>
              <div style={{ padding: '12px', borderRadius: 10, background: activeCustomer?.status === 'active' ? '#f0fff4' : '#fff5f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                   <div style={{ width: 8, height: 8, borderRadius: '50%', background: activeCustomer?.status === 'active' ? '#38a169' : activeCustomer?.status === 'churn_risk' ? '#e53e3e' : '#d69e2e' }} />
                   <span style={{ fontSize: 12, fontWeight: 800, color: activeCustomer?.status === 'active' ? '#276749' : '#c94f02' }}>
                     {activeCustomer?.status === 'active' ? 'AKTYWNY' : 
                      activeCustomer?.status === 'churn_risk' ? 'RYZYKO ODEJŚCIA' : 
                      activeCustomer?.status === 'needs_attention' ? 'WYMAGA UWAGI' : 
                      activeCustomer?.status.toUpperCase()}
                   </span>
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.8, whiteSpace: 'nowrap' }}>Zdrowie relacji: 8.5/10</div>
              </div>
            </div>

            <div style={{ ...cardStyle, padding: '20px' }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: '#1a1714', margin: '0 0 16px 0' }}>Aktywne umowy ({contracts?.length || 0})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {contracts?.slice(0, 3).map(c => (
                  <div key={c.id} style={{ padding: '12px', border: '1px solid #f2f0ed', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fcfcfb' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.contract_number}</div>
                      <div style={{ fontSize: 10, color: '#9e9389' }}>Do: {c.end_date}</div>
                    </div>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 8 }}>📄</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Real Notes Section */}
          <div style={{ ...cardStyle, padding: '20px' }}>
             <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 10 }}>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: '#1a1714', margin: 0 }}>Ostatnie notatki wewnętrzne</h3>
                <button 
                  onClick={() => setIsNoteModalOpen(true)}
                  style={{ background: '#f5f2ef', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  + DODAJ NOTATKĘ
                </button>
             </div>
             <div className="notes-grid">
                {notes?.slice(0, 2).map(n => (
                   <div key={n.id} style={{ padding: '12px', background: '#fcfcfb', border: '1px solid #f2f0ed', borderRadius: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
                        <span style={{ 
                          fontSize: 9, 
                          fontWeight: 800, 
                          padding: '2px 6px', 
                          borderRadius: 4, 
                          background: '#fff5f0', 
                          color: '#e85c04',
                          textTransform: 'uppercase',
                          whiteSpace: 'nowrap'
                        }}>
                          {noteTypeLabels[n.note_type as NoteType] || n.note_type}
                        </span>
                        <div style={{ fontSize: 10, color: '#9e9389', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {n.created_at ? new Date(n.created_at).toLocaleDateString('pl-PL') : 'brak daty'}
                        </div>
                      </div>
                      <p style={{ fontSize: 12, color: '#1a1714', margin: 0, lineHeight: 1.4 }}>{n.content}</p>
                   </div>
                ))}
                {(!notes || notes.length === 0) && !loadingNotes && (
                   <div style={{ gridColumn: 'span 2', padding: '20px', textAlign: 'center', color: '#9e9389', fontSize: 12 }}>
                      Brak notatek dla tego klienta.
                   </div>
                )}
             </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="right-column">
          <div style={{ ...cardStyle, padding: '20px', background: '#fafaf9' }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: '#1a1714', margin: '0 0 16px 0' }}>Planowane waloryzacje</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
               {[
                 { client: 'Allegro.pl', date: '15 Maj 2024', val: '4.5%' },
                 { client: 'Rossmann', date: '01 Cze 2024', val: '5.2%' },
               ].map((v, i) => (
                 <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                       <div style={{ fontSize: 12, fontWeight: 800 }}>{v.client}</div>
                       <div style={{ fontSize: 10, color: '#9e9389' }}>{v.date}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#e85c04' }}>+{v.val}</div>
                 </div>
               ))}
            </div>
          </div>

          <div style={{ ...cardStyle, padding: '20px' }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: '#1a1714', margin: '0 0 16px 0' }}>Ostatnie zdarzenia</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {[
                { type: 'EMAIL', text: 'Wysłano raport do Empik', time: '2h temu', color: '#4299e1' },
                { type: 'CALL', text: 'Rozmowa z Rossmann', time: '4h temu', color: '#48bb78' },
                { type: 'DOC', text: 'Nowy aneks: Żabka', time: 'Wczoraj', color: '#e85c04' },
              ].map((ev, i) => (
                <div key={i} style={{ display: 'flex', gap: 14 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: ev.color, border: '2px solid white', boxShadow: '0 0 0 1px #f2f0ed', zIndex: 1 }} />
                    {i !== 2 && <div style={{ width: 1, flex: 1, background: '#f2f0ed', margin: '4px 0' }} />}
                  </div>
                  <div style={{ paddingBottom: i === 2 ? 0 : 4 }}>
                    <div style={{ fontSize: 12, fontWeight: 800 }}>{ev.text}</div>
                    <div style={{ fontSize: 10, color: '#9e9389' }}>{ev.type} · {ev.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ ...cardStyle, padding: '20px', background: 'linear-gradient(135deg, #fff8f4 0%, #fff 100%)', borderColor: '#fdd5b8' }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: '#c94f02', margin: '0 0 8px 0' }}>Wymagane akcje</h3>
            <p style={{ fontSize: 12, color: '#7a3c01', lineHeight: 1.5, margin: '0 0 16px 0' }}>
              Masz <strong>2 nieobsłużone alerty</strong> dotyczące waloryzacji.
            </p>
            <button style={{ width: '100%', background: '#e85c04', color: 'white', border: 'none', borderRadius: 10, padding: '10px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
              OBSŁUŻ ALERTY
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
