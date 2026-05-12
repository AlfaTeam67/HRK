import { useRef, useState, useMemo } from 'react'
import { cardStyle as card } from '@/lib/styles'
import { useAppSelector } from '@/hooks/store'
import { useAlerts, useDashboardKpi } from '@/hooks/alerts'
import { Modal } from '@/components/ui/modal'
import { useCustomers } from '@/hooks/customers'
import { useUploadDocument, useDocumentsQuery, useDocumentDownloadUrl, useDeleteDocument } from '@/hooks/documents'
import { useContracts, useDeleteContract, useCreateContract } from '@/hooks/contracts'
import type { DocumentType, ContractType, ContractStatus, BillingCycle, ContractCreate } from '@/types/models'

/* ─── Style helpers ──────────────────────────────────────────── */
const STATUS_S: Record<string, { bg: string; color: string }> = {
  'draft':      { bg: '#f2f0ed', color: '#6b6b6b' },
  'signed':     { bg: '#eef2ff', color: '#4338ca' },
  'active':     { bg: '#f0fff4', color: '#276749' },
  'terminated': { bg: '#fff5f0', color: '#c94f02' },
  'expiring':   { bg: '#fffbeb', color: '#92400e' },
}

const CONTRACT_TYPES = ['ramowa', 'aneks', 'SLA', 'DPA', 'PPK', 'inne'] as const

const OCR_S: Record<string, { bg: string; color: string }> = {
  pending:    { bg: '#f2f0ed', color: '#6b6b6b' },
  processing: { bg: '#eff6ff', color: '#1d4ed8' },
  done:       { bg: '#f0fff4', color: '#276749' },
  failed:     { bg: '#fff5f0', color: '#c94f02' },
  skipped:    { bg: '#fafaf9', color: '#9e9389' },
}

const OCR_LABEL: Record<string, string> = {
  pending:    'Oczekuje',
  processing: 'Przetwarza…',
  done:       'RAG gotowy',
  failed:     'Błąd OCR',
  skipped:    'Pominięto',
}

