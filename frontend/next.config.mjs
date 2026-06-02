/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'image.tmdb.org' },
    ],
  },
  async rewrites() {
    // BACKEND_URL is a server-only env var (not NEXT_PUBLIC_) used only by
    // Next.js server-side rewrites. In Docker this is set to http://backend:8000.
    // Locally it falls back to http://localhost:8000.
    // NEVER use NEXT_PUBLIC_API_URL here — that bakes the value at build time
    // and resolves to "" (empty) in the Docker multi-stage build.
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000'
    return [
      {
        source:      '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
