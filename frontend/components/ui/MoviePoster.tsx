'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Film } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MoviePosterProps {
  src?:       string | null
  title:      string
  className?: string
  sizes?:     string
  priority?:  boolean
}

/** Poster image (TMDb w500) with a light-themed placeholder when unavailable or broken. */
export function MoviePoster({ src, title, className, sizes = '200px', priority = false }: MoviePosterProps) {
  const [errored, setErrored] = useState(false)
  const showPlaceholder = !src || errored

  return (
    <div className={cn('relative overflow-hidden rounded-lg bg-slate-100', className)}>
      {showPlaceholder ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-100 to-slate-200 p-3 text-center">
          <Film className="h-6 w-6 text-slate-400" />
          <span className="line-clamp-2 text-[11px] font-medium text-slate-400">{title}</span>
        </div>
      ) : (
        <Image
          src={src}
          alt={`${title} poster`}
          fill
          sizes={sizes}
          loading={priority ? undefined : 'lazy'}
          priority={priority}
          className="object-cover"
          onError={() => setErrored(true)}
        />
      )}
    </div>
  )
}
