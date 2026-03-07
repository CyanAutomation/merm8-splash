import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'bt-bg-primary': '#1e1e1e',
        'bt-bg-secondary': '#2a2a2a',
        'bt-border': '#444444',
        'bt-text-primary': '#a0a0a0',
        'bt-text-secondary': '#707070',
        'bt-accent-primary': '#7571f9',
        'bt-accent-secondary': '#a1efe4',
        'bt-success': '#04b575',
        'bt-warning': '#ffc107',
        'bt-error': '#ff5555',
        'bt-info': '#7aa2f7',
      },
      fontFamily: {
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
