import { createDevPlugin } from './vite-dev'
import { modulePlugin, type ModulePluginOptions } from './vite-modules'
export { modulePlugin, type ModulePluginOptions }
export const deltaComic = (options: ModulePluginOptions) => [
  modulePlugin(options),
  createDevPlugin(options),
]