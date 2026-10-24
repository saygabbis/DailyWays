import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', '**/dist', 'supabase/.temp']),
  {
    files: ['**/*.{js,jsx}'],
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
    rules: {
      // `catch {}` / `catch (_)` vazios são intencionais (best-effort); args com `_` = ignorados de propósito; Maiúsculos são componentes usados em JSX (o core do ESLint não enxerga).
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^(_|[A-Z])', caughtErrors: 'none' }],
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
    files: ['server/**/*.{js,mjs,cjs}', 'scripts/**/*.{js,mjs,cjs}', 'packages/**/*.{js,mjs,cjs}', '*.config.{js,cjs,mjs}'],
    languageOptions: { globals: { ...globals.node } },
  },
])
