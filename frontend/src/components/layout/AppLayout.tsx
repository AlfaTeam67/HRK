import { Outlet } from 'react-router-dom'

import { AppSidebar } from '@/components/layout/AppSidebar'

export function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <main className="flex-1 p-6 overflow-auto flex flex-col min-h-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
