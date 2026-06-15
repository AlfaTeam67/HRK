/**
 * FaqPage — Centrum pomocy / FAQ
 *
 * Statyczna strona z accordion-em FAQ podzielona na sekcje.
 * Zero zależności zewnętrznych — tylko inline styles pasujące do reszty apki.
 */

import { useState } from 'react'
import { cardStyle } from '@/lib/styles'

/* ─── Treść FAQ ──────────────────────────────────────────────── */

interface FaqItem {
  q: string
  a: string | string[]
}

interface FaqSection {
  title: string
  emoji: string
  items: FaqItem[]
}

const FAQ_SECTIONS: FaqSection[] = [
  {
    title: 'Pierwsze kroki',
    emoji: '🚀',
    items: [
      {
        q: 'Jak się zalogować do systemu?',
        a: 'Wpisz swoją nazwę użytkownika domenowego (np. jan.kowalski) i kliknij "Zaloguj". System weryfikuje Cię przez Active Directory HRK — nie potrzeba osobnego hasła do CRM.',
      },
      {
        q: 'Nie widzę pewnych zakładek w menu — dlaczego?',
        a: 'Widoczność sekcji zależy od Twojej roli / działu. Opiekunowie klienta widzą "Mój pulpit", specjaliści HR i administratorzy — "Pulpit główny". Jeśli brakuje Ci dostępu, zgłoś się do administratora IT.',
      },
      {
        q: 'Co to jest CKK?',
        a: 'CKK (Centralny Kod Klienta) to unikalny identyfikator klienta w systemie HRK, np. CKK-0042. Używany jest w numeracji umów i dokumentów.',
      },
    ],
  },
  {
    title: 'Role i uprawnienia',
    emoji: '🔐',
    items: [
      {
        q: 'Jakie role są dostępne w systemie?',
        a: [
          'Dyrektor sprzedaży (Admin) — pełny dostęp: wszyscy klienci, raporty, zarządzanie użytkownikami.',
          'Opiekun klienta (Standard) — przypisani klienci, edycja notatek, podgląd umów.',
          'Analityk (ReadOnly) — wszyscy klienci do odczytu, raporty, eksport.',
          'Prawnik (Limited) — przypisane umowy i dokumenty, akceptacje prawne.',
        ],
      },
      {
        q: 'Jak zmienić rolę użytkownika?',
        a: 'Przejdź do Administracja → Dostępy i role. Tylko administrator może zmieniać role. W przyszłości role będą synchronizowane z Azure Entra ID.',
      },
      {
        q: 'Co oznacza synchronizacja z Azure Entra?',
        a: 'Planowane jest, że Azure Entra ID (dawne Azure AD) stanie się jedynym źródłem prawdy o pracownikach HRK. Konta, role i działy będą automatycznie aktualizowane przy każdym logowaniu. Więcej informacji od administratora IT.',
      },
    ],
  },
  {
    title: 'Klienci',
    emoji: '👥',
    items: [
      {
        q: 'Jak dodać nowego klienta?',
        a: 'Na stronie Klienci kliknij przycisk "+ Nowy klient" (prawy górny róg). Wypełnij CKK i NIP — reszta pól jest opcjonalna. System automatycznie pobierze dane z GUS jeśli podasz NIP.',
      },
      {
        q: 'Co oznaczają statusy klientów?',
        a: [
          'Aktywny — aktywna współpraca.',
          'Ryzyko odejścia — sygnały ostrzegawcze, wymaga uwagi.',
          'Wymaga uwagi — klient wymagający pilnego kontaktu.',
          'Nieaktywny — brak aktywnej współpracy.',
        ],
      },
      {
        q: 'Czym jest segment i branża?',
        a: 'Segment to wewnętrzna klasyfikacja klienta (np. Enterprise, SMB). Branża określa sektor gospodarki (np. IT, Handel, Produkcja). Oba pola służą do filtrowania i raportowania.',
      },
    ],
  },
  {
    title: 'Notatki',
    emoji: '📝',
    items: [
      {
        q: 'Jakie typy notatek są dostępne?',
        a: [
          'Spotkanie — notatka ze spotkania z klientem.',
          'Rozmowa — zapis rozmowy telefonicznej.',
          'Wewnętrzna — notatka do wewnętrznego użytku.',
          'Zapytanie klienta — wniosek lub zapytanie od klienta.',
          'Inne — pozostałe przypadki.',
        ],
      },
      {
        q: 'Co to jest "Termin reakcji" w notatce?',
        a: 'Opcjonalne pole, które pozwala ustawić deadline na odpowiedź lub działanie. Notatki z przekroczonym terminem są oznaczane czerwonym badge\'em ⏰. Po zrealizowaniu zaznacz checkbox "Zrealizuj".',
      },
      {
        q: 'Czy można edytować lub usunąć notatkę?',
        a: 'Notatki można edytować (zmiana treści i typu) oraz usuwać. Usunięcie jest "miękkie" — notatka znika z widoku, ale pozostaje w bazie danych z datą usunięcia.',
      },
    ],
  },
  {
    title: 'Umowy',
    emoji: '📄',
    items: [
      {
        q: 'Jakie typy umów obsługuje system?',
        a: [
          'Ramowa — główna umowa bazowa.',
          'Aneks — zmiana do umowy ramowej.',
          'SLA — umowa o poziomie usług.',
          'DPA — umowa o przetwarzaniu danych osobowych.',
          'PPK — pracownicze plany kapitałowe.',
          'Inne — pozostałe typy.',
        ],
      },
      {
        q: 'Co oznaczają statusy umów?',
        a: [
          'Szkic (draft) — umowa w trakcie przygotowania.',
          'Podpisana (signed) — umowa podpisana przez obie strony.',
          'Aktywna (active) — obowiązująca umowa.',
          'Wygasająca (expiring) — umowa zbliżająca się do końca.',
          'Rozwiązana (terminated) — zakończona.',
        ],
      },
      {
        q: 'Jak wygenerować dokument umowy?',
        a: 'Wejdź w szczegóły klienta → zakładka Dokumenty → "Generuj dokument". Kreator przeprowadzi Cię przez wybór szablonu i parametrów. AI wygeneruje draft w formacie PDF.',
      },
    ],
  },
  {
    title: 'Waloryzacja',
    emoji: '📈',
    items: [
      {
        q: 'Co to jest waloryzacja?',
        a: 'Waloryzacja to coroczna indeksacja cen usług zgodnie z wskaźnikiem inflacji (GUS CPI), stałym procentem lub niestandardowym wskaźnikiem. System śledzi status każdej waloryzacji od zaplanowania do zastosowania.',
      },
      {
        q: 'Jakie są statusy waloryzacji?',
        a: [
          'Oczekująca — zaplanowana, nierozpatrzona.',
          'Zatwierdzona — zatwierdzona przez managera.',
          'Zastosowana — zmiany weszły w życie.',
          'Odrzucona — anulowana.',
        ],
      },
      {
        q: 'Skąd biorą się dane GUS CPI?',
        a: 'System automatycznie pobiera wskaźnik CPI (Consumer Price Index) z API GUS BDL (Bank Danych Lokalnych). Dane są aktualizowane kwartalnie.',
      },
    ],
  },
  {
    title: 'Asystent AI',
    emoji: '🤖',
    items: [
      {
        q: 'Do czego służy asystent AI?',
        a: 'Asystent AI (RAG) pozwala zadawać pytania dotyczące klientów i umów w języku naturalnym. Korzysta z załączonych dokumentów — umów, aneksów, DPA — jako bazy wiedzy.',
      },
      {
        q: 'Jak dodać dokument do bazy asystenta?',
        a: 'Przy uploadzie dokumentu (zakładka Dokumenty klienta) zaznacz opcję "Uwzględnij w asystencie AI". Dokument zostanie przeindeksowany w ciągu kilku minut.',
      },
    ],
  },
]

