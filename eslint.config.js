import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  { ignores: ['dist', 'build', 'node_modules', '.yarn', '.pnp.*'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // Match the strictness of the previous CRA `react-app` config: enforce the
      // Rules of Hooks, warn on exhaustive-deps. We intentionally do NOT adopt
      // eslint-plugin-react-hooks v7's full "recommended" set (refs,
      // set-state-in-effect, etc.) — those flag pre-existing patterns and a
      // build-tool migration is the wrong place to land a behavioural refactor.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // CRA's `react-app` config treated unused vars as a warning, not a build
      // failure. Preserve that so the migration doesn't turn pre-existing
      // dead-code into a lint gate.
      '@typescript-eslint/no-unused-vars': 'warn',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
);
