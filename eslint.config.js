const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const globals = require('globals');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/**', 'coverage/**', '.expo/**', 'audit-report.json'] },
  { files: ['tests/**/*.{js,ts,tsx}'], languageOptions: { globals: globals.jest } },
]);
