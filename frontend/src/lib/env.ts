const apiUrl = import.meta.env.VITE_API_URL

if (!apiUrl) {
  throw new Error('Missing VITE_API_URL environment variable.')
}

export const env = {
  apiUrl,
}
