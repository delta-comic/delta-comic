import { defineReleaseCliConfig } from '@delta-comic/release-cli'

export const jsonVersionPaths = [
  'package.json',
  'packages/app/mobile/package.json',
  'packages/app/desktop/package.json',
  'packages/app/core/package.json',
  'packages/core/sdk/package.json',
  'packages/app/mobile/src-tauri/tauri.conf.json',
  'packages/app/desktop/src-tauri/tauri.conf.json',
  'packages/platform/db/package.json',
  'packages/platform/downloader/package.json',
  'packages/platform/http/package.json',
  'packages/core/logger/package.json',
  'packages/core/model/package.json',
  'packages/plugin/manifest/package.json',
  'packages/plugin/artifact/package.json',
  'packages/plugin/install/package.json',
  'packages/plugin/vite/package.json',
  'packages/plugin/core/package.json',
  'packages/ui/ui/package.json',
  'packages/core/utils/package.json',
] as const

export const cargoTomlVersionPaths = [
  ['packages/app/mobile/src-tauri/Cargo.toml', 'package'],
  ['packages/app/desktop/src-tauri/Cargo.toml', 'package'],
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
  'packages/*/*/package.json',
  ...cargoTomlVersionPaths.map(([path]) => path),
  'Cargo.lock',
] as const

export default defineReleaseCliConfig({
  msiConfigPath: 'packages/app/desktop/src-tauri/tauri.windows.conf.json',
  jsonVersionPaths,
  cargoTomlVersionPaths,
  cargoLockPackageNames,
  workspace: { roots: ['packages'] },
  registry: 'https://npm.pkg.github.com/',
})