const nextPlugin = require('@next/eslint-plugin-next');
const reactPlugin = require('eslint-plugin-react');
const hooksPlugin = require('eslint-plugin-react-hooks');

module.exports = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      '*.bak',
      '**/*.bak',
      'dist/**',
      'build/**',
      'public/audio-worklets/**',
      '.claude/**',
    ],
  },
  {
    plugins: {
      react: reactPlugin,
      'react-hooks': hooksPlugin,
      '@next/next': nextPlugin,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...hooksPlugin.configs.recommended.rules,

      // Turn off rules that are already handled (or not needed)
      'react/no-unescaped-entities': 'off',
      'react-hooks/exhaustive-deps': 'warn',
      'jsx-a11y/alt-text': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',

      // React 19 new strict rules — disable ones that cause false positives
      // on existing working code
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/static-components': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/refs': 'warn',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
];
