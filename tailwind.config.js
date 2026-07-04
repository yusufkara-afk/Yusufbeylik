/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          bg: '#0B1120',
          card: '#1A2332',
          text: '#F1F5F9',
          muted: '#94A3B8',
          accent: '#3B82F6',
          cyan: '#22D3EE',
        },
        status: {
          stop: '#EF4444',
          watch: '#F59E0B',
          go: '#22C55E',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
