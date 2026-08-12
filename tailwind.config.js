/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0D0D0D',
        charcoal: '#1A1A1A',
        slate2: '#242424',
        line: '#333333',
        cream: '#F5F1E8',
        muted: '#8A8578',
        gold: '#C9A227',
        goldsoft: '#E4C765',
        artA: '#E0B400',
        artB: '#2E9E5B',
        artC: '#C0392B',
        artD: '#7D3CB5',
        artE: '#8A5A2B',
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', '"Songti SC"', 'serif'],
        sans: ['"Inter"', '"PingFang SC"', '"Microsoft YaHei"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Consolas', 'monospace'],
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        popIn: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '60%': { opacity: '1', transform: 'scale(1.03)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        flipIn: {
          '0%': { transform: 'rotateY(90deg)', opacity: '0' },
          '100%': { transform: 'rotateY(0deg)', opacity: '1' },
        },
        coinFly: {
          '0%': { opacity: '1', transform: 'translate(0,0) scale(1)' },
          '100%': { opacity: '0', transform: 'translate(var(--fx), var(--fy)) scale(0.5)' },
        },
        pulseGold: {
          '0%,100%': { boxShadow: '0 0 0 0 rgba(201,162,39,0.5)' },
          '50%': { boxShadow: '0 0 0 10px rgba(201,162,39,0)' },
        },
        ticker: {
          '0%': { transform: 'translateY(6px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        fadeUp: 'fadeUp .35s ease-out both',
        fadeIn: 'fadeIn .3s ease-out both',
        popIn: 'popIn .3s cubic-bezier(.2,.8,.3,1) both',
        flipIn: 'flipIn .45s cubic-bezier(.2,.8,.3,1) both',
        pulseGold: 'pulseGold 1.6s ease-out infinite',
        ticker: 'ticker .4s ease-out both',
        shimmer: 'shimmer 2.4s linear infinite',
      },
    },
  },
  plugins: [],
};
