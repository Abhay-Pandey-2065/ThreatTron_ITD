import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { AuthContext } from './auth-context'
import type { AuthUser } from './types'
import type { AuthPortal } from './types'
import { clearAccessToken } from '../lib/apiToken'
import {
  clearSession,
  loadSession,
  saveSession,
} from './storage'
import { signupUser, loginUser } from '../lib/api'


const DEMO_USER_EMAIL = 'user@threattron.local'
const DEMO_ADMIN_EMAIL = 'admin@threattron.local'

const _RESERVED_EMAILS = new Set([DEMO_USER_EMAIL, DEMO_ADMIN_EMAIL])

function _resolveDemoUser(email: string): AuthUser | null {
  const normalized = email.trim().toLowerCase()
  if (normalized === DEMO_ADMIN_EMAIL) {
    return { email: DEMO_ADMIN_EMAIL, role: 'admin' }
  }
  if (normalized === DEMO_USER_EMAIL) {
    return { email: DEMO_USER_EMAIL, role: 'user' }
  }
  return null
}

function _wrongPortalMessage(accountRole: 'user' | 'admin'): string {
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
      
      const result = await loginUser(trimmed, password, portal)
      
      if (result.ok && result.data) {
        const sessionUser: AuthUser = {
          email: result.data.email,
          role: result.data.role,
        }
        saveSession(sessionUser)
        setUser(sessionUser)
        return { ok: true as const }
      }
      
      return {
        ok: false as const,
        message: result.message || 'Login failed',
      }
    },
    [],
  )


  const signup = useCallback(async (email: string, password: string, portal: AuthPortal) => {
    const normalized = email.trim().toLowerCase()
    if (!normalized || !password) {
      return { ok: false as const, message: 'Enter email and password.' }
    }
    
    const role = portal === 'admin' ? 'admin' : 'user'
    const result = await signupUser(normalized, password, role)
    
    if (result.ok) {
        const sessionUser: AuthUser = { email: normalized, role }
        saveSession(sessionUser)
        setUser(sessionUser)
        return { ok: true as const }
    }
    
    return { ok: false as const, message: result.message || 'Signup failed' }
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
