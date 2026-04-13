import { Outlet } from 'react-router-dom'

import { AppSidebar } from '@/components/layout/AppSidebar'

export function AppLayout() {
  return (
    <div className="flex min-h-screen bg-[#f0f2f5]">
      <AppSidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
