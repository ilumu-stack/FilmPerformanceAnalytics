'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Film } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MovieBackdropProps {
  src?:        string | null
  title:       string
  className?:  string
  /** Adds a dark gradient overlay so light/white text stays readable on top. */
  overlay?:    boolean
  priority?:   boolean
  children?:   React.ReactNode
}

/** Backdrop/hero image (TMDb original) with a navy gradient placeholder when unavailable. */
export function MovieBackdrop({ src, title, className, overlay = true, priority = false, children }: MovieBackdropProps) {
  const [errored, setErrored] = useState(false)
  const showPlaceholder = !src || errored

  return (
    <div className={cn('relative overflow-hidden bg-navy-900', className)}>
      {showPlaceholder ? (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-navy-900 via-navy-800 to-navy-950">
          <Film className="h-12 w-12 text-white/10" />
        </div>
      ) : (
        <Image
          src={src}
          alt={`${title} backdrop`}
          fill
          sizes="100vw"
          loading={priority ? undefined : 'lazy'}
          priority={priority}
          className="object-cover"
          onError={() => setErrored(true)}
        />
      )}
      {overlay && (
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/60 to-navy-950/10" />
      )}
      {children && <div className="relative z-10 h-full">{children}</div>}
    </div>
  )
}
