export const TONE_LABELS: Record<string, string> = {
  formal: 'Formalna',
  neutral: 'Neutralna',
  warm: 'Ciepła',
  assertive: 'Stanowcza',
}

export const TONE_DESCRIPTIONS: Record<string, string> = {
  formal: 'Oficjalny, bezosobowy styl. Sprawdza się w sektorze finansowym i prawnym.',
  neutral: 'Profesjonalny, partnerski. Bezpieczny domyślny wybór.',
  warm: 'Podkreśla długą współpracę i partnerstwo. Dobry dla wieloletnich klientów.',
  assertive: 'Rzeczowy, stanowczy. Gdy klient zwleka z waloryzacją.',
}

export const INDEX_TYPE_LABELS: Record<string, string> = {
  GUS_CPI: 'Wskaźnik CPI (GUS)',
  fixed_pct: 'Stała stawka',
  custom: 'Indywidualna',
}

export const QUICK_HINTS: ReadonlyArray<{ label: string; text: string }> = [
  {
    label: 'Wieloletnia współpraca',
    text: 'Podkreśl długoletnią współpracę z klientem.',
  },
  {
    label: 'Brak waloryzacji od X lat',
    text: 'Wspomnij, że stawki nie były waloryzowane przez ostatnie 2 lata, mimo wzrostu kosztów.',
  },
  {
    label: 'Nowe usługi w tym roku',
    text: 'Zaznacz, że w tym roku rozszerzono zakres współpracy o nowe usługi.',
  },
  {
    label: 'CPI jako podstawa',
    text: 'Wyraźnie wskaż, że indeksacja jest tylko odzwierciedleniem inflacji wg GUS, nie marży.',
  },
  {
    label: 'Dyspozycyjność opiekuna',
    text: 'Zachęć do kontaktu z opiekunem klienta w razie pytań przed podpisaniem aneksu.',
  },
]
