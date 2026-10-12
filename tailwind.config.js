/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: [
    './src/renderer/index.html',
    './src/renderer/src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        // Semantic tokens (driven by CSS variables in globals.css, auto light/dark)
        desk: v('desk'),         // app background behind the paper
        chrome: v('chrome'),     // title bar, rails, panels
        paper: v('paper'),       // document page & raised surfaces
        ink: v('ink'),           // primary text
        muted: v('muted'),       // secondary text
        line: v('line'),         // hairlines & borders
        accent: {
          DEFAULT: v('accent'),
          hover: v('accent-hover'),
          on: v('on-accent')
        },
        marker: {                // highlighter yellow — the AI colour
          DEFAULT: v('marker'),
          ink: v('marker-ink')
        },
        danger: v('danger'),
        success: v('success'),

        // Legacy aliases so any older class names keep working
        surface: { light: v('paper'), dark: v('paper') },
        canvas: { light: v('desk'), dark: v('desk') },
        border: { light: v('line'), dark: v('line') },
        content: { light: v('ink'), dark: v('ink'), mutedLight: v('muted'), mutedDark: v('muted') }
      },
      fontFamily: {
        sans: ['Onest', 'Segoe UI Variable', 'Segoe UI', 'system-ui', 'sans-serif'],
        serif: ['Literata', 'Georgia', 'Cambria', 'serif'],
        mono: ['JetBrains Mono', 'Consolas', 'Courier New', 'monospace']
      },
      fontSize: {
        '2xs': ['10.5px', { lineHeight: '14px' }],
        ui: ['12.5px', { lineHeight: '18px' }]
      },
      boxShadow: {
        paper: '0 1px 0 rgb(var(--shadow) / 0.04), 0 12px 32px -12px rgb(var(--shadow) / 0.18)',
        float: '0 1px 2px rgb(var(--shadow) / 0.06), 0 8px 24px -6px rgb(var(--shadow) / 0.22)',
        modal: '0 24px 64px -16px rgb(var(--shadow) / 0.45)'
      },
      keyframes: {
        pop: {
          from: { opacity: '0', transform: 'translateY(4px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' }
        },
        drawer: {
          from: { opacity: '0', transform: 'translateX(12px)' },
          to: { opacity: '1', transform: 'translateX(0)' }
        },
        fade: { from: { opacity: '0' }, to: { opacity: '1' } },
        sweep: {
          '0%': { backgroundPosition: '-100% 0' },
          '100%': { backgroundPosition: '200% 0' }
        }
      },
      animation: {
        pop: 'pop 160ms cubic-bezier(0.2, 0.9, 0.3, 1)',
        drawer: 'drawer 200ms cubic-bezier(0.2, 0.9, 0.3, 1)',
        fade: 'fade 160ms ease-out',
        sweep: 'sweep 1.6s linear infinite'
      }
    }
  },
  plugins: []
};
