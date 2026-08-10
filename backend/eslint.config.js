import js from '@eslint/js';
import globals from 'globals';

/**
 * Backend lint configuration.
 *
 * The `lint` script was an `echo` stub, so nothing was ever checked. This config deliberately
 * starts with CORRECTNESS rules only — the class of thing that is a bug, not a preference:
 * undefined identifiers, unused bindings, unreachable code, duplicate keys, shadowed declarations.
 *
 * Style is left out on purpose. A first lint run that emits two thousand quote-and-spacing
 * complaints gets added to CI, immediately drowns the real findings, and is then ignored or
 * disabled within a week. Formatting can be layered on later (Prettier) as a separate, mechanical
 * change; it should not be the reason this gate fails to land.
 *
 * These rules are not hypothetical here. `no-undef` catches exactly the failure that shipped
 * during the queue refactor — functions were deleted while a default export still referenced them,
 * which `node --check` cannot see because it only parses. `no-unused-vars` catches the mirror case:
 * a value computed and then never applied, which is how several settings in this codebase came to
 * be stored but never read.
 */
export default [
  {
    ignores: [
      'node_modules/**',
      'coverage/**',
      'uploads/**',
      'logs/**',
      'dist/**',
      // Throwaway diagnostic scripts; also gitignored.
      '**/*.tmp.mjs',
      '**/*-tmp.mjs',
    ],
  },

  js.configs.recommended,

  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2023,
      },
    },
    rules: {
      /**
       * `argsIgnorePattern: '^_'` matters for Express: an error handler MUST keep its 4-arity
       * signature `(err, req, res, next)` to be recognised as one, so `next` is often
       * deliberately unused and is named `_next`. `caughtErrors: 'none'` allows `catch {}` blocks
       * that intentionally swallow — this codebase has several, each with a comment saying why.
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

      // Real-bug rules, on as errors.
      'no-undef': 'error',
      'no-unreachable': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-class-members': 'error',
      'no-duplicate-case': 'error',
      'no-const-assign': 'error',
      'no-self-compare': 'error',
      'no-unmodified-loop-condition': 'error',
      'no-constant-binary-expression': 'error',
      'no-promise-executor-return': 'error',
      /**
       * OFF, deliberately. Every occurrence in this codebase is the same false positive: a property
       * assigned on a PER-REQUEST object (`req.ownDoctorId`, `req.user`, `req.breakGlassAccess`)
       * after an await. `req` is not shared between requests, so there is no interleaving to race —
       * and the rule cannot know that. Satisfying it would mean abandoning per-request memoisation
       * or wrapping correct code in ten inline disables, both of which make the code worse than the
       * warning is worth. Revisit if genuinely shared mutable state is ever introduced.
       */
      'require-atomic-updates': 'off',
      'no-await-in-loop': 'off', // sequential awaits are deliberate in several batch scripts
      'no-shadow': 'error',
      eqeqeq: ['error', 'smart'],

      /**
       * `await` inside a loop is fine; a FLOATING promise is not — an un-awaited write can outlive
       * the request and fail silently. Cannot be fully caught without type information, but the
       * obvious cases are worth flagging.
       */
      'no-async-promise-executor': 'error',

      // Deliberately not errors: console is used by scripts and the logger fallback.
      'no-console': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },

  {
    // Test files get the same correctness rules; Vitest globals are imported explicitly in this
    // codebase (no `globals: true`), so only Node globals are needed.
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: { ...globals.node, ...globals.es2023 },
    },
    rules: {
      // Fixtures legitimately build objects that are asserted on rather than used.
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
    },
  },
];
