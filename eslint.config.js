// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");
const globals = require('globals');

module.exports = defineConfig([
  expoConfig,
  {
    files: ['scripts/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      // Los harnesses corren en Node, no en el runtime React Native de Expo.
      globals: globals.node,
    },
  },
  {
    ignores: ["dist/*"],
  }
]);
