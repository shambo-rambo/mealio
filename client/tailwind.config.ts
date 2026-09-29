import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Andy Cooks monochromatic palette
        'primary': '#1a1a1a',          // Ink — buttons, nav, badges
        'on-primary': '#ffffff',
        'primary-container': '#2c2c2a', // Slightly softer ink
        'on-primary-container': '#f1efe8',
        'primary-fixed': '#d3d1c7',     // Stone
        'primary-fixed-dim': '#888780', // Cool grey
        'on-primary-fixed': '#1a1a1a',
        'on-primary-fixed-variant': '#2c2c2a',
        'inverse-primary': '#888780',

        'secondary': '#5f5e5a',         // Mid grey
        'on-secondary': '#ffffff',
        'secondary-container': '#f1efe8',
        'on-secondary-container': '#1a1a1a',
        'secondary-fixed': '#e8e5db',
        'secondary-fixed-dim': '#d3d1c7',
        'on-secondary-fixed': '#1a1a1a',
        'on-secondary-fixed-variant': '#2c2c2a',

        'tertiary': '#888780',           // Cool grey — accent
        'on-tertiary': '#ffffff',
        'tertiary-container': '#d3d1c7',
        'on-tertiary-container': '#1a1a1a',
        'tertiary-fixed': '#e8e5db',
        'tertiary-fixed-dim': '#d3d1c7',
        'on-tertiary-fixed': '#1a1a1a',
        'on-tertiary-fixed-variant': '#2c2c2a',

        'error': '#ba1a1a',
        'on-error': '#ffffff',
        'error-container': '#ffdad6',
        'on-error-container': '#93000a',

        'surface': '#f1efe8',            // Off-white — page background
        'surface-dim': '#d3d1c7',        // Stone
        'surface-bright': '#ffffff',
        'surface-variant': '#e8e5db',
        'on-surface': '#1a1a1a',
        'on-surface-variant': '#5f5e5a',
        'inverse-surface': '#2c2c2a',
        'inverse-on-surface': '#f1efe8',
        'surface-tint': '#1a1a1a',

        'surface-container-lowest': '#ffffff',
        'surface-container-low': '#f8f7f2',
        'surface-container': '#f1efe8',
        'surface-container-high': '#e8e5db',
        'surface-container-highest': '#d3d1c7',

        'background': '#f1efe8',
        'on-background': '#1a1a1a',

        'outline': '#888780',
        'outline-variant': '#d3d1c7',

        // Named Andy Cooks palette (for direct use)
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
        headline: ['"Playfair Display"', 'Georgia', 'serif'],
        display: ['"Playfair Display"', 'Georgia', 'serif'],
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
