/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "rgb(var(--ink-950) / <alpha-value>)",
          900: "rgb(var(--ink-900) / <alpha-value>)",
          800: "rgb(var(--ink-800) / <alpha-value>)",
          700: "rgb(var(--ink-700) / <alpha-value>)",
          600: "rgb(var(--ink-600) / <alpha-value>)",
        },
        gold: {
          400: "rgb(var(--gold-400) / <alpha-value>)",
          500: "rgb(var(--gold-500) / <alpha-value>)",
        },
        onacc: "rgb(var(--on-accent) / <alpha-value>)",
        slate: {
          100: "rgb(var(--fg) / <alpha-value>)",
          200: "rgb(var(--fg-muted) / <alpha-value>)",
          300: "rgb(var(--fg-muted) / <alpha-value>)",
          400: "rgb(var(--fg-dim) / <alpha-value>)",
          500: "rgb(var(--fg-faint) / <alpha-value>)",
          600: "rgb(var(--fg-faint) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["Segoe UI", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
