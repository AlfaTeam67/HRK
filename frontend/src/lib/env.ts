const DEFAULT_API_URL = '/api'
const configuredApiUrl = import.meta.env.VITE_API_URL?.trim()

if (!configuredApiUrl) {
  console.warn('Missing VITE_API_URL environment variable. Falling back to "' + DEFAULT_API_URL + '".')
}

export const env = {
  apiUrl: configuredApiUrl || DEFAULT_API_URL,
}
