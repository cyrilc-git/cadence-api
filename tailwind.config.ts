import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          900: '#0F172A',
          700: '#334155',
          500: '#64748B',
          300: '#CBD5E1',
          100: '#F1F5F9',
          50:  '#F8FAFC'
        },
        brand: {
          50:  '#EEF2FF',
          100: '#E0E7FF',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA'
        },
        success: { 50: '#ECFDF5', 500: '#10B981', 700: '#047857' },
        warn:    { 50: '#FFFBEB', 500: '#F59E0B', 700: '#B45309' },
        danger:  { 50: '#FEF2F2', 500: '#EF4444', 700: '#B91C1C' }
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif']
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,0.04), 0 4px 16px rgba(15,23,42,0.04)',
        pop:  '0 8px 32px rgba(15,23,42,0.12)'
      }
    }
  },
  plugins: []
};

export default config;
