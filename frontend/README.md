# HRK CRM Frontend

Frontend projektu **HRK CRM** oparty o:

- `Vite + React + TypeScript`
- `Tailwind CSS + shadcn/ui`
- `React Router`
- `React Query`
- `Redux Toolkit`

Projekt działa w podejściu **feature-first**. Aktualny scaffold został przeniesiony z projektu ZZPJ i dostosowany konfiguracyjnie do HRK.

## Widoki CRM (aktualny UI)

- `/` — dashboard operacyjny CRM (alerty umów, Smart Pulse, „co dzisiaj zrobić?”)
- `/clients` — karta klienta (profil, opiekunowie, statusy, podsumowanie AI)
- `/assistant` — asystent AI i scenariusze zapytań
- `/access` — dostęp przez Active Directory i model uprawnień

## Wymagania

- Node.js (zalecane przez `nvm`)
- npm

```bash
nvm install node
nvm use node
```

## Szybki start

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Aplikacja działa pod `http://localhost:5173`.

## Uruchomienie przez Docker Compose

```bash
cd frontend
docker compose up --build
```

Build jest serwowany na porcie `4173`.

## Zmienne środowiskowe

- `VITE_API_URL` — URL backendu HRK (domyślnie w `.env.example`: `http://localhost:8000`)

## Najważniejsze skrypty

```bash
npm run dev
npm run build
npm run preview
npm run lint
npm run format
npm run format:check
npm run types:sync
```

`types:sync` pobiera OpenAPI z `http://localhost:8000/openapi.json` i zapisuje typy do `src/types/api.ts`.

## Struktura projektu

```text
src/
  features/
  components/
  hooks/
  lib/
  pages/
  store/
  types/
  utils/
```
