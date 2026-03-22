import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { AuthContext } from './auth-context'
import type { AuthUser } from './types'
import type { AuthPortal } from './types'
import { clearAccessToken } from '../lib/apiToken'
import {
  addRegisteredUser,
  clearSession,
  findRegisteredUser,
  loadSession,
  saveSession,
} from './storage'

const DEMO_USER_EMAIL = 'user@threattron.local'
const DEMO_ADMIN_EMAIL = 'admin@threattron.local'

const RESERVED_EMAILS = new Set([DEMO_USER_EMAIL, DEMO_ADMIN_EMAIL])

function resolveDemoUser(email: string): AuthUser | null {
  const normalized = email.trim().toLowerCase()
  if (normalized === DEMO_ADMIN_EMAIL) {
    return { email: DEMO_ADMIN_EMAIL, role: 'admin' }
  }
  if (normalized === DEMO_USER_EMAIL) {
    return { email: DEMO_USER_EMAIL, role: 'user' }
  }
  return null
}

function wrongPortalMessage(accountRole: 'user' | 'admin'): string {
  if (accountRole === 'admin') {
    return 'This account is an administrator. Use the Administrator portal to sign in.'
  }
  return 'This account is a standard user. Use the User portal to sign in.'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => loadSession())

  const login = useCallback(
    async (email: string, password: string, portal: AuthPortal) => {
      const trimmed = email.trim()
      if (!trimmed || !password) {
        return { ok: false as const, message: 'Enter email and password.' }
      }
      const normalized = trimmed.toLowerCase()
      const registered = findRegisteredUser(normalized)
      if (registered) {
        if (registered.password !== password) {
          return { ok: false as const, message: 'Incorrect password.' }
        }
        if (registered.role !== portal) {
          return { ok: false as const, message: wrongPortalMessage(registered.role) }
        }
        const sessionUser: AuthUser = {
          email: registered.email,
          role: registered.role,
        }
        saveSession(sessionUser)
        setUser(sessionUser)
        return { ok: true as const }
      }
      const demo = resolveDemoUser(trimmed)
      if (demo) {
        if (demo.role !== portal) {
          return { ok: false as const, message: wrongPortalMessage(demo.role) }
        }
        saveSession(demo)
        setUser(demo)
        return { ok: true as const }
      }
      return {
        ok: false as const,
        message: 'No account found. Sign up in this portal or use a demo email.',
      }
    },
    [],
  )

  const signup = useCallback(async (email: string, password: string, portal: AuthPortal) => {
    const normalized = email.trim().toLowerCase()
    if (!normalized || !password) {
      return { ok: false as const, message: 'Enter email and password.' }
    }
    if (RESERVED_EMAILS.has(normalized)) {
      return {
        ok: false as const,
        message: 'This email is reserved for demo accounts. Use another address.',
      }
    }
    const role = portal === 'admin' ? 'admin' : 'user'
    const result = addRegisteredUser(normalized, password, role)
    if (!result.ok) {
      return result
    }
    const sessionUser: AuthUser = { email: normalized, role }
    saveSession(sessionUser)
    setUser(sessionUser)
    return { ok: true as const }
  }, [])

  const logout = useCallback(() => {
    clearSession()
    clearAccessToken()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({
      user,
      login,
      signup,
      logout,
    }),
    [user, login, signup, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
