'use client'

import Link from 'next/link'

export default function RegisterPage() {
  return (
    <div className="flex min-h-[calc(100vh-88px)] items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-8">
          <h1 className="font-display text-5xl tracking-widest text-yellow-400">FILMIQ</h1>
        </div>
        <div className="glass-card p-8">
          <div className="mb-4 text-4xl">🔒</div>
          <h2 className="mb-2 font-display text-xl tracking-widest">ACCESS BY INVITATION</h2>
          <p className="mb-6 text-sm text-gray-500">
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
