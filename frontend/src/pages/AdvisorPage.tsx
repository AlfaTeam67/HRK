import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const sampleQuestions = [
  'Do kiedy obowiązuje nasza umowa z Empik?',
  'Kiedy była ostatnia waloryzacja i jaki miała wpływ?',
  'Ilu pracowników jest przypisanych do klienta?',
]

export function AdvisorPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Asystent AI (CRM)</h1>
        <p className="text-sm text-muted-foreground">
          Chat kontekstowy oparty o dokumenty klienta i historię współpracy.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Przykładowe zapytania</CardTitle>
            <CardDescription>
              Zgodne z notatkami projektowymi i scenariuszem pracy konsultanta.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {sampleQuestions.map((question) => (
                <li
                  key={question}
                  className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-sm"
                >
                  {question}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Funkcje AI w MVP</CardTitle>
            <CardDescription>Zakres bazowy dla pierwszego wdrożenia.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>1. Podsumowanie klienta przy wejściu na kartę (notatki + umowy + statusy).</p>
            <p>2. Odpowiedzi z odwołaniem do dokumentu i strony (RAG).</p>
            <p>3. Weryfikacja danych pracownika względem pliku źródłowego.</p>
            <p>4. Sugestia aneksu po aktualizacji wskaźników inflacji.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
