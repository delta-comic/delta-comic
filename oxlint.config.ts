import { type OxlintConfig } from 'vite-plus/lint'

export default {
  plugins: ['unicorn', 'typescript', 'oxc', 'vue'],
  categories: { correctness: 'error' },
  rules: { 'no-thenable': 'allow' },
  settings: {
    'jsx-a11y': { components: {}, attributes: {} },
    'next': { rootDir: [] },
    'jsdoc': {
      ignorePrivate: false,
      ignoreInternal: false,
      ignoreReplacesDocs: true,
      overrideReplacesDocs: true,
      augmentsExtendsReplacesDocs: false,
      implementsReplacesDocs: false,
      exemptDestructuredRootsFromChecks: false,
      tagNamePreference: {},
    },
    'vitest': { typecheck: true },
  },
  env: { builtin: true },
  globals: {},
  ignorePatterns: ['.vscode', '*.md'],
  options: { typeAware: false, typeCheck: false },
} satisfies OxlintConfig
