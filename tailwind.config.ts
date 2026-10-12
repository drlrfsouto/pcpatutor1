import type { Config } from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#07111f',
        panel: '#0c1928',
        line: '#1b2b3e',
        mint: '#68f0c2',
        cyan: '#65d9f5',
        amber: '#f7c873',
      },
      boxShadow: {
        glow: '0 0 40px rgba(104, 240, 194, 0.12)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