/* ─── Component ──────────────────────────────────────────────── */
export function ContractsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isContractModalOpen, setIsContractModalOpen] = useState(false)
  const user = useAppSelector((s) => s.auth.user)

  // Page-level filters
  const [filterCustomerId, setFilterCustomerId] = useState('')
  const [filterContractType, setFilterContractType] = useState('')

  // Upload modal state
  const [uploadCustomerId, setUploadCustomerId] = useState('')
  const [uploadContractId, setUploadContractId] = useState('')
  const [selectedDocType, setSelectedDocType] = useState<DocumentType>('contract')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Preview / delete state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // New Contract state
  const [contractForm, setContractForm] = useState<Partial<ContractCreate>>({
    customer_id: '',
    contract_number: '',
    contract_type: 'ramowa' as ContractType,
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    billing_cycle: '' as BillingCycle,
    status: 'draft' as ContractStatus,
  })

  // Data hooks
  const { data: customers = [] } = useCustomers()
  const { data: realContracts = [], isLoading: contractsLoading } = useContracts(
    filterCustomerId ? { customer_id: filterCustomerId } : undefined
  )
  const { data: allDocuments = [] } = useDocumentsQuery()
  // Contracts for upload modal dropdown — fetched by selected customer
  const { data: uploadModalContracts = [] } = useContracts(
    uploadCustomerId ? { customer_id: uploadCustomerId } : undefined
  )
  const { data: realAlerts, isLoading: alertsLoading } = useAlerts(user?.id)
  const { data: kpiData, isLoading: kpiLoading } = useDashboardKpi(user?.id)

  const uploadDoc = useUploadDocument()
  const deleteDoc = useDeleteDocument()
  const deleteContract = useDeleteContract()
  const createContract = useCreateContract()
  const getDownloadUrl = useDocumentDownloadUrl()

  // Client-side filter by contract type
  const filteredContracts = useMemo(() => {
    if (!filterContractType) return realContracts
    return realContracts.filter(c => c.contract_type === filterContractType)
  }, [realContracts, filterContractType])

  // Map: contract_id → first linked document (for preview lookup)
  const docsMap = useMemo(() => {
    const map = new Map<string, typeof allDocuments[0]>()
    for (const doc of allDocuments) {
      if (doc.contract_id && !map.has(doc.contract_id)) {
        map.set(doc.contract_id, doc)
      }
    }
    return map
  }, [allDocuments])

  // KPIs
  const exp30 = alertsLoading ? null : (realAlerts?.filter(a => a.type === 'contract_expiry_30').length ?? 0)
  const exp60 = alertsLoading ? null : (realAlerts?.filter(a => a.type === 'contract_expiry_60').length ?? 0)
  const exp90 = alertsLoading ? null : (realAlerts?.filter(a => a.type === 'contract_expiry_90').length ?? 0)
  const activeContractsCount = kpiLoading ? null : (kpiData?.active_contracts ?? 0)

  const kpis = [
    { label: 'KOŃCZĄ SIĘ W 30 DNI', value: exp30 === null ? '—' : String(exp30), sub: 'Wysoki priorytet', color: '#e85c04' },
    { label: 'KOŃCZĄ SIĘ W 60 DNI', value: exp60 === null ? '—' : String(exp60), sub: 'Przygotuj ofertę', color: '#d69e2e' },
    { label: 'KOŃCZĄ SIĘ W 90 DNI', value: exp90 === null ? '—' : String(exp90), sub: 'Wczesny kontakt', color: '#3182ce' },
    { label: 'AKTYWNYCH UMÓW', value: activeContractsCount === null ? '—' : String(activeContractsCount), sub: 'Łącznie w systemie', color: '#38a169' },
  ]

  const handleUpload = async () => {
    if (!selectedFile || !user?.id) return
    try {
      await uploadDoc.mutateAsync({
        file: selectedFile,
        document_type: selectedDocType,
        customer_id: uploadCustomerId || undefined,
        contract_id: uploadContractId || undefined,
        uploaded_by: user.id,
      })
      setIsModalOpen(false)
      setSelectedFile(null)
      setUploadCustomerId('')
      setUploadContractId('')
      alert('Dokument przesłany pomyślnie. Proces OCR i RAG został uruchomiony.')
    } catch (err) {
      console.error('Upload failed:', err)
      alert('Nie udało się przesłać dokumentu.')
    }
  }

  const handlePreview = async (contractId: string) => {
    if (!user?.id) return
    const doc = docsMap.get(contractId)
    if (!doc) {
      alert('Brak powiązanego dokumentu dla tej umowy.')
      return
    }
    try {
      const { url } = await getDownloadUrl.mutateAsync({ id: doc.id, userId: user.id })
      setPreviewUrl(url)
      setIsPreviewOpen(true)
    } catch (err) {
      console.error('Failed to get preview URL:', err)
      alert('Nie udało się wygenerować podglądu dokumentu.')
    }
  }

  const handleDelete = async (contractId: string) => {
    if (!window.confirm('Czy na pewno chcesz usunąć tę umowę?')) return
    setDeletingId(contractId)
    try {
      const doc = docsMap.get(contractId)
      if (doc && user?.id) {
        await deleteDoc.mutateAsync({ id: doc.id, userId: user.id })
      }
      await deleteContract.mutateAsync(contractId)
    } catch {
      alert('Nie udało się usunąć umowy. Spróbuj ponownie.')
    } finally {
      setDeletingId(null)
    }
  }

  const handleCreateContract = async () => {
    if (!contractForm.customer_id || !contractForm.contract_number) {
      alert('Proszę wypełnić wymagane pola (Klient i Numer umowy).')
      return
    }

    try {
      await createContract.mutateAsync({
        ...contractForm,
        account_manager_id: user?.id,
      } as ContractCreate)
      setIsContractModalOpen(false)
      setContractForm({
        customer_id: '',
        contract_number: '',
        contract_type: 'ramowa' as ContractType,
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        billing_cycle: '' as BillingCycle,
        status: 'draft' as ContractStatus,
      })
      alert('Umowa została utworzona pomyślnie.')
    } catch (err) {
      console.error('Failed to create contract:', err)
      alert('Nie udało się utworzyć umowy.')
    }
  }

  return (
    <div style={{ width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1714', margin: 0, marginBottom: 2 }}>Umowy i Dokumenty</h1>
          <p style={{ fontSize: 12.5, color: '#9e9389', margin: 0 }}>Zarządzanie cyklem życia kontraktów i repozytorium dokumentów RAG.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setIsContractModalOpen(true)}
            style={{ background: 'white', color: '#e85c04', border: '1px solid #e85c04', borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <span>+</span> Nowa Umowa
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            style={{ background: 'linear-gradient(135deg, #e85c04, #c94f02)', color: 'white', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(232, 92, 4, 0.25)', display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <span>+</span> Nowy Dokument
          </button>
        </div>
      </div>

      {/* Upload Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Prześlij nowy dokument">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#1a1714' }}>Klient</label>
            <select
              value={uploadCustomerId}
              onChange={(e) => { setUploadCustomerId(e.target.value); setUploadContractId('') }}
              style={{ padding: '10px', borderRadius: 6, border: '1px solid #e3e0db', fontSize: 13, background: 'white' }}
            >
              <option value="">Wybierz klienta (opcjonalnie)...</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.company_name || c.ckk}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#1a1714' }}>Umowa (opcjonalnie)</label>
            <select
              value={uploadContractId}
              onChange={(e) => setUploadContractId(e.target.value)}
              disabled={!uploadCustomerId}
              style={{ padding: '10px', borderRadius: 6, border: '1px solid #e3e0db', fontSize: 13, background: uploadCustomerId ? 'white' : '#fafaf9', color: uploadCustomerId ? '#1a1714' : '#9e9389' }}
            >
              <option value="">{uploadCustomerId ? 'Wybierz umowę...' : 'Wybierz najpierw klienta'}</option>
              {uploadModalContracts.map(c => <option key={c.id} value={c.id}>{c.contract_number}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#1a1714' }}>Typ dokumentu</label>
            <select
              value={selectedDocType}
              onChange={(e) => setSelectedDocType(e.target.value as DocumentType)}
              style={{ padding: '10px', borderRadius: 6, border: '1px solid #e3e0db', fontSize: 13, background: 'white' }}
            >
              <option value="contract">Umowa</option>
              <option value="amendment">Aneks</option>
              <option value="service_order">Zamówienie</option>
              <option value="other">Inny</option>
            </select>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept=".pdf,.doc,.docx"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
          />

          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: selectedFile ? '2px solid #38a169' : '2px dashed #e3e0db',
              borderRadius: 8, padding: '32px 20px', textAlign: 'center', background: selectedFile ? '#f0fff4' : '#fafaf9', cursor: 'pointer',
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 8 }}>{selectedFile ? '✅' : '📄'}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1714' }}>{selectedFile ? selectedFile.name : 'Kliknij, aby wybrać plik'}</div>
            <div style={{ fontSize: 11, color: '#9e9389' }}>PDF, DOCX, TXT (max 15MB)</div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <button onClick={() => setIsModalOpen(false)} style={{ flex: 1, padding: '10px', borderRadius: 6, border: '1px solid #e3e0db', background: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Anuluj</button>
            <button
              onClick={handleUpload}
              disabled={!selectedFile || uploadDoc.isPending}
              style={{ flex: 1, padding: '10px', borderRadius: 6, border: 'none', background: (!selectedFile || uploadDoc.isPending) ? '#9e9389' : '#e85c04', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              {uploadDoc.isPending ? 'Przesyłanie...' : 'Utwórz i prześlij'}
            </button>
          </div>
        </div>
      </Modal>

      {/* New Contract Modal */}
      <Modal isOpen={isContractModalOpen} onClose={() => setIsContractModalOpen(false)} title="Utwórz nową umowę">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#1a1714' }}>Klient *</label>
            <select
              value={contractForm.customer_id}
              onChange={(e) => setContractForm(prev => ({ ...prev, customer_id: e.target.value }))}
              style={{ padding: '10px', borderRadius: 8, border: '1px solid #e3e0db', fontSize: 13, background: 'white', transition: 'border-color 0.2s' }}
            >
              <option value="">Wybierz klienta...</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.company_name || c.ckk}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#1a1714' }}>Numer umowy *</label>
            <input
              type="text"
              value={contractForm.contract_number}
              placeholder="np. HRK/2024/001"
              onChange={(e) => setContractForm(prev => ({ ...prev, contract_number: e.target.value }))}
              style={{ padding: '10px', borderRadius: 8, border: '1px solid #e3e0db', fontSize: 13, transition: 'border-color 0.2s' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#1a1714' }}>Typ umowy</label>
              <select
                value={contractForm.contract_type}
                onChange={(e) => setContractForm(prev => ({ ...prev, contract_type: e.target.value as ContractType }))}
                style={{ padding: '10px', borderRadius: 8, border: '1px solid #e3e0db', fontSize: 13, background: 'white' }}
              >
                {CONTRACT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#1a1714' }}>Cykl rozliczeniowy</label>
              <select
                value={contractForm.billing_cycle || ''}
                onChange={(e) => setContractForm(prev => ({ ...prev, billing_cycle: e.target.value as BillingCycle }))}
                style={{ padding: '10px', borderRadius: 8, border: '1px solid #e3e0db', fontSize: 13, background: 'white' }}
              >
                <option value="">Wybierz...</option>
                <option value="monthly">Miesięczny</option>
                <option value="quarterly">Kwartalny</option>
                <option value="annual">Roczny</option>
                <option value="one_time">Jednorazowy</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#1a1714' }}>Data rozpoczęcia *</label>
              <input
                type="date"
                value={contractForm.start_date}
                onChange={(e) => setContractForm(prev => ({ ...prev, start_date: e.target.value }))}
                style={{ padding: '10px', borderRadius: 8, border: '1px solid #e3e0db', fontSize: 13 }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#1a1714' }}>Data zakończenia</label>
              <input
                type="date"
                value={contractForm.end_date || ''}
                onChange={(e) => setContractForm(prev => ({ ...prev, end_date: e.target.value }))}
                style={{ padding: '10px', borderRadius: 8, border: '1px solid #e3e0db', fontSize: 13 }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <button 
              onClick={() => setIsContractModalOpen(false)} 
              style={{ flex: 1, padding: '12px', borderRadius: 8, border: '1px solid #e3e0db', background: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }}
              onMouseOver={(e) => e.currentTarget.style.background = '#fafaf9'}
              onMouseOut={(e) => e.currentTarget.style.background = 'white'}
            >
              Anuluj
            </button>
            <button
              onClick={handleCreateContract}
              disabled={createContract.isPending}
              style={{ 
                flex: 1, padding: '12px', borderRadius: 8, border: 'none', 
                background: createContract.isPending ? '#9e9389' : 'linear-gradient(135deg, #e85c04, #c94f02)', 
                color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(232, 92, 4, 0.2)'
              }}
            >
              {createContract.isPending ? 'Tworzenie...' : 'Utwórz umowę'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Preview Modal */}
      <Modal
        isOpen={isPreviewOpen}
        onClose={() => { setIsPreviewOpen(false); setPreviewUrl(null) }}
        title="Podgląd dokumentu"
        maxWidth="1200px"
      >
        <div style={{ height: '80vh', background: '#f5f2ef', borderRadius: 8, overflow: 'hidden' }}>
          {previewUrl ? (
            <iframe src={previewUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="Document Preview" />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9e9389' }}>
              Ładowanie podglądu...
            </div>
          )}
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

      {/* Contracts table */}
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #f2f0ed', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1714' }}>Rejestr Umów</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <select
              value={filterCustomerId}
              onChange={(e) => setFilterCustomerId(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e3e0db', fontSize: 12, background: 'white', color: '#1a1714' }}
            >
              <option value="">Wszyscy klienci</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.company_name || c.ckk}</option>)}
            </select>
            <select
              value={filterContractType}
              onChange={(e) => setFilterContractType(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e3e0db', fontSize: 12, background: 'white', color: '#1a1714' }}
            >
              <option value="">Wszystkie typy</option>
              {CONTRACT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #f2f0ed', background: '#fafaf9' }}>
              <th style={{ padding: '12px 18px', fontSize: 11, fontWeight: 700, color: '#9e9389' }}>NR UMOWY / KLIENT</th>
              <th style={{ padding: '12px 18px', fontSize: 11, fontWeight: 700, color: '#9e9389' }}>TYP</th>
              <th style={{ padding: '12px 18px', fontSize: 11, fontWeight: 700, color: '#9e9389' }}>STATUS</th>
              <th style={{ padding: '12px 18px', fontSize: 11, fontWeight: 700, color: '#9e9389' }}>TERMIN</th>
              <th style={{ padding: '12px 18px', fontSize: 11, fontWeight: 700, color: '#9e9389' }}>DOKUMENT</th>
              <th style={{ padding: '12px 18px', fontSize: 11, fontWeight: 700, color: '#9e9389' }}></th>
            </tr>
          </thead>
          <tbody>
            {contractsLoading ? (
              <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#9e9389' }}>Ładowanie danych...</td></tr>
            ) : filteredContracts.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#9e9389' }}>Brak umów spełniających kryteria.</td></tr>
            ) : filteredContracts.map((c) => {
              const client = customers.find(cust => cust.id === c.customer_id)
              const statusStyles = STATUS_S[c.status] || STATUS_S['draft']
              const linkedDoc = docsMap.get(c.id)
              const isDeleting = deletingId === c.id
              return (
                <tr key={c.id} style={{ borderBottom: '1px solid #f2f0ed', fontSize: 12.5, opacity: isDeleting ? 0.5 : 1 }}>
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ fontWeight: 700, color: '#1a1714' }}>{c.contract_number}</div>
                    <div style={{ fontSize: 11, color: '#9e9389' }}>{client?.company_name || 'Nieznany klient'}</div>
                  </td>
                  <td style={{ padding: '14px 18px', color: '#4b5563' }}>{c.contract_type}</td>
                  <td style={{ padding: '14px 18px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: statusStyles.bg, color: statusStyles.color }}>
                      {c.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '14px 18px', color: '#4b5563' }}>
                    {c.end_date || 'Bezterminowa'}
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    {linkedDoc ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          onClick={() => handlePreview(c.id)}
                          style={{ background: 'none', border: '1px solid #e3e0db', borderRadius: 4, padding: '4px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer', color: '#e85c04', whiteSpace: 'nowrap' }}
                        >
                          PODGLĄD
                        </button>
                        {(() => {
                          const status = linkedDoc.ocr_status ?? 'pending'
                          const s = OCR_S[status] ?? OCR_S['pending']
                          return (
                            <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
                              {OCR_LABEL[status] ?? status}
                            </span>
                          )
                        })()}
                      </div>
                    ) : (
                      <span style={{ fontSize: 11, color: '#c8c2ba' }}>Brak pliku</span>
                    )}
                  </td>
                  <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                    <button
                      onClick={() => handleDelete(c.id)}
                      disabled={isDeleting}
                      title="Usuń umowę"
                      style={{ background: 'none', border: '1px solid #f2cfc8', borderRadius: 4, padding: '4px 8px', fontSize: 12, cursor: isDeleting ? 'not-allowed' : 'pointer', color: '#c94f02', lineHeight: 1 }}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
