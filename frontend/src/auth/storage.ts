import type { AuthUser, Role } from './types'

const STORAGE_KEY = 'threattron_auth'
const REGISTRY_KEY = 'threattron_registered_users'

export interface StoredRegistration {
  email: string
  password: string
  role: Role
}

export function loadRegisteredUsers(): StoredRegistration[] {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((row): StoredRegistration | null => {
        if (!row || typeof row !== 'object') return null
        const r = row as Record<string, unknown>
        const email = r.email
        const password = r.password
        const role = r.role
        if (typeof email !== 'string' || typeof password !== 'string') return null
        const resolvedRole: Role =
          role === 'admin' ? 'admin' : role === 'user' ? 'user' : 'user'
        return { email, password, role: resolvedRole }
      })
      .filter((x): x is StoredRegistration => x !== null)
  } catch {
    return []
  }
}

function saveRegisteredUsers(users: StoredRegistration[]): void {
  localStorage.setItem(REGISTRY_KEY, JSON.stringify(users))
}

export function findRegisteredUser(
  email: string,
): StoredRegistration | undefined {
  const key = email.trim().toLowerCase()
  return loadRegisteredUsers().find((u) => u.email.toLowerCase() === key)
}

export function addRegisteredUser(
  email: string,
  password: string,
  role: Role,
): { ok: true } | { ok: false; message: string } {
  const normalized = email.trim().toLowerCase()
  if (!normalized) {
    return { ok: false, message: 'Enter a valid email.' }
  }
  if (password.length < 8) {
    return { ok: false, message: 'Password must be at least 8 characters.' }
  }
  if (findRegisteredUser(normalized)) {
    return { ok: false, message: 'An account with this email already exists.' }
  }
  const users = loadRegisteredUsers()
  users.push({ email: normalized, password, role })
  saveRegisteredUsers(users)
  return { ok: true }
}

export function loadSession(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const { email, role } = parsed as Record<string, unknown>
    if (typeof email !== 'string' || (role !== 'user' && role !== 'admin')) {
      return null
    }
    return { email, role }
  } catch {
    return null
  }
}

export function saveSession(user: AuthUser): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY)
}
