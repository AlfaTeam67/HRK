import { Navigate, Route, Routes } from 'react-router-dom'

import { AppLayout } from '@/components/layout/AppLayout'
import { DashboardPage }    from '@/pages/DashboardPage'
import { PortfolioPage }    from '@/pages/PortfolioPage'
import { ContractsPage }    from '@/pages/ContractsPage'
import { ValorizationPage } from '@/pages/ValorizationPage'
import { AdvisorPage }      from '@/pages/AdvisorPage'
import { SettingsPage }     from '@/pages/SettingsPage'
import { ReportsPage }      from '@/pages/ReportsPage'

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index               element={<DashboardPage />}    />
        <Route path="clients"      element={<PortfolioPage />}    />
        <Route path="contracts"    element={<ContractsPage />}    />
        <Route path="valorization" element={<ValorizationPage />} />
        <Route path="assistant"    element={<AdvisorPage />}      />
        <Route path="access"       element={<SettingsPage />}     />
        <Route path="settings"     element={<SettingsPage />}     />
        <Route path="reports"      element={<ReportsPage />}      />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
