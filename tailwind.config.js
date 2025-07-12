/** @type {import('tailwindcss').Config} */
import plugin from 'tailwindcss/plugin';

module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}", // Add this line!
    "./components/**/*.{js,ts,jsx,tsx}", // Optional if outside src
    "./app/**/*.{js,ts,jsx,tsx}", // Optional if using app directory
  ],
  theme: {
    extend: {
      animation: {
        'bounce-slow': 'bounce 2s infinite',
      },
      colors: {
        yellow: "#ffc312",
        black: "#111111",
        blue: "#5b7c99",
        offwhite: "#fff8f1",
        brand: {
          yellow: "#ffc312",
          black: "#111111",
          blue: "#5b7c99",
          offwhite: "#fff8f1",
        },
      },
    },
  },
  plugins: [
    plugin(function ({ addUtilities }) {
      addUtilities({
        '.animate-glow': {
          animation: 'glow 1.5s ease-in-out infinite alternate',
        },
        '@keyframes glow': {
          '0%': { opacity: 0.2 },
          '100%': { opacity: 1 },
        },
      });
    }),
  ],
};
