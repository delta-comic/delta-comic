import tsParser from '@typescript-eslint/parser'
import vue from 'eslint-plugin-vue'
import { globalIgnores } from 'eslint/config'
import vueParser from 'vue-eslint-parser'

const vueParserOptions = {
  parser: tsParser,
  extraFileExtensions: ['.vue'],
  ecmaVersion: 'latest',
  sourceType: 'module',
}

const vueLintConfig = files => [
  ...vue.configs['flat/essential'].map(config => ({ ...config, files })),
  { files, languageOptions: { parser: vueParser, parserOptions: vueParserOptions } },
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
  ...vueLintConfig(['packages/client/app/mobile/**/*.vue']),
  ...vueLintConfig(['packages/client/app/desktop/**/*.vue']),
  ...vueLintConfig(['packages/client/ui/ui/**/*.vue']),
  ...vueLintConfig(['packages/server/admin/panel/**/*.vue']),
]