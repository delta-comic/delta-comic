import { defineReleaseCliConfig } from '@delta-comic/release-cli'

export const jsonVersionPaths = [
  'package.json',
  'packages/client/app/mobile/package.json',
  'packages/client/app/desktop/package.json',
  'packages/client/app/core/package.json',
  'packages/client/core/sdk/package.json',
  'packages/client/app/mobile/src-tauri/tauri.conf.json',
  'packages/client/app/desktop/src-tauri/tauri.conf.json',
  'packages/client/data/db/package.json',
  'packages/client/platform/downloader/package.json',
  'packages/client/platform/http/package.json',
  'packages/shared/core/logger/package.json',
  'packages/client/core/model/package.json',
  'packages/shared/plugin/manifest/package.json',
  'packages/client/core/plugin-artifact/package.json',
  'packages/client/core/plugin-install/package.json',
  'packages/client/core/plugin-vite/package.json',
  'packages/client/core/plugin/package.json',
  'packages/server/core/server/package.json',
  'packages/shared/core/both/package.json',
  'packages/client/ui/ui/package.json',
  'packages/client/core/utils/package.json',
] as const

export const cargoTomlVersionPaths = [
  ['packages/client/app/mobile/src-tauri/Cargo.toml', 'package'],
  ['packages/client/app/desktop/src-tauri/Cargo.toml', 'package'],
  ['Cargo.toml', 'workspace.package'],
] as const

export const cargoLockPackageNames = [
  'delta-comic-mobile',
  'delta-comic-desktop',
  'delta-comic-native',
  'tauri-plugin-db',
  'tauri-plugin-downloader',
  'tauri-plugin-http',
  'tauri-plugin-logger',
  'tauri-plugin-plugin',
  'tauri-plugin-utils',
] as const

export const versionAssetPaths = [
  ...jsonVersionPaths,
  'packages/*/*/*/package.json',
  ...cargoTomlVersionPaths.map(([path]) => path),
  'Cargo.lock',
] as const

export default defineReleaseCliConfig({
  msiConfigPath: 'packages/client/app/desktop/src-tauri/tauri.windows.conf.json',
  jsonVersionPaths,
  cargoTomlVersionPaths,
  cargoLockPackageNames,
  workspace: { roots: ['packages'] },
  registry: 'https://npm.pkg.github.com/',
})