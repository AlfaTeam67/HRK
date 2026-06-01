import { useRef, useState } from 'react'

import { useContracts } from '@/hooks/contracts'
import { useUploadDocument } from '@/hooks/documents'
import { useUpdateContract } from '@/hooks/contracts'
import { useAppSelector } from '@/hooks/store'
import type { DocumentType } from '@/types/models'

/* ─── Palette (shared with ContractModal) ─── */
const C = {
  bg: '#ffffff',
  surface: '#fafaf9',
  border: '#e8e5e0',
  orange: '#e85c04',
  text: '#1a1714',
  muted: '#7a6f67',
  green: '#276749',
  greenBg: '#f0fff4',
}

const CONTRACT_DOC_TYPES: { value: DocumentType | 'main'; label: string }[] = [
  { value: 'main',              label: 'Główny dokument umowy' },
  { value: 'DPA',               label: 'DPA (ochrona danych)' },
  { value: 'PPK',               label: 'PPK' },
  { value: 'power_of_attorney', label: 'Pełnomocnictwo' },
  { value: 'other',             label: 'Inny' },
]

const CLIENT_DOC_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'power_of_attorney', label: 'Pełnomocnictwo' },
  { value: 'other',             label: 'Inny' },
]

type Scope = 'contract' | 'client'
type Step = 'context' | 'pick-contract' | 'upload'

interface Props {
  customerId: string
  preselectedContractId?: string
  allowSkip?: boolean
  onClose: () => void
}

export function UploadWizard({ customerId, preselectedContractId, allowSkip, onClose }: Props) {
  const user = useAppSelector((s) => s.auth.user)

  const initialStep: Step = preselectedContractId ? 'upload' : 'context'
  const initialScope: Scope = preselectedContractId ? 'contract' : 'client'

  const [step, setStep] = useState<Step>(initialStep)
  const [scope, setScope] = useState<Scope>(initialScope)
  const [contractId, setContractId] = useState(preselectedContractId ?? '')
  const [docType, setDocType] = useState<DocumentType | 'main'>('main')
  const [clientDocType, setClientDocType] = useState<DocumentType>('power_of_attorney')
  const [file, setFile] = useState<File | null>(null)
  const [includeInAiAssistant, setIncludeInAiAssistant] = useState<boolean>(true)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadDoc = useUploadDocument()
  const updateContract = useUpdateContract()
  const { data: contracts = [] } = useContracts({ customer_id: customerId })

  function handleBack() {
    if (step === 'upload' && scope === 'contract' && !preselectedContractId) {
      setStep('pick-contract')
    } else if (step === 'pick-contract' || (step === 'upload' && scope === 'client')) {
      setStep('context')
    }
  }

  async function handleUpload() {
    if (!file || !user?.id) return

    const isContractUpload = scope === 'contract' && contractId
    const resolvedDocType: DocumentType = docType === 'main' ? 'contract' : docType as DocumentType

    const uploaded = await uploadDoc.mutateAsync({
      file,
      document_type: resolvedDocType,
      customer_id: customerId,
      contract_id: isContractUpload ? contractId : undefined,
      uploaded_by: user.id,
      include_in_ai_assistant: includeInAiAssistant,
    })

    if (docType === 'main' && contractId && uploaded?.id) {
      await updateContract.mutateAsync({
        id: contractId,
        payload: { primary_document_id: uploaded.id },
      })
    }

    onClose()
  }

  const isBusy = uploadDoc.isPending || updateContract.isPending

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(26,23,20,0.5)', backdropFilter: 'blur(2px)',
        padding: 24,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: C.bg, borderRadius: 14, width: '100%', maxWidth: 480,
        boxShadow: '0 24px 64px rgba(0,0,0,0.22)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {step !== 'context' && !preselectedContractId && (
              <button
                onClick={handleBack}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: C.muted, padding: 0, lineHeight: 1 }}
              >←</button>
            )}
            <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>
              {step === 'context' && 'Wgraj dokument'}
              {step === 'pick-contract' && 'Wybierz umowę'}
              {step === 'upload' && (scope === 'contract' ? 'Dodaj do umowy' : 'Dokument klienta')}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 14, color: C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px' }}>
          {step === 'context' && (
            <ContextStep
              onPickContract={() => { setScope('contract'); setStep('pick-contract') }}
              onPickClient={() => { setScope('client'); setStep('upload') }}
            />
          )}

          {step === 'pick-contract' && (
            <PickContractStep
              contracts={contracts}
              selected={contractId}
              onSelect={(id) => { setContractId(id); setStep('upload') }}
            />
          )}

          {step === 'upload' && (
            <UploadStep
              scope={scope}
              docType={scope === 'contract' ? docType : clientDocType}
              file={file}
              busy={isBusy}
              allowSkip={allowSkip}
              fileInputRef={fileInputRef}
              includeInAiAssistant={includeInAiAssistant}
              onIncludeInAiAssistantChange={setIncludeInAiAssistant}
              onDocTypeChange={(v) => {
                if (scope === 'contract') setDocType(v as DocumentType | 'main')
                else setClientDocType(v as DocumentType)
              }}
              onFilePick={(f) => setFile(f)}
              onUpload={handleUpload}
              onSkip={onClose}
            />
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Step components ───────────────────────────────────────── */

function ContextStep({ onPickContract, onPickClient }: { onPickContract: () => void; onPickClient: () => void }) {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      {[
        { label: 'Do umowy', desc: 'Skan umowy, aneks, DPA, PPK', icon: '📄', onClick: onPickContract },
        { label: 'Dokument klienta', desc: 'Pełnomocnictwo, dokumenty ogólne', icon: '🏢', onClick: onPickClient },
      ].map((opt) => (
        <button
          key={opt.label}
          onClick={opt.onClick}
          style={{
            flex: 1, padding: '20px 16px', borderRadius: 10, border: `1px solid ${C.border}`,
            background: C.surface, cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit',
            transition: 'border-color 0.15s',
          }}
          onMouseOver={(e) => (e.currentTarget.style.borderColor = C.orange)}
          onMouseOut={(e) => (e.currentTarget.style.borderColor = C.border)}
        >
          <div style={{ fontSize: 24, marginBottom: 8 }}>{opt.icon}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>{opt.label}</div>
          <div style={{ fontSize: 11, color: C.muted }}>{opt.desc}</div>
        </button>
      ))}
    </div>
  )
}

function PickContractStep({
  contracts,
  selected,
  onSelect,
}: {
  contracts: { id: string; contract_number: string; status: string; contract_type: string }[]
  selected: string
  onSelect: (id: string) => void
}) {
  if (contracts.length === 0) {
    return <p style={{ fontSize: 13, color: C.muted, textAlign: 'center', padding: '20px 0' }}>Brak umów dla tego klienta.</p>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {contracts.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c.id)}
          style={{
            padding: '12px 14px', borderRadius: 8, border: `1px solid ${selected === c.id ? C.orange : C.border}`,
            background: selected === c.id ? '#fff8f4' : 'white', cursor: 'pointer', textAlign: 'left',
            fontFamily: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{c.contract_number}</span>
          <span style={{ fontSize: 11, color: C.muted }}>{c.contract_type} · {c.status}</span>
        </button>
      ))}
    </div>
  )
}

