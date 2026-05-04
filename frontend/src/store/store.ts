import { configureStore } from '@reduxjs/toolkit'

import { authReducer } from '@/store/slices/authSlice'

const AUTH_STORAGE_KEY = 'hrk-auth'

function loadAuthState() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return undefined
    const parsed = JSON.parse(raw)
    if (parsed?.token === 'demo-token') {
      return { ...parsed, token: null }
    }
    return parsed
  } catch {
    return undefined
  }
}

export const store = configureStore({
  reducer: {
    auth: authReducer,
  },
  preloadedState: {
    auth: loadAuthState(),
  },
})

store.subscribe(() => {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(store.getState().auth))
  } catch {
    // ignore storage write errors
  }
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
