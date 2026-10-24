import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import react from 'eslint-plugin-react'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', '**/dist', 'dist-e2e', 'e2e/out', 'supabase/.temp']),
  {
    files: ['**/*.{js,jsx,mjs}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: { react },
    rules: {
      // Faz o ESLint enxergar uso de variáveis dentro do JSX (<Icon />), então nomes Maiúsculos
      // não precisam mais de exceção: componente/ícone importado e não usado agora é acusado.
      'react/jsx-uses-vars': 'error',
      // Componente usado no JSX sem estar declarado/importado (o no-undef do core não vê JSX).
      'react/jsx-no-undef': 'error',
      // `catch {}` / `catch (_)` vazios são intencionais (best-effort); args/vars com `_` = ignorados de propósito.
      'no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      // Regras de "prontidão pro React Compiler" (o projeto não usa o compiler): ficam como aviso
      // para guiar refactors, sem bloquear. rules-of-hooks/purity/immutability continuam como erro.
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-refresh/only-export-components': 'warn',
    },
  },
  {
    // Código que roda no Node (servidor collab, scripts, pacotes compartilhados).
    files: ['server/**/*.{js,mjs,cjs}', 'scripts/**/*.{js,mjs,cjs}', 'packages/**/*.{js,mjs,cjs}', 'e2e/**/*.{js,mjs}', 'supabase/tests/**/*.js', '*.config.{js,cjs,mjs}'],
    languageOptions: { globals: { ...globals.node } },
  },
])
