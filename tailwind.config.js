/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{html,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#07090E',
          card: 'rgba(15, 23, 42, 0.65)',
          border: 'rgba(255, 255, 255, 0.08)',
          glow: '#F43F5E'
        }
      },
      boxShadow: {
        'glow-sm': '0 0 12px rgba(244, 63, 94, 0.2)',
        'glow-lg': '0 0 25px rgba(244, 63, 94, 0.35)',
      }
    },
  },
  plugins: [],
}