function UploadStep({
  scope,
  docType,
  file,
  busy,
  allowSkip,
  fileInputRef,
  includeInAiAssistant,
  onIncludeInAiAssistantChange,
  onDocTypeChange,
  onFilePick,
  onUpload,
  onSkip,
}: {
  scope: Scope
  docType: DocumentType | 'main'
  file: File | null
  busy: boolean
  allowSkip?: boolean
  fileInputRef: React.RefObject<HTMLInputElement | null>
  includeInAiAssistant: boolean
  onIncludeInAiAssistantChange: (v: boolean) => void
  onDocTypeChange: (v: string) => void
  onFilePick: (f: File) => void
  onUpload: () => void
  onSkip?: () => void
}) {
  const types = scope === 'contract' ? CONTRACT_DOC_TYPES : CLIENT_DOC_TYPES

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 11.5, fontWeight: 700, color: C.muted }}>Typ dokumentu</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {types.map((t) => (
            <label
              key={t.value}
              style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '8px 10px', borderRadius: 6, border: `1px solid ${docType === t.value ? C.orange : C.border}`, background: docType === t.value ? '#fff8f4' : 'white' }}
            >
              <input
                type="radio"
                name="docType"
                value={t.value}
                checked={docType === t.value}
                onChange={(e) => onDocTypeChange(e.target.value)}
                style={{ accentColor: C.orange }}
              />
              <span style={{ fontSize: 13, color: C.text, fontWeight: docType === t.value ? 700 : 400 }}>{t.label}</span>
            </label>
          ))}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFilePick(f) }}
      />
      <div
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: file ? `2px solid ${C.green}` : '2px dashed #e3e0db',
          borderRadius: 10, padding: '24px 16px', textAlign: 'center', cursor: 'pointer',
          background: file ? C.greenBg : C.surface,
          fontSize: 13, color: file ? C.green : C.muted,
        }}
      >
        {file ? `✓ ${file.name}` : 'Upuść plik lub kliknij aby wybrać (PDF, DOCX)'}
        {!file && <div style={{ fontSize: 11, marginTop: 4 }}>max 15 MB</div>}
      </div>

      <label
        style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          padding: '10px 12px', borderRadius: 8,
          border: `1px solid ${C.border}`, background: C.surface, cursor: 'pointer',
        }}
      >
        <input
          type="checkbox"
          checked={includeInAiAssistant}
          onChange={(e) => onIncludeInAiAssistantChange(e.target.checked)}
          style={{ accentColor: C.orange, marginTop: 2, flexShrink: 0 }}
        />
        <span>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text, display: 'block' }}>
            Załącz dla asystenta AI <span style={{ fontWeight: 400, color: C.muted }}>(zalecane)</span>
          </span>
          <span style={{ fontSize: 11, color: C.muted, lineHeight: 1.4, display: 'block', marginTop: 2 }}>
            Plik zostanie przetworzony i dostępny w czacie z asystentem. Możesz włączyć/wyłączyć później na karcie dokumentu.
          </span>
        </span>
      </label>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        {allowSkip && (
          <button onClick={onSkip} style={{ padding: '9px 16px', borderRadius: 7, border: `1px solid ${C.border}`, background: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: C.muted }}>
            Pomiń
          </button>
        )}
        <button
          onClick={onUpload}
          disabled={!file || busy}
          style={{
            padding: '9px 20px', borderRadius: 7, border: 'none',
            background: file && !busy ? C.orange : '#e3e0db',
            color: file && !busy ? 'white' : C.muted,
            fontSize: 13, fontWeight: 700, cursor: file && !busy ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit',
          }}
        >
          {busy ? 'Wgrywam…' : 'Wgraj'}
        </button>
      </div>
    </div>
  )
}
