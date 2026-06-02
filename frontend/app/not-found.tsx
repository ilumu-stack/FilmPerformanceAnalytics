import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-8">
      <div className="font-display text-[120px] leading-none tracking-widest text-yellow-400/20">404</div>
      <h2 className="mt-4 text-2xl font-display tracking-widest text-white">PAGE NOT FOUND</h2>
      <p className="mt-3 text-sm text-gray-500">This page doesn't exist in our analytics database.</p>
      <Link href="/" className="btn-primary mt-8">Return Home</Link>
    </div>
  )
}
