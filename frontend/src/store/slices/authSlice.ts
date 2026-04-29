import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export interface AuthUser {
  id: string
  login: string
  email: string
  displayName: string
  initials: string
  department: string
}

interface AuthState {
  user: AuthUser | null
  token: string | null  // reserved for future JWT
}

const initialState: AuthState = {
  user: null,
  token: null,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<AuthUser>) {
      state.user = action.payload
    },
    setToken(state, action: PayloadAction<string | null>) {
      state.token = action.payload
    },
    logout(state) {
      state.user = null
      state.token = null
    },
  },
})

export const { setUser, setToken, logout } = authSlice.actions
export const authReducer = authSlice.reducer
