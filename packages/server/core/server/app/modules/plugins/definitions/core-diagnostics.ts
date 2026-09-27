import { defineServerPlugin } from '../../../../lib/plugin'

export default defineServerPlugin({
  manifest: {
    apiVersion: 1,
    author: 'Delta Comic',
    capabilities: ['health.read', 'runtime.describe'],
    configSchema: {
      properties: {
        includeDetails: {
          defaultValue: true,
          description: '在健康检查结果中包含静态执行器类型。',
          label: '展示运行详情',
          type: 'boolean',
        },
      },
    },
    dependencies: [],
    description: '为 server 插件系统提供基础运行时诊断能力。',
    id: 'core.diagnostics',
    name: '核心诊断',
    version: '1.0.0',
  },
  runtime: {
    async health({ config, host }) {
      const databaseReady = await host.probeDatabase()
      return {
        ...(config.includeDetails ? { details: { databaseReady, executor: 'static' } } : {}),
        message: databaseReady ? 'static plugin runtime is ready' : 'database probe failed',
        observedAt: Date.now(),
        status: databaseReady ? 'healthy' : 'unavailable',
      }
    },
  },
})