/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Public Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Minimals Palette
        grey: {
          0: 'rgb(var(--grey-0) / <alpha-value>)',
          100: 'rgb(var(--grey-100) / <alpha-value>)',
          200: 'rgb(var(--grey-200) / <alpha-value>)',
          300: 'rgb(var(--grey-300) / <alpha-value>)',
          400: 'rgb(var(--grey-400) / <alpha-value>)',
          500: 'rgb(var(--grey-500) / <alpha-value>)',
          600: 'rgb(var(--grey-600) / <alpha-value>)',
          700: 'rgb(var(--grey-700) / <alpha-value>)',
          800: 'rgb(var(--grey-800) / <alpha-value>)',
          900: 'rgb(var(--grey-900) / <alpha-value>)',
        },
        white: 'rgb(var(--grey-0) / <alpha-value>)',
        black: 'rgb(var(--grey-900) / <alpha-value>)',
        primary: {
          lighter: '#C8FAD6',
          light: '#5BE49B',
          DEFAULT: '#00A76F',
          dark: '#007867',
          darker: '#004B50',
          foreground: '#FFFFFF',
        },
        secondary: {
          lighter: '#EFD6FF',
          light: '#C684FF',
          DEFAULT: '#8E33FF',
          dark: '#5119B7',
          darker: '#27097A',
          foreground: '#FFFFFF',
        },
        info: {
          lighter: '#CAFDF5',
          light: '#61F3F3',
          DEFAULT: '#00B8D9',
          dark: '#006C9C',
          darker: '#003768',
          foreground: '#FFFFFF',
        },
        success: {
          lighter: '#D3FCD2',
          light: '#77ED8B',
          DEFAULT: '#22C55E',
          dark: '#118D57',
          darker: '#065E49',
          foreground: '#FFFFFF',
        },
        warning: {
          lighter: '#FFF5CC',
          light: '#FFD666',
          DEFAULT: '#FFAB00',
          dark: '#B76E00',
          darker: '#7A4100',
          foreground: '#212B36',
        },
        error: {
          lighter: '#FFE9D5',
          light: '#FFAC82',
          DEFAULT: '#FF5630',
          dark: '#B71D18',
          darker: '#7A0916',
          foreground: '#FFFFFF',
        },
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        border: 'hsl(var(--border))',
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar))',
          foreground: 'hsl(var(--sidebar-foreground))',
          border: 'hsl(var(--sidebar-border))',
        },
      },
      boxShadow: {
        'z1': 'var(--shadow-z1)',
        'z4': 'var(--shadow-z4)',
        'z8': 'var(--shadow-z8)',
        'z12': 'var(--shadow-z12)',
        'z16': 'var(--shadow-z16)',
        'z20': 'var(--shadow-z20)',
        'z24': 'var(--shadow-z24)',
        'card': 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
        'dropdown': 'var(--shadow-dropdown)',
        'dialog': 'var(--shadow-dialog)',
        'primary': 'var(--shadow-primary)',
        'secondary': 'var(--shadow-secondary)',
        'info': 'var(--shadow-info)',
        'success': 'var(--shadow-success)',
        'warning': 'var(--shadow-warning)',
        'error': 'var(--shadow-error)',
      },
      borderRadius: {
        'xs': '4px',
        'sm': '6px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
        '2xl': '20px',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        // Dialog content is centered via `translate(-50%, -50%)` as a static utility class.
        // A CSS animation's `transform` keyframe value replaces the element's whole transform
        // while it runs, not composes with it — so reusing plain `fade-in` here would blow away
        // that centering offset for the animation's duration (element flashes near the
        // viewport's top-left-of-center, i.e. visually toward the bottom-right of true center,
        // then snaps to centered once the animation ends). This keyframe bakes the centering
        // translate into both the from/to states so it survives the whole animation.
        'dialog-in': {
          from: { opacity: '0', transform: 'translate(-50%, -50%) translateY(6px)' },
          to: { opacity: '1', transform: 'translate(-50%, -50%) translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        'dialog-in': 'dialog-in 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
}
