import { defineInnerPlugin } from '@/plugin'

export default defineInnerPlugin(() => ({
  meta: {
    kind: 'preboot',
    author: 'wenxig',
    description: '核心',
    require: [],
    entry: { jsPath: 'index.js' },
    name: { display: '核心', id: 'core' },
    version: { plugin: '0.0.1', supportCore: '0.0.1' },
  },
  config: () => ({ features: { core: { enable: true } } }) as any,
}))