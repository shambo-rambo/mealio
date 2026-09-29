import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Material Design 3 color tokens — green family palette
        'primary': '#096430',
        'on-primary': '#ffffff',
        'primary-container': '#2d7d46',
        'on-primary-container': '#ccffd1',
        'primary-fixed': '#a3f5b2',
        'primary-fixed-dim': '#87d898',
        'on-primary-fixed': '#00210b',
        'on-primary-fixed-variant': '#005225',
        'inverse-primary': '#87d898',

        'secondary': '#48654c',
        'on-secondary': '#ffffff',
        'secondary-container': '#c7e8c8',
        'on-secondary-container': '#4c6a50',
        'secondary-fixed': '#c9ebcb',
        'secondary-fixed-dim': '#aecfb0',
        'on-secondary-fixed': '#04210d',
        'on-secondary-fixed-variant': '#304d36',

        'tertiary': '#205699',
        'on-tertiary': '#ffffff',
        'tertiary-container': '#3e6fb3',
        'on-tertiary-container': '#eef2ff',
        'tertiary-fixed': '#d5e3ff',
        'tertiary-fixed-dim': '#a7c8ff',
        'on-tertiary-fixed': '#001b3c',
        'on-tertiary-fixed-variant': '#024688',

        'error': '#ba1a1a',
        'on-error': '#ffffff',
        'error-container': '#ffdad6',
        'on-error-container': '#93000a',

        'surface': '#f7fbf3',
        'surface-dim': '#d7dbd4',
        'surface-bright': '#f7fbf3',
        'surface-variant': '#e0e4dc',
        'on-surface': '#181d18',
        'on-surface-variant': '#404940',
        'inverse-surface': '#2d322d',
        'inverse-on-surface': '#eef2ea',
        'surface-tint': '#186c37',

        'surface-container-lowest': '#ffffff',
        'surface-container-low': '#f1f5ed',
        'surface-container': '#ebefe7',
        'surface-container-high': '#e5e9e2',
        'surface-container-highest': '#e0e4dc',

        'background': '#f7fbf3',
        'on-background': '#181d18',

        'outline': '#707a6f',
        'outline-variant': '#bfc9bd',

        // Named palette (for direct use)
        'ink': '#1a1a1a',
        'stone': '#d3d1c7',
        'warm-gold': '#c8a96e',
      },
      borderRadius: {
        DEFAULT: '0.25rem',    // 4px — buttons
        sm: '0.125rem',
        md: '0.25rem',
        lg: '0.5rem',          // 8px — cards, inputs
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
        full: '9999px',
      },
      fontFamily: {
        headline: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        label: ['Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '1px 2px 6px rgba(0,0,0,0.05)',
        'card-md': '0px 8px 24px rgba(26,26,26,0.08)',
        'nav-top': '0px 12px 32px rgba(26,26,26,0.04)',
        'nav-bottom': '0px -4px 12px rgba(0,0,0,0.15)',
        'fab': '0px 4px 12px rgba(26,26,26,0.25)',
      },
    },
  },
  plugins: [],
} satisfies Config
