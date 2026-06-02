import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        gold:   '#d4a843',
        gold2:  '#f0c060',
        silver: '#8892a4',
        filmiq: { bg:'#060810', bg2:'#0c0f1a', bg3:'#111528' },
      },
      fontFamily: {
        display: ['var(--font-bebas-neue)', 'sans-serif'],
        body:    ['var(--font-dm-sans)',    'sans-serif'],
        mono:    ['var(--font-dm-mono)',    'monospace'],
      },
    },
  },
  plugins: [],
}
export default config
