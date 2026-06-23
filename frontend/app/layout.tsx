import type { Metadata } from 'next'
import { Inter, DM_Mono } from 'next/font/google'
import './globals.css'
import { NavBar } from '@/components/NavBar'
import { ClientProviders } from '@/components/ClientProviders'

const inter  = Inter ({ weight: ['300','400','500','600','700'], subsets: ['latin'], variable: '--font-inter'    })
const dmMono = DM_Mono({ weight: ['400','500'],                  subsets: ['latin'], variable: '--font-dm-mono'  })

export const metadata: Metadata = {
  title: 'FilmIQ — Ugandan Cinema Intelligence',
  description: 'Data-Driven Intelligence for Ugandan Cinema. Predict box office, analyze audiences, and discover investment opportunities.',
  keywords: ['Ugandan cinema', 'film analytics', 'box office prediction', 'Uganda film', 'Nollywood'],
  openGraph: {
    title: 'FilmIQ — Ugandan Cinema Intelligence',
    description: 'AI-powered film analytics for the Ugandan market',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${dmMono.variable} bg-filmiq-bg text-slate-800 antialiased`}>
        <NavBar />
        <ClientProviders>
          <main className="pt-[68px]">{children}</main>
        </ClientProviders>
      </body>
    </html>
  )
}
