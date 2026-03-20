import type { ComponentResolver } from 'unplugin-vue-components'

export function DeltaComicUiResolver(): ComponentResolver {
  return {
    type: 'component',
    resolve: (name: string) => {
      if (name.match(/^(Dc[A-Z]|dc-[a-z])/)) return { name, from: '@delta-comic/ui' }
    }
  }
}