import { Link } from 'react-router-dom'

export function AppHeader() {
  return (
    <header className="border-b border-border/80 bg-background/95 px-6 py-4 backdrop-blur">
      <Link to="/" className="text-lg font-semibold tracking-tight">
        HRK CRM
      </Link>
    </header>
  )
}
