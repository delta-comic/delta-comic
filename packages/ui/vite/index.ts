import type { ComponentResolver } from 'unplugin-vue-components'

import { name as pkgName } from '../package.json'

export function DeltaComicUiResolver(): ComponentResolver {
  return {
    type: 'component',
    resolve: (name: string) => {
      if (name.match(/^(Dc[A-Z]|dc-[a-z])/)) return { name, from: pkgName }
      return
    },
  }
}