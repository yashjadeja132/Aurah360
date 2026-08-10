import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

/**
 * Frontend lint configuration.
 *
 * Like the backend config, this starts with CORRECTNESS rules and leaves formatting alone — a first
 * run that emits thousands of style complaints gets muted or deleted, and takes the real findings
 * with it.
 *
 * The rules that earn their place here are the React ones. `react-hooks/rules-of-hooks` catches
 * conditionally-called hooks, which is a crash rather than a preference, and
 * `react-hooks/exhaustive-deps` catches stale closures over props/state — the cause of "the screen
 * shows old data until I reload", which is exactly the class of bug this app hit with cached
 * appointment lists after signing a consultation.
 */
export default [
  {
    ignores: ['node_modules/**', 'dist/**', 'build/**', 'coverage/**', '**/*.tmp.mjs'],
  },

  js.configs.recommended,

  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2023,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...reactHooks.configs.recommended.rules,

      /**
       * REQUIRED for `no-unused-vars` to be usable at all in JSX. The base rule does not know that
       * `<Button />` uses the `Button` binding, so without these two every component import reads
       * as dead — the first run of this config reported 1707 such "errors". A lint gate that cries
       * wolf 1707 times is one the team mutes, taking the genuine findings with it.
       */
      'react/jsx-uses-vars': 'error',
      'react/jsx-uses-react': 'error',

      /**
       * JSX-aware unused-vars. `varsIgnorePattern: '^[A-Z_]'` keeps imported components that are
       * used only inside JSX from being reported by parsers that do not track JSX usage, and lets a
       * deliberately-unused constant be named in caps.
       */
      'no-unused-vars': [
        'error',
        {
          args: 'after-used',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
          ignoreRestSiblings: true,
        },
      ],

      'no-undef': 'error',
      'no-unreachable': 'error',
      'no-dupe-keys': 'error',
      'no-duplicate-case': 'error',
      'no-const-assign': 'error',
      'no-self-compare': 'error',
      'no-constant-binary-expression': 'error',
      eqeqeq: ['error', 'smart'],
      'no-empty': ['error', { allowEmptyCatch: true }],

      // A stale closure over props/state is a real user-visible bug, not a style nit.
      'react-hooks/exhaustive-deps': 'warn',

      /**
       * `rules-of-hooks` stays an ERROR (inherited from recommended above) — a conditionally-called
       * hook is a crash.
       *
       * These four, new in eslint-plugin-react-hooks v7, are React-Compiler-oriented and advisory
       * rather than defect-finding. `set-state-in-effect` fires 19 times here, almost all on the
       * ordinary "sync local form state from a prop" pattern (`useEffect(() => setForm(vitals), [vitals])`).
       * That is a refactoring opinion, not a bug, and blocking CI on it would mean either 19 rushed
       * rewrites of working forms or an immediately-disabled gate. Kept visible as warnings so the
       * debt is legible; promote them once the components are deliberately migrated.
       */
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/use-memo': 'warn',

      // Fast-refresh only works when a module's exports are all components; a mixed module silently
      // full-reloads and loses state in dev. Warn, since a few shared modules legitimately mix.
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      'no-console': 'off',
    },
  },

  {
    // Node-context tooling (i18n key checker, config files).
    files: ['scripts/**/*.{js,cjs,mjs}', 'vite.config.js', 'eslint.config.js'],
    languageOptions: {
      globals: { ...globals.node, ...globals.es2023 },
    },
  },
];
