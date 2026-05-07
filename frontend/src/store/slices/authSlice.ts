import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export interface AuthUser {
  id: string
  login: string
  email: string
  displayName: string
  initials: string
  department: string
  roles: string[]
}

interface AuthState {
  user: AuthUser | null
  token: string | null
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
    setRoles(state, action: PayloadAction<string[]>) {
      if (state.user) {
        state.user.roles = action.payload
      }
    },
    logout(state) {
      state.user = null
      state.token = null
    },
  },
})

export const { setUser, setToken, setRoles, logout } = authSlice.actions
export const authReducer = authSlice.reducer
