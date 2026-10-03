import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "coverage/**", "node_modules/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Vite config files and the vitest config run in Node, not the browser.
    files: ["*.config.ts", "*.config.js"],
    languageOptions: { globals: globals.node },
  },
  {
    // A context provider and its hook belong in one file, and `ui.tsx` is a
    // deliberate shared-primitive module. Splitting them would trade a Fast
    // Refresh limitation for a directory of one-line files.
    files: ["src/context/**/*.tsx", "src/components/ui.tsx"],
    rules: { "react-refresh/only-export-components": "off" },
  },
  {
    // These three open an external system and reflect the result in state:
    // a shared CCC client, a health poll, and the connector's own client.
    // Marking that result is inherently a setState inside the effect; the
    // alternative is pulling in a caching library purely to move the call.
    files: [
      "src/hooks/useAsync.ts",
      "src/context/HealthProvider.tsx",
      "src/context/ConnectorProvider.tsx",
    ],
    rules: { "react-hooks/set-state-in-effect": "off" },
  },
  {
    files: ["src/test/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);
