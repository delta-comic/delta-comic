import { defineServerPlugin } from '../../../../lib/plugin'

export default defineServerPlugin({
  manifest: {
    apiVersion: 1,
    author: 'Delta Comic',
    capabilities: ['sync.metrics.read'],
    configSchema: {
      properties: {
        warningBacklog: {
          defaultValue: 1000,
          description: '同步积压超过此数量时由观测模块发出提示。',
          label: '积压告警阈值',
          maximum: 1_000_000,
          minimum: 1,
          type: 'number',
        },
      },
    },
    dependencies: [{ id: 'core.diagnostics', versionRange: '^1.0.0' }],
    description: '提供同步服务的插件化观测入口。',
    id: 'sync.observer',
    name: '同步观测',
    version: '1.0.0',
  },
  runtime: {
    async health({ config, host }) {
      const cursorBacklog = await host.readMetric('sync.cursorBacklog')
      const warningBacklog = Number(config.warningBacklog ?? 1000)
      const degraded = cursorBacklog > warningBacklog
      return {
        details: { cursorBacklog, warningBacklog },
        message: degraded ? 'sync cursor backlog exceeds threshold' : 'sync observer is ready',
        observedAt: Date.now(),
        status: degraded ? 'degraded' : 'healthy',
      }
    },
  },
})