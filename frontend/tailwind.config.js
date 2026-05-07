/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      colors: {
        primary: { 50:'#eef2ff',100:'#e0e7ff',200:'#c7d2fe',300:'#a5b4fc',400:'#818cf8',500:'#6366f1',600:'#4f46e5',700:'#4338ca',800:'#3730a3',900:'#312e81' },
        accent: { 50:'#fdf4ff',100:'#fae8ff',200:'#f5d0fe',300:'#f0abfc',400:'#e879f9',500:'#d946ef',600:'#c026d3',700:'#a21caf',800:'#86198f',900:'#701a75' },
        success: { 50:'#f0fdf4',500:'#22c55e',600:'#16a34a' },
        warning: { 50:'#fffbeb',500:'#f59e0b',600:'#d97706' },
        danger: { 50:'#fef2f2',500:'#ef4444',600:'#dc2626' },
        dark: { 800:'#1e1b4b',900:'#0f0a2e',950:'#070419' }
      }
    },
  },
  plugins: [],
}
