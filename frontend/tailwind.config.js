/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'Poppins', 'Satoshi', 'system-ui', 'sans-serif'] },
      colors: {
        // Primary Background - Deep Blues
        bg: {
          primary: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          tertiary: 'var(--bg-tertiary)'
        },
        // Secondary Colors - Purples
        secondary: {
          50: '#F0F0FF',
          100: '#E6E6FF',
          200: '#CCCCFF',
          300: '#B3B3FF',
          400: '#9999FF',
          500: '#5B4DFF',
          600: '#7B61FF',
          700: '#4A90FF',
          800: '#3730A3',
          900: '#312E81'
        },
        // Accent Colors - Neon Pink and Cyan
        accent: {
          pink: '#FF2E88',
          cyan: '#00D1FF',
          purple: '#8A2EFF',
          primary: 'var(--accent-primary)',
          secondary: 'var(--accent-secondary)'
        },
        // Surface Colors - Glassmorphism
        surface: {
          primary: 'var(--surface-primary)',
          secondary: 'var(--surface-secondary)',
          tertiary: 'var(--surface-tertiary)'
        },
        // Text Colors
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
          placeholder: 'var(--text-placeholder)'
        },
        // Borders
        border: {
          primary: 'var(--border-primary)',
          secondary: 'var(--border-secondary)'
        },
        // Legacy colors for backward compatibility
        success: { 50: '#f0fdf4', 500: '#22c55e', 600: '#16a34a' },
        warning: { 50: '#fffbeb', 500: '#f59e0b', 600: '#d97706' },
        danger: { 50: '#fef2f2', 500: '#ef4444', 600: '#dc2626' }
      },
      backgroundImage: {
        'gradient-primary': 'var(--gradient-primary)',
        'gradient-secondary': 'linear-gradient(135deg, #FF2E88, #00D1FF)',
        'gradient-accent': 'linear-gradient(135deg, #5B4DFF, #7B61FF, #4A90FF)'
      },
      boxShadow: {
        'neon-pink': '0 0 25px rgba(255,46,136,0.35)',
        'neon-cyan': '0 0 25px rgba(0,209,255,0.35)',
        'neon-purple': '0 0 25px rgba(138,46,255,0.35)',
        'glass': 'var(--shadow-glass)',
        'glass-strong': 'var(--shadow-glass-strong)'
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' }
        },
        float: {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-10px) rotate(1deg)' }
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '0.6', filter: 'brightness(1)' },
          '50%': { opacity: '1', filter: 'brightness(1.2)' }
        },
        blob: {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
          '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
          '100%': { transform: 'translate(0px, 0px) scale(1)' }
        }
      },
      animation: {
        shimmer: 'shimmer 2.5s infinite linear',
        float: 'float 6s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 3s ease-in-out infinite',
        blob: 'blob 7s infinite'
      }
    },
  },
  plugins: [],
}

