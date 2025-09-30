/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        nav: "var(--color-nav)",
        content: "var(--color-background)",
        primary: "var(--color-foreground)",
        muted: "var(--color-muted)",
        accent: "var(--color-accent)",
        "accent-hover": "var(--color-accent-hover)",
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
        lg: "var(--radius-lg)",
      },
      fontFamily: {
        mono: "var(--font-mono)",
      },
    },
  },
  plugins: [],
};
