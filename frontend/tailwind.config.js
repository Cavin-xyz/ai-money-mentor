/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: '#F5F3EF',
        navy: {
          950: '#040D1F',
          900: '#0A192F',
          800: '#0D2137',
          700: '#122844',
          600: '#1A3550',
        },
        slate: {
          glass: 'rgba(10,25,47,0.03)',
          border: 'rgba(10,25,47,0.08)',
        },
        green: {
          growth: '#10B981',
          glow: '#34D399',
          dim: '#065F46',
        },
      },
      fontFamily: {
        // Nirmala UI ships with Windows and covers Devanagari, Telugu and Tamil offline
        sans: ['Plus Jakarta Sans', 'Inter', 'Nirmala UI', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'ticker': 'ticker 25s linear infinite',
        'fade-up': 'fadeUp 0.6s ease-out forwards',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4,0,0.6,1) infinite',
      },
      keyframes: {
        ticker: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        fadeUp: {
          '0%': { opacity: 0, transform: 'translateY(20px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
