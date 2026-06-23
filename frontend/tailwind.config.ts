import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0f2142',
          50:  '#f0f4fb',
          100: '#dce6f5',
          200: '#bacde9',
          300: '#8aaed9',
          400: '#5b8dc8',
          500: '#3a6fba',
          600: '#2a56a0',
          700: '#234582',
          800: '#1a3360',
          900: '#0f2142',
          950: '#091530',
        },
        brand: {
          DEFAULT: '#2563eb',
          light:   '#3b82f6',
          dark:    '#1d4ed8',
          50:      '#eff6ff',
          100:     '#dbeafe',
          200:     '#bfdbfe',
        },
        filmiq: {
          bg:  '#f8fafc',
          bg2: '#f1f5f9',
          bg3: '#e2e8f0',
        },
        // Keep legacy accent colors for chart data series
        gold:   '#d4a843',
        gold2:  '#f0c060',
        silver: '#8892a4',
      },
      fontFamily: {
        sans:    ['var(--font-inter)',    'sans-serif'],
        display: ['var(--font-inter)',    'sans-serif'],
        body:    ['var(--font-inter)',    'sans-serif'],
        mono:    ['var(--font-dm-mono)', 'monospace'],
      },
      boxShadow: {
        card:   '0 1px 3px 0 rgba(0,0,0,0.07), 0 1px 2px -1px rgba(0,0,0,0.05)',
        'card-hover': '0 4px 12px 0 rgba(0,0,0,0.10), 0 2px 6px -1px rgba(0,0,0,0.06)',
        'navy':  '0 4px 14px rgba(15,33,66,0.25)',
      },
    },
  },
  plugins: [],
}
export default config
