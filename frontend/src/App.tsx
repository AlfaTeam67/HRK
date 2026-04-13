import { Navigate, Route, Routes } from 'react-router-dom'

import { AppLayout } from '@/components/layout/AppLayout'
import { AdvisorPage } from '@/pages/AdvisorPage'
import { AuthPage } from '@/pages/AuthPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { PortfolioPage } from '@/pages/PortfolioPage'
import { ContractsPage } from '@/pages/ContractsPage'

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="clients" element={<PortfolioPage />} />
        <Route path="contracts" element={<ContractsPage />} />
        <Route path="assistant" element={<AdvisorPage />} />
        <Route path="access" element={<AuthPage />} />
        <Route path="portfolio" element={<Navigate to="/clients" replace />} />
        <Route path="advisor" element={<Navigate to="/assistant" replace />} />
      </Route>
      <Route path="login" element={<Navigate to="/access" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
