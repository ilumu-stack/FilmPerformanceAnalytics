'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/lib/store'

const NAV_LINKS = [
  { href: '/',          label: 'Home'     },
  { href: '/dashboard', label: 'Dashboard'},
  { href: '/predict',   label: 'AI Predict'},
  { href: '/analytics', label: 'Analytics'},
  { href: '/investor',  label: 'Investor' },
]

export function NavBar() {
  const pathname = usePathname()
  const { user, isAuthed, logout } = useAuthStore()

  return (
    <>
      {/* Ticker */}
      <div className="fixed top-0 left-0 right-0 z-50 overflow-hidden border-b border-white/[0.06] bg-filmiq-bg2/90 py-1.5">
        <div className="animate-[ticker_40s_linear_infinite] inline-block whitespace-nowrap font-mono text-[11px] text-gray-500">
          {[
            'AVATAR $2.92B ▲ +1133%', 'AVENGERS: ENDGAME $2.80B ▲ +686%',
            'TITANIC $2.26B ▲ +1032%', 'STAR WARS: TFA $2.07B ▲ +744%',
            'ADVENTURE AVG $226M', 'ACTION AVG $160M', 'ANIMATION AVG $171M',
            'AFRICAN MARKET CAGR +18%', 'CNN-C ACCURACY 83.7%',
            'AVATAR $2.92B ▲ +1133%', 'AVENGERS: ENDGAME $2.80B ▲ +686%',
            'TITANIC $2.26B ▲ +1032%',
          ].map((t, i) => (
            <span key={i} className="mx-8">
              <span className={t.includes('▲') ? 'text-emerald-400' : t.includes('%') ? 'text-yellow-400' : ''}>{t}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Main nav */}
      <nav className="fixed top-[28px] left-0 right-0 z-40 flex h-14 items-center gap-2 border-b border-white/[0.07] bg-filmiq-bg/85 px-8 backdrop-blur-xl">
        <Link href="/" className="mr-6 font-display text-2xl tracking-[4px] text-yellow-400">
          FILMIQ
        </Link>

        <div className="flex flex-1 items-center gap-1">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'rounded-md px-3 py-1.5 text-[13px] font-medium tracking-wide transition-colors',
                pathname === href
                  ? 'bg-yellow-400/10 text-yellow-400'
                  : 'text-gray-500 hover:bg-white/[0.04] hover:text-white'
              )}
            >
              {label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <span className="rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold text-cyan-400">
            ● LIVE
          </span>
          {isAuthed ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">{user?.username}</span>
              <Link href="/auth/change-password" className="text-xs text-gray-500 hover:text-yellow-400 transition-colors">
                Change Password
              </Link>
              <button onClick={logout} className="text-xs text-gray-500 hover:text-red-400 transition-colors">
                Sign out
              </button>
            </div>
          ) : (
            <Link href="/auth/login" className="text-xs font-medium text-gray-400 hover:text-yellow-400 transition-colors">
              Sign in
            </Link>
          )}
        </div>
      </nav>
    </>
  )
}
