/**
 * FilmIQ — Global State (Zustand)
 *
 * SSR SAFETY: Zustand's `persist` middleware reads from localStorage.
 * In Next.js App Router this causes hydration mismatches if the persisted
 * value differs from the server-rendered HTML.
 *
 * Fix: use `skipHydration: true` and manually rehydrate on the client
 * via a useEffect in the root layout.
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { setToken, setRefresh, removeToken } from './api'

// ── Auth types ────────────────────────────────────────────────────────────
export interface AuthUser {
  id:       number
  email:    string
  username: string
  role:     string
}

interface AuthState {
  user:          AuthUser | null
  isAuthed:      boolean
  mustChangePw:  boolean   // true → middleware blocks all routes except /auth/change-password
  _hydrated:     boolean
  login:         (user: AuthUser, access: string, refresh: string, mustChangePw?: boolean) => void
  logout:        () => void
  setUser:       (user: AuthUser) => void
  setHydrated:   () => void
  /** Call after a successful change-password to store the freshly issued tokens */
  updateTokens:  (access: string, refresh: string) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user:         null,
      isAuthed:     false,
      mustChangePw: false,
      _hydrated:    false,

      login: (user, access, refresh, mustChangePw = false) => {
        setToken(access)
        setRefresh(refresh)
        set({ user, isAuthed: true, mustChangePw })
      },

      logout: () => {
        removeToken()
        set({ user: null, isAuthed: false, mustChangePw: false })
      },

      setUser:    (user) => set({ user, isAuthed: true }),
      setHydrated: ()   => set({ _hydrated: true }),

      updateTokens: (access, refresh) => {
        setToken(access)
        setRefresh(refresh)
        set({ mustChangePw: false })
      },
    }),
    {
      name:    'filmiq-auth',
      storage: createJSONStorage(() => {
        if (typeof window === 'undefined') {
          return {
            getItem:    () => null,
            setItem:    () => {},
            removeItem: () => {},
          }
        }
        return localStorage
      }),
      partialize: (s) => ({ user: s.user, isAuthed: s.isAuthed, mustChangePw: s.mustChangePw }),
      skipHydration: true,
    },
  ),
)

// ── UI prefs ──────────────────────────────────────────────────────────────
interface UIState {
  sidebarOpen:    boolean
  timeFilter:     string
  setSidebarOpen: (v: boolean) => void
  setTimeFilter:  (v: string) => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen:    false,
  timeFilter:     'all',
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  setTimeFilter:  (v) => set({ timeFilter: v }),
}))
