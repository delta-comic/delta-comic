import { UserConfig } from '@commitlint/types'
export default {
  extends: ['@commitlint/config-conventional'],
  plugins: ['commitlint-plugin-cspell'],
  rules: {
    'cspell/type': [2, 'always'],
    'cspell/scope': [2, 'always'],
    'cspell/subject': [2, 'always'],
    'cspell/header': [2, 'always'],
    'cspell/body': [2, 'always'],
    'cspell/footer': [2, 'always']
  }
} as UserConfig