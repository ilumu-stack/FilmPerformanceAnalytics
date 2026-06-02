export default function Loading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      <div className="mb-4 font-display text-4xl tracking-widest text-yellow-400">FILMIQ</div>
      <div className="h-1 w-40 overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-2/3 animate-pulse rounded-full bg-yellow-400" />
      </div>
      <p className="mt-3 text-[11px] uppercase tracking-[3px] text-gray-500">Loading...</p>
    </div>
  )
}
