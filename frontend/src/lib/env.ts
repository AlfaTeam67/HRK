// In dev: leave VITE_API_URL empty — Vite proxy forwards /api → backend (vite.config.ts).
// In prod: set VITE_API_URL to the backend origin (e.g. https://api.hrk.eu).
const configuredApiUrl = import.meta.env.VITE_API_URL?.trim()

export const env = {
  apiUrl: configuredApiUrl ?? '',
}
