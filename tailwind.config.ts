import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          900: '#0B1220',
          800: '#1E293B',
          700: '#334155',
          600: '#475569',
          500: '#64748B',
          400: '#94A3B8',
          300: '#CBD5E1',
          200: '#E2E8F0',
          100: '#F1F5F9',
          50:  '#F8FAFC'
        },
        brand: {
          50:  '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#2563EB',
          600: '#1D4ED8',
          700: '#1E40AF',
          800: '#1E3A8A',
          900: '#172554'
        },
        success: { 50: '#ECFDF5', 100: '#D1FAE5', 500: '#10B981', 700: '#047857' },
        warn:    { 50: '#FFFBEB', 100: '#FEF3C7', 500: '#F59E0B', 700: '#B45309' },
        danger:  { 50: '#FEF2F2', 100: '#FEE2E2', 500: '#EF4444', 700: '#B91C1C' }
      },
      fontFamily: {
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }]
      },
      boxShadow: {
        // Subtle elevation tokens — Linear / Lemlist style
        xs: '0 1px 2px rgba(15, 23, 42, 0.04)',
        sm: '0 1px 2px rgba(15, 23, 42, 0.04), 0 2px 4px rgba(15, 23, 42, 0.04)',
        card: '0 1px 2px rgba(15, 23, 42, 0.04), 0 2px 8px rgba(15, 23, 42, 0.04)',
        elev: '0 4px 16px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)',
        pop:  '0 12px 32px rgba(15, 23, 42, 0.12), 0 2px 6px rgba(15, 23, 42, 0.06)',
        ring: '0 0 0 4px rgba(37, 99, 235, 0.12)'
      },
      borderRadius: {
        '2.5': '0.625rem'
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'out-back': 'cubic-bezier(0.34, 1.56, 0.64, 1)'
      },
      keyframes: {
        'fade-in':    { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'slide-up':   { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'slide-down': { '0%': { opacity: '0', transform: 'translateY(-8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'pulse-soft': { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.65' } },
        'shimmer':    { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } }
      },
      animation: {
        'fade-in':    'fade-in 240ms ease-out',
        'slide-up':   'slide-up 280ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down': 'slide-down 280ms cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-soft': 'pulse-soft 1.6s ease-in-out infinite',
        'shimmer':    'shimmer 1.8s linear infinite'
      },
      backgroundImage: {
        'shimmer': 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%)'
      }
    }
  },
  plugins: []
};

export default config;
