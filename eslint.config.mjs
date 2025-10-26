import tseslint from "typescript-eslint";

const isProd = process.env.NODE_ENV === "production";

const eslintConfig = tseslint.config(
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "**/dist/**",
      "electron/dist/**",
      ".jamra-data/**",
    ],
  },
  ...tseslint.configs.recommended,
  {
    // Custom rules for all files
    rules: {
      // Console usage - warn in dev, error in production
      "no-console": isProd ? "error" : "warn",

      // General code quality
      "no-debugger": isProd ? "error" : "warn",
      "prefer-const": "warn",
      "no-var": "error",

      // TypeScript-specific adjustments
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    // Relax rules for configuration and script files
    files: [
      "*.config.{js,mjs,cjs,ts}",
      "scripts/**/*.{js,mjs,ts}",
      "*.mjs",
      "electron/**/*.{js,mjs,cjs,cts}",
      "test/**/*.{js,ts}",
    ],
    rules: {
      "no-console": "off",
    },
  },
  {
    // Allow console in backend packages (server-side logging)
    files: [
      "packages/**/*.{js,mjs,cjs,ts}",
    ],
    rules: {
      "no-console": "off",
    },
  }
);

export default eslintConfig;
