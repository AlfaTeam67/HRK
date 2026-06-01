import { cn } from '@/lib/utils'
import type { AiToggleState } from '@/components/ui/aiAssistantToggleHelpers'

interface Props {
  state: AiToggleState
  busy?: boolean
  onChange: (next: boolean) => void
  onRetry?: () => void
  onUnsupportedClick?: () => void
}

export function AiAssistantToggle({
  state,
  busy = false,
  onChange,
  onRetry,
  onUnsupportedClick,
}: Props) {
  const interactiveDisabled = busy || state === 'indexing' || state === 'failed'

  function handleSwitchClick() {
    if (state === 'unsupported') {
      onUnsupportedClick?.()
      return
    }
    if (interactiveDisabled) return
    onChange(state === 'off' ? true : false)
  }

  const active = state === 'on' || state === 'indexing' || state === 'failed'

  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        aria-label="Załącz dla asystenta AI"
        aria-pressed={active}
        onClick={handleSwitchClick}
        className={cn(
          'relative inline-block h-5 w-9 shrink-0 rounded-full border-0 p-0 transition-colors duration-150',
          active ? 'bg-[var(--hrk-orange)]' : 'bg-[#e3e0db]',
          interactiveDisabled && state !== 'unsupported'
            ? 'cursor-not-allowed opacity-60'
            : 'cursor-pointer opacity-100',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-[left] duration-150',
            active ? 'left-[18px]' : 'left-0.5',
          )}
        />
      </button>

      <div aria-live="polite" className="inline-flex items-center gap-1.5">
        {state === 'on' && (
          <span className="inline-flex items-center gap-1 rounded-full border border-green-300 bg-green-50 px-2 py-0.5 text-[9.5px] font-semibold text-green-800 whitespace-nowrap">
            <span className="text-[9px]">✓</span> W asystencie AI
          </span>
        )}
        {state === 'off' && (
          <span className="inline-flex items-center gap-1 rounded-full border border-[#e3e0db] bg-[#f5f2ef] px-2 py-0.5 text-[9.5px] font-semibold text-[#9e9389] whitespace-nowrap">
            Wyłączony
          </span>
        )}
        {state === 'indexing' && (
          <span className="inline-flex items-center gap-1 rounded-full border border-[#fdd5b8] bg-[#fff5f0] px-2 py-0.5 text-[9.5px] font-semibold text-[#c94f02] whitespace-nowrap">
            <span className="inline-block h-2 w-2 shrink-0 animate-spin rounded-full border-[1.5px] border-transparent border-t-[#c94f02]" />
            Indeksowanie…
          </span>
        )}
        {state === 'failed' && (
          <>
            <span className="inline-flex items-center gap-1 rounded-full border border-[#fdd5b8] bg-[#fff5f0] px-2 py-0.5 text-[9.5px] font-semibold text-[#c94f02] whitespace-nowrap">
              <span className="text-[9px]">✕</span> Błąd indeksacji
            </span>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                disabled={busy}
                className="rounded-md border border-[#fdd5b8] bg-white px-2 py-0.5 font-inherit text-[10.5px] font-semibold text-[#c94f02] cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
              >
                Spróbuj ponownie
              </button>
            )}
          </>
        )}
        {state === 'unsupported' && (
          <span className="inline-flex items-center gap-1 rounded-full border border-[#e3e0db] bg-[#f5f2ef] px-2 py-0.5 text-[9.5px] font-semibold text-[#9e9389] whitespace-nowrap">
            Format niewspierany
          </span>
        )}
      </div>
    </div>
  )
}

interface ConfirmProps {
  isOpen: boolean
  count?: number
  onConfirm: () => void
  onCancel: () => void
  busy?: boolean
}

export function AiAssistantOffConfirm({ isOpen, count, onConfirm, onCancel, busy }: ConfirmProps) {
  if (!isOpen) return null
  const isBulk = (count ?? 1) > 1
  return (
    <div
      onClick={onCancel}
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[440px] rounded-xl bg-white p-6 shadow-2xl"
      >
        <h3 className="mb-2 text-[15px] font-extrabold text-[#1a1714]">
          {isBulk
            ? `Wyłączyć ${count} dokumentów z asystenta AI?`
            : 'Wyłączyć dokument z asystenta AI?'}
        </h3>
        <p className="mb-4 text-[13px] leading-relaxed text-[#9e9389]">
          Wszystkie chunki zostaną skasowane. Plik pozostanie w S3 i można włączyć ponownie później.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-[#e3e0db] bg-white px-4 py-2 font-inherit text-[13px] font-semibold text-[#1a1714] cursor-pointer disabled:cursor-not-allowed"
          >
            Anuluj
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={cn(
              'rounded-lg border-0 px-4 py-2 font-inherit text-[13px] font-bold text-white',
              busy
                ? 'cursor-not-allowed bg-[#e3e0db]'
                : 'cursor-pointer bg-[var(--hrk-orange-hover)]',
            )}
          >
            {busy ? 'Wyłączam…' : 'Wyłącz i usuń chunki'}
          </button>
        </div>
      </div>
    </div>
  )
}
