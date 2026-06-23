'use client'

import Link from 'next/link'

export default function RegisterPage() {
  return (
    <div className="flex min-h-[calc(100vh-68px)] items-center justify-center bg-filmiq-bg2 px-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-navy">FilmIQ</h1>
        </div>
        <div className="card p-8">
          <div className="mb-4 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100">
              <span className="text-2xl">🔒</span>
            </div>
          </div>
          <h2 className="mb-2 text-xl font-semibold text-navy">Access by Invitation</h2>
          <p className="mb-6 text-sm text-slate-500">
            Self-registration is disabled. Contact an administrator to create an account for you.
          </p>
          <Link href="/auth/login" className="btn-primary inline-block w-full text-center">
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  )
}
