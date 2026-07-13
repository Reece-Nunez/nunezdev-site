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
    colors: {
      // Your custom colors here - this keeps all default Tailwind colors
      yellow: "#ffc312", // Note: this will override Tailwind's yellow
      customBlue: "#5b7c99", // Rename to avoid overriding default blue
      brand: {
        yellow: "#ffc312",
        black: "#111111",
        blue: "#5b7c99",
        offwhite: "#fff8f1",
        navy: "#0b2a4a",
      },
      // Semantic design tokens (values in src/app/globals.css :root). Use as
      // bg-ds-surface, text-ds-muted, border-ds-border, etc. The `<alpha-value>`
      // wiring makes opacity modifiers (bg-ds-surface/50) work.
      ds: {
        bg: "rgb(var(--ds-bg) / <alpha-value>)",
        surface: "rgb(var(--ds-surface) / <alpha-value>)",
        "surface-2": "rgb(var(--ds-surface-2) / <alpha-value>)",
        border: "rgb(var(--ds-border) / <alpha-value>)",
        text: "rgb(var(--ds-text) / <alpha-value>)",
        muted: "rgb(var(--ds-text-muted) / <alpha-value>)",
        subtle: "rgb(var(--ds-text-subtle) / <alpha-value>)",
        accent: "rgb(var(--ds-accent) / <alpha-value>)",
        "accent-ink": "rgb(var(--ds-accent-ink) / <alpha-value>)",
        danger: "rgb(var(--ds-danger) / <alpha-value>)",
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
        '.animate-pulse-glow': {
          animation: 'pulse-glow 2s ease-in-out infinite',
        },
        '@keyframes pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(255, 195, 18, 0.2)' },
          '50%': { boxShadow: '0 0 40px rgba(255, 195, 18, 0.5)' },
        },
      });
    }),
  ],
};
