import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'

import App from './App'
import './index.css'
import { setupAxiosInterceptors } from '@/lib/axios'
import { queryClient } from '@/lib/queryClient'
import { store } from '@/store/store'
import { logout } from '@/store/slices/authSlice'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error("Root element '#root' was not found.")
}

setupAxiosInterceptors(
  () => store.getState().auth.token,
  () => store.dispatch(logout()),
)

createRoot(rootElement).render(
  <StrictMode>
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </Provider>
  </StrictMode>
)
