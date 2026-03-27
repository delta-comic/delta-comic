import { defineConfig } from 'vite-plus'

export default defineConfig({
  staged: {
    '*': 'vp check --fix',
    '*.{md,json,toml,rs,js,jsx,ts,tsx,mts,cts,mjs,cjs,vue,html}':
      'vp exec cspell --no-exit-code --no-must-find-files'
  },
  fmt: {
    ignorePatterns: ['*.md', 'components.d.ts', 'src-tauri/**/*', 'typed-router.d.ts'],
    endOfLine: 'lf',
    semi: false,
    useTabs: false,
    printWidth: 100,
    tabWidth: 2,
    singleQuote: true,
    trailingComma: 'none',
    sortPackageJson: { sortScripts: true },
    arrowParens: 'avoid',
    jsxSingleQuote: true,
    singleAttributePerLine: false,
    vueIndentScriptAndStyle: false,
    sortTailwindcss: {
      preserveDuplicates: false,
      preserveWhitespace: false,
      stylesheet: './packages/app/src/index.css',
      attributes: ['overlayClass', ':class', 'Class'],
      functions: ['twMerge']
    },
    bracketSameLine: false,
    bracketSpacing: true,
    embeddedLanguageFormatting: 'auto',
    insertFinalNewline: false,
    proseWrap: 'preserve',
    htmlWhitespaceSensitivity: 'css',
    objectWrap: 'collapse',
    quoteProps: 'consistent',
    sortImports: {
      groups: [
        ['builtin'],
        ['external', 'type-external'],
        ['internal', 'type-internal'],
        ['parent', 'type-parent'],
        ['sibling', 'type-sibling'],
        ['index', 'type-index']
      ]
    }
  },
  lint: {
    plugins: ['unicorn', 'typescript', 'oxc', 'vue'],
    categories: { correctness: 'warn' },
    rules: {
      'no-unused-expressions': 'allow',
      'no-useless-escape': 'allow',
      'no-non-null-asserted-optional-chain': 'allow',
      'no-thenable': 'allow',
      'tsconfig-error': 'allow'
    },
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
        tagNamePreference: {}
      },
      'vitest': { typecheck: false }
    },
    env: { builtin: true },
    globals: {},
    ignorePatterns: ['.vscode', './package.json'],
    options: { typeAware: false, typeCheck: false }
  },
  run: {
    tasks: { 'npm-build': { command: 'vp run build -r', env: ['NODE_ENV'], cache: true } },
    cache: { tasks: true, scripts: true }
  }
})