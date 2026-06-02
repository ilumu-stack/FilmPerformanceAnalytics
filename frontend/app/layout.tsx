import type { Metadata } from 'next'
import { Bebas_Neue, DM_Sans, DM_Mono } from 'next/font/google'
import './globals.css'
import { NavBar } from '@/components/NavBar'
import { ClientProviders } from '@/components/ClientProviders'

const bebasNeue = Bebas_Neue({ weight: '400',                  subsets: ['latin'], variable: '--font-bebas-neue' })
const dmSans    = DM_Sans   ({ weight: ['300','400','500','600'], subsets: ['latin'], variable: '--font-dm-sans'    })
const dmMono    = DM_Mono   ({ weight: ['400','500'],            subsets: ['latin'], variable: '--font-dm-mono'    })

export const metadata: Metadata = {
  title: 'FilmIQ — African Cinema Intelligence',
  description: 'Data-Driven Intelligence for African Cinema. Predict box office, analyze audiences, and discover investment opportunities.',
  keywords: ['African cinema', 'film analytics', 'box office prediction', 'Uganda film', 'Nollywood'],
  openGraph: {
    title: 'FilmIQ — African Cinema Intelligence',
    description: 'AI-powered film analytics for the African market',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${bebasNeue.variable} ${dmSans.variable} ${dmMono.variable} bg-filmiq-bg text-white antialiased`}>
        <NavBar />
        <ClientProviders>
          <main className="pt-[88px]">{children}</main>
        </ClientProviders>
      </body>
    </html>
  )
}
