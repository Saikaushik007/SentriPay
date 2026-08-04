/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0a0a0a',
        surface: '#121212',
        border: '#262626',
        primary: '#3b82f6', // Premium blue
        success: '#10b981',
        danger: '#ef4444',
        warning: '#f59e0b',
        textMain: '#f5f5f5',
        textMuted: '#a3a3a3',
      },
    },
  },
  plugins: [],
}
