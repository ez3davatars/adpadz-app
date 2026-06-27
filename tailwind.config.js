/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        neon: {
          DEFAULT: '#B6FF00',
          dim: '#8FCC00',
          dark: '#5A8000',
        },
        surface: {
          base: '#050505',
          DEFAULT: '#0A0A0A',
          elevated: '#111111',
          card: '#141414',
          input: '#1A1A1A',
          hover: '#1F1F1F',
          border: '#2A2A2A',
        },
      },
      borderRadius: {
        'xl': '16px',
        '2xl': '20px',
        '3xl': '24px',
      },
      animation: {
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite alternate',
        'float': 'float 6s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        'glow-pulse': {
          '0%': { boxShadow: '0 0 8px rgba(182,255,0,0.2)' },
          '100%': { boxShadow: '0 0 24px rgba(182,255,0,0.4), 0 0 60px rgba(182,255,0,0.15)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};
