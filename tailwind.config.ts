import defaultTheme from "tailwindcss/defaultTheme";
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      spacing: {
        // Mantine spacing scale (in addition to Tailwind's default scale)
        xs: "0.625rem", // 10px
        sm: "0.75rem", // 12px
        md: "1rem", // 16px
        lg: "1.25rem", // 20px
        xl: "2rem", // 32px
      },
      colors: {
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        // Mantine color integration for commonly used colors
        mantine: {
          blue: {
            0: "var(--mantine-color-blue-0, #e7f5ff)",
            1: "var(--mantine-color-blue-1, #d0ebff)",
            2: "var(--mantine-color-blue-2, #a5d8ff)",
            3: "var(--mantine-color-blue-3, #74c0fc)",
            4: "var(--mantine-color-blue-4, #4dabf7)",
            5: "var(--mantine-color-blue-5, #339af0)",
            6: "var(--mantine-color-blue-6, #228be6)",
            7: "var(--mantine-color-blue-7, #1c7ed6)",
            8: "var(--mantine-color-blue-8, #1971c2)",
            9: "var(--mantine-color-blue-9, #1864ab)",
          },
          red: {
            0: "var(--mantine-color-red-0, #fff5f5)",
            1: "var(--mantine-color-red-1, #ffe3e3)",
            2: "var(--mantine-color-red-2, #ffc9c9)",
            3: "var(--mantine-color-red-3, #ffa8a8)",
            4: "var(--mantine-color-red-4, #ff8787)",
            5: "var(--mantine-color-red-5, #ff6b6b)",
            6: "var(--mantine-color-red-6, #fa5252)",
            7: "var(--mantine-color-red-7, #f03e3e)",
            8: "var(--mantine-color-red-8, #e03131)",
            9: "var(--mantine-color-red-9, #c92a2a)",
          },
          gray: {
            0: "var(--mantine-color-gray-0, #f8f9fa)",
            1: "var(--mantine-color-gray-1, #f1f3f5)",
            2: "var(--mantine-color-gray-2, #e9ecef)",
            3: "var(--mantine-color-gray-3, #dee2e6)",
            4: "var(--mantine-color-gray-4, #ced4da)",
            5: "var(--mantine-color-gray-5, #adb5bd)",
            6: "var(--mantine-color-gray-6, #868e96)",
            7: "var(--mantine-color-gray-7, #495057)",
            8: "var(--mantine-color-gray-8, #343a40)",
            9: "var(--mantine-color-gray-9, #212529)",
          },
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", ...defaultTheme.fontFamily.sans],
        mono: [...defaultTheme.fontFamily.mono],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
};

export default config;
