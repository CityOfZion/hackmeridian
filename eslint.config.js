// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: ['dist/*', 'src/uniwind-types.d.ts'],
  },
  {
    rules: {
      // Apostrophes and quotes are plain text in React Native; only flag likely JSX typos.
      'react/no-unescaped-entities': ['error', { forbid: ['>', '}'] }],
    },
  },
]);
