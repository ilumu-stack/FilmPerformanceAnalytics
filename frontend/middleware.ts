import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Decode JWT payload without verifying signature — used only for routing decisions.
// Actual verification happens on the backend with every API call.
function jwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const padded = part + '='.repeat((4 - (part.length % 4)) % 4)
    return JSON.parse(atob(padded.replace(/-/g, '+').replace(/_/g, '/')))
  } catch {
    return null
  }
}

// Fully public paths — no auth required in either direction
const PUBLIC_PATHS   = ['/', '/auth/login', '/auth/forgot-password']
const CHANGE_PW_PATH = '/auth/change-password'

// Routes that require a specific set of roles (first match wins).
const ROLE_GUARDS: { prefix: string; roles: string[] }[] = [
  { prefix: '/admin',     roles: ['admin'] },
  { prefix: '/filmmaker', roles: ['filmmaker', 'producer', 'distributor', 'cinema_operator', 'research_partner', 'studio_analyst', 'investor', 'admin'] },
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('filmiq_token')?.value

  // ── Landing page — public; authenticated users go straight to dashboard ──
  if (pathname === '/') {
    if (token) {
      const payload = jwtPayload(token)
      if (payload?.must_change_pw) {
        return NextResponse.redirect(new URL(CHANGE_PW_PATH, request.url))
      }
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return NextResponse.next()
  }

  // ── Auth pages (login, forgot-password) — redirect authed users away ─────
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p) && p !== '/')) {
    if (token) {
      const payload = jwtPayload(token)
      if (payload?.must_change_pw) {
        return NextResponse.redirect(new URL(CHANGE_PW_PATH, request.url))
      }
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return NextResponse.next()
  }

  // ── All other routes require authentication ───────────────────────────────
  if (!token) {
    const dest = new URL('/auth/login', request.url)
    dest.searchParams.set('next', pathname)
    return NextResponse.redirect(dest)
  }

  const payload = jwtPayload(token)

  // ── Enforce password change ───────────────────────────────────────────────
  if (payload?.must_change_pw && !pathname.startsWith(CHANGE_PW_PATH)) {
    return NextResponse.redirect(new URL(CHANGE_PW_PATH, request.url))
  }

  // ── Role-based route guards ───────────────────────────────────────────────
  const role = (payload?.role as string) ?? ''
  for (const guard of ROLE_GUARDS) {
    if (pathname.startsWith(guard.prefix)) {
      if (!guard.roles.includes(role)) {
        const dest = new URL('/dashboard', request.url)
        dest.searchParams.set('unauthorized', '1')
        return NextResponse.redirect(dest)
      }
      break
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|api/).*)'],
}
