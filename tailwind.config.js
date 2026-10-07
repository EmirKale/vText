/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './src/renderer/index.html',
    './src/renderer/src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#6366F1',
          hover: '#4F46E5',
          light: '#EEF2FF',
          dark: '#312E81'
        },
        surface: {
          light: '#FFFFFF',
          dark: '#1E1F23'
        },
        canvas: {
          light: '#F5F5F4',
          dark: '#17181B'
        },
        border: {
          light: '#E5E7EB',
          dark: '#2E3036'
        },
        content: {
          light: '#1F2937',
          dark: '#E5E7EB',
          mutedLight: '#6B7280',
          mutedDark: '#9CA3AF'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'Courier New', 'monospace']
      },
      boxShadow: {
        page: '0 4px 20px -2px rgba(0, 0, 0, 0.05), 0 2px 6px -1px rgba(0, 0, 0, 0.03)',
        card: '0 2px 8px -1px rgba(0, 0, 0, 0.08)'
      }
    }
  },
  plugins: []
}
