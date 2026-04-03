/**
 * JWT / access token storage for when the backend issues sessions.
 * Demo login does not set this yet; wire `setAccessToken` after a real `POST /auth/login` succeeds.
 */
const TOKEN_KEY = 'threattron_access_token'

export function getAccessToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setAccessToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearAccessToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export function getApiBaseUrl(): string {
  const base = import.meta.env.VITE_API_URL?.replace(/\/$/, '') ?? ''
  return base
}

/** Headers for `fetch` including Bearer token when present. */
export function authHeaders(json = true): HeadersInit {
  const headers: Record<string, string> = {}
  if (json) headers['Content-Type'] = 'application/json'
  const t = getAccessToken()
  if (t) headers['Authorization'] = `Bearer ${t}`
  return headers
}
