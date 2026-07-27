// Flat config, mirroring gastosai-web/eslint.config.js in structure — the Expo preset replaces
// the browser/Vite pieces and brings the React Native globals and react-hooks rules with it.
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const tseslint = require("typescript-eslint");

module.exports = defineConfig([
  expoConfig,
  tseslint.configs.recommended,
  {
    // Generated from the pinned contract and never hand-edited (CONTRACT.md), so linting it
    // would only ever report on openapi-typescript's output style.
    ignores: ["src/api/generated/**", "dist/**", ".expo/**", "node_modules/**"],
  },
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      // Unused args are common in RN callback signatures; allow the conventional _ prefix.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // False positive on axios: its default export really does carry `create` and
      // `isAxiosError`, and the named-import form the rule suggests is not equivalent.
      "import/no-named-as-default-member": "off",
    },
  },
  {
    // CommonJS by necessity — this config and the jest setup are loaded by tooling that
    // requires them, so the TS-oriented import rule does not apply.
    files: ["eslint.config.js", "jest.globalSetup.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "jest.globalSetup.js"],
    languageOptions: {
      globals: { jest: "readonly", process: "readonly", module: "writable", require: "readonly" },
    },
  },
]);
