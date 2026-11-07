import { defineReleaseCliConfig } from '@delta-comic/release-cli'

export const jsonVersionPaths = [
  'package.json',
  'packages/client/mobile/package.json',
  'packages/client/desktop/package.json',
  'packages/client/app-core/package.json',
  'packages/client/sdk/package.json',
  'packages/client/mobile/src-tauri/tauri.conf.json',
  'packages/client/desktop/src-tauri/tauri.conf.json',
  'packages/client/db/package.json',
  'packages/client/downloader/package.json',
  'packages/client/http/package.json',
  'packages/shared/logger/package.json',
  'packages/client/model/package.json',
  'packages/shared/manifest/package.json',
  'packages/client/plugin-artifact/package.json',
  'packages/client/plugin-install/package.json',
  'packages/client/plugin-vite/package.json',
  'packages/client/plugin/package.json',
  'packages/shared/both/package.json',
  'packages/client/ui/package.json',
  'packages/client/utils/package.json',
] as const

export const cargoTomlVersionPaths = [
  ['packages/client/mobile/src-tauri/Cargo.toml', 'package'],
  ['packages/client/desktop/src-tauri/Cargo.toml', 'package'],
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
  msiConfigPath: 'packages/client/desktop/src-tauri/tauri.windows.conf.json',
  jsonVersionPaths,
  cargoTomlVersionPaths,
  cargoLockPackageNames,
  workspace: { roots: ['packages'] },
  registry: 'https://npm.pkg.github.com/',
})