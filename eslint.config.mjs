import tsParser from '@typescript-eslint/parser'
import betterTailwindcss from 'eslint-plugin-better-tailwindcss'
import vue from 'eslint-plugin-vue'
import { globalIgnores } from 'eslint/config'
import vueParser from 'vue-eslint-parser'

const betterTailwindRules = Object.fromEntries(
  [
    'no-unknown-classes',
    'no-conflicting-classes',
    'no-duplicate-classes',
    'no-deprecated-classes',
  ].map(rule => [`better-tailwindcss/${rule}`, 'error']),
)

const vueParserOptions = {
  parser: tsParser,
  extraFileExtensions: ['.vue'],
  ecmaVersion: 'latest',
  sourceType: 'module',
}

const vueLintConfig = (files, entryPoint) => [
  ...vue.configs['flat/essential'].map(config => ({ ...config, files })),
  {
    files,
    languageOptions: { parser: vueParser, parserOptions: vueParserOptions },
    settings: { 'better-tailwindcss': { entryPoint } },
    ...betterTailwindcss.configs['recommended-error'],
    rules: betterTailwindRules,
  },
]

export default [
  globalIgnores([
    '.agents/**',
    '.vscode/**',
    '**/node_modules/**',
    '**/dist/**',
    '**/public/runtime/**',
    '**/components.d.ts',
    '**/typed-router.d.ts',
    '**/worker-configuration.d.ts',
  ]),
  ...vueLintConfig(
    ['packages/client/app/mobile/**/*.vue'],
    'packages/client/app/mobile/src/index.css',
  ),
  ...vueLintConfig(
    ['packages/client/app/desktop/**/*.vue'],
    'packages/client/app/desktop/src/index.css',
  ),
  ...vueLintConfig(['packages/client/ui/ui/**/*.vue'], 'packages/client/ui/ui/src/index.css'),
  ...vueLintConfig(
    ['packages/server/admin/panel/**/*.vue'],
    'packages/server/admin/panel/src/index.css',
  ),
]