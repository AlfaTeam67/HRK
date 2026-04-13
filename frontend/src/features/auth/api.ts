export interface AuthResponse {
  accessToken: string
}

export async function loginDemo(): Promise<AuthResponse> {
  return { accessToken: 'demo-token' }
}