/* ─── Component ──────────────────────────────────────────────── */

function AccordionItem({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ borderBottom: '1px solid #f0ece7' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%', textAlign: 'left', background: 'none', border: 'none',
          cursor: 'pointer', padding: '12px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1714', flex: 1 }}>
          {item.q}
        </span>
        <span style={{
          fontSize: 16, color: '#e85c04', flexShrink: 0,
          transform: open ? 'rotate(45deg)' : 'none',
          transition: 'transform 0.15s',
        }}>
          +
        </span>
      </button>

      {open && (
        <div style={{ padding: '0 16px 14px', animation: 'faqFadeIn 0.15s ease-out' }}>
          {Array.isArray(item.a) ? (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {item.a.map((line, i) => (
                <li key={i} style={{ fontSize: 12.5, color: '#4a4340', lineHeight: 1.7, marginBottom: 2 }}>
                  {line}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: 0, fontSize: 12.5, color: '#4a4340', lineHeight: 1.7 }}>
              {item.a}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function FaqSection({ section }: { section: FaqSection }) {
  return (
    <div style={{ ...cardStyle, marginBottom: 16 }}>
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #f0ece7',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 18 }}>{section.emoji}</span>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1a1714' }}>
          {section.title}
        </h2>
      </div>
      {section.items.map((item, i) => (
        <AccordionItem key={i} item={item} />
      ))}
    </div>
  )
}

export function FaqPage() {
  const [search, setSearch] = useState('')

  const filtered: FaqSection[] = search.trim()
    ? FAQ_SECTIONS.map((sec) => ({
        ...sec,
        items: sec.items.filter(
          (item) =>
            item.q.toLowerCase().includes(search.toLowerCase()) ||
            (typeof item.a === 'string'
              ? item.a.toLowerCase().includes(search.toLowerCase())
              : item.a.some((a) => a.toLowerCase().includes(search.toLowerCase()))),
        ),
      })).filter((sec) => sec.items.length > 0)
    : FAQ_SECTIONS

  return (
    <div style={{ padding: '28px 32px', maxWidth: 820, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1a1714', margin: 0, marginBottom: 6 }}>
          Centrum pomocy
        </h1>
        <p style={{ color: '#7a6f67', fontSize: 13, margin: 0 }}>
          Odpowiedzi na najczęściej zadawane pytania dotyczące systemu CRM HRK.
        </p>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 20 }}>
        <input
          type="search"
          placeholder="Szukaj w FAQ…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '9px 14px',
            fontSize: 13,
            border: '1px solid #d4cfc9',
            borderRadius: 8,
            outline: 'none',
            background: '#faf9f7',
            color: '#1a1714',
          }}
        />
      </div>

      {/* Sections */}
      {filtered.length === 0 ? (
        <p style={{ color: '#7a6f67', fontSize: 13, textAlign: 'center', marginTop: 40 }}>
          Brak wyników dla „{search}".
        </p>
      ) : (
        filtered.map((sec, i) => <FaqSection key={i} section={sec} />)
      )}

      {/* Footer note */}
      <p style={{ fontSize: 11.5, color: '#9c8e84', textAlign: 'center', marginTop: 24 }}>
        Nie znalazłeś odpowiedzi? Skontaktuj się z administratorem systemu lub działem IT HRK.
      </p>

      <style>{`
        @keyframes faqFadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
