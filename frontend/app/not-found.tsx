import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-8 text-center">
      <div className="text-[120px] font-bold leading-none text-slate-100">404</div>
      <h2 className="mt-2 text-2xl font-bold text-navy">Page Not Found</h2>
      <p className="mt-3 text-sm text-slate-500">This page doesn&apos;t exist in our analytics database.</p>
      <Link href="/" className="btn-primary mt-8">Return Home</Link>
    </div>
  )
}
