'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/lib/store'
import { firebaseAuth } from '@/lib/firebase'
import { Film, ChevronDown, LogOut, KeyRound, LayoutDashboard } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

interface NavLink {
  href:  string
  label: string
  roles: string[] | null
}

const NAV_LINKS: NavLink[] = [
  { href: '/dashboard', label: 'Dashboard',  roles: null },
  { href: '/movies',    label: 'Movies',     roles: null },
  { href: '/compare',   label: 'Compare',    roles: null },
  { href: '/genres',    label: 'Genres',     roles: null },
  { href: '/trends',    label: 'Trends',     roles: null },
  { href: '/people',    label: 'People',     roles: null },
  { href: '/overview',  label: 'Overview',   roles: null },
  { href: '/predict',   label: 'AI Predict', roles: null },
  { href: '/analytics', label: 'Analytics',  roles: null },
  { href: '/investor',  label: 'Investor',   roles: ['investor', 'admin'] },
  { href: '/filmmaker', label: 'My Movies',  roles: ['filmmaker', 'admin'] },
  { href: '/admin',     label: 'Admin',      roles: ['admin'] },
]

const ROLE_BADGE_CLASS: Record<string, string> = {
  admin:     'badge-admin',
  filmmaker: 'badge-filmmaker',
  investor:  'badge-investor',
  analyst:   'badge-analyst',
}

export function NavBar() {
  const pathname                    = usePathname()
  const router                      = useRouter()
  const { user, isAuthed, logout }  = useAuthStore()
  const [userMenuOpen, setMenuOpen] = useState(false)
  const menuRef                     = useRef<HTMLDivElement>(null)

  const isAuthPage    = pathname.startsWith('/auth')
  const isLandingPage = pathname === '/'
  const role          = user?.role ?? ''

  const visibleLinks = NAV_LINKS.filter(
    (link) => link.roles === null || link.roles.includes(role)
  )

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleSignOut() {
    setMenuOpen(false)
    try { await signOut(firebaseAuth) } catch { /* already signed out */ }
    logout()
    router.push('/')
  }

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 flex h-[68px] items-center border-b border-slate-200 bg-white/95 px-6 backdrop-blur-md shadow-sm">

      {/* ── Logo ── */}
      <Link href={isAuthed ? '/dashboard' : '/'} className="mr-8 flex items-center gap-2.5 flex-shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy">
          <Film className="h-4 w-4 text-white" />
        </div>
        <span className="text-lg font-bold tracking-tight text-navy">FilmIQ</span>
      </Link>

      {/* ── Authenticated nav links ── */}
      {!isAuthPage && isAuthed && (
        <div className="flex flex-1 items-center gap-0.5">
          {visibleLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                pathname.startsWith(href) && href !== '/'
                  ? 'bg-brand-50 text-brand font-semibold'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
              )}
            >
              {label}
            </Link>
          ))}
        </div>
      )}

      {/* Spacer for non-authed or auth pages */}
      {(!isAuthed || isAuthPage) && <div className="flex-1" />}

      {/* ── Right side controls ── */}
      <div className="flex items-center gap-3">

        {/* Live indicator — only when authenticated and not on auth pages */}
        {isAuthed && !isAuthPage && (
          <span className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 sm:inline-flex">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Live
          </span>
        )}

        {/* Public / unauthenticated navigation */}
        {!isAuthed && !isAuthPage && (
          <>
            <Link
              href="/auth/login"
              className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-800"
            >
              Sign In
            </Link>
            <Link
              href="/auth/login"
              className="btn-primary py-2 px-5 text-sm"
            >
              Get Started
            </Link>
          </>
        )}

        {/* Authenticated user menu */}
        {isAuthed && !isAuthPage && (
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm transition-colors hover:bg-slate-50"
            >
              {/* Avatar initials */}
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-navy text-[11px] font-bold text-white">
                {(user?.username ?? 'U').charAt(0).toUpperCase()}
              </div>
              <span className="hidden font-medium text-slate-700 sm:block">
                {user?.username}
              </span>
              {role && (
                <span className={ROLE_BADGE_CLASS[role] ?? ROLE_BADGE_CLASS.analyst}>
                  {role}
                </span>
              )}
              <ChevronDown className={cn('h-4 w-4 text-slate-400 transition-transform', userMenuOpen && 'rotate-180')} />
            </button>

            {/* Dropdown */}
            {userMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/80">
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Signed in as</p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-slate-800">{user?.username}</p>
                  <p className="truncate text-xs text-slate-400">{user?.email}</p>
                </div>
                <div className="py-1">
                  <Link
                    href="/dashboard"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-800"
                  >
                    <LayoutDashboard className="h-4 w-4 text-slate-400" />
                    Dashboard
                  </Link>
                  <Link
                    href="/auth/change-password"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-800"
                  >
                    <KeyRound className="h-4 w-4 text-slate-400" />
                    Change Password
                  </Link>
                </div>
                <div className="border-t border-slate-100 py-1">
                  <button
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 transition-colors hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Auth page — minimal: just a "Back" hint */}
        {isAuthPage && (
          <Link
            href="/"
            className="text-sm font-medium text-slate-500 transition-colors hover:text-navy"
          >
            ← Back to Home
          </Link>
        )}
      </div>
    </nav>
  )
}
