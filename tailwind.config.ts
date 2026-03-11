import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    screens: {}, // Desktop-only app; no responsive breakpoints
    extend: {
      colors: {
        'bt-bg-primary': '#1c1c1e',
        'bt-bg-secondary': '#2c2c2e',
        'bt-border': '#444444',
        'bt-text-primary': '#e1e1e1',
        'bt-text-secondary': '#a0a0a0',
        'bt-accent-primary': '#0a84ff',
        'bt-accent-secondary': '#5e5ce6',
        'bt-success': '#04b575',
        'bt-warning': '#ffc107',
        'bt-error': '#ff5555',
        'bt-info': '#7aa2f7',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Helvetica Neue', 'sans-serif'],
        mono: ['IBM Plex Mono', 'Courier New', 'monospace'],
      },
      fontSize: {
        base: '14px',
      },
      lineHeight: {
        base: '1.4',
      },
      borderWidth: {
        '2': '2px',
      },
    },
  },
  plugins: [],
}
export default config
