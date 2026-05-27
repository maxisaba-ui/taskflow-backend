/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta personalizada TaskFlow Pro
        taskflow: {
          bg:       '#030712',
          surface:  '#111827',
          card:     '#1f2937',
          border:   '#374151',
          accent:   '#6366f1',
          success:  '#10b981',
          warning:  '#f59e0b',
          danger:   '#ef4444',
          info:     '#3b82f6',
        }
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
