import { defineReleaseCliConfig } from './script/manager/src/config.mts'
import {
  cargoLockPackageNames,
  cargoTomlVersionPaths,
  jsonVersionPaths,
} from './script/manager/src/set-version.mts'

export default defineReleaseCliConfig({
  msiConfigPath: 'packages/client/app/desktop/src-tauri/tauri.windows.conf.json',
  jsonVersionPaths,
  cargoTomlVersionPaths,
  cargoLockPackageNames,
  workspace: { roots: ['packages'] },
  registry: 'https://npm.pkg.github.com/',
})