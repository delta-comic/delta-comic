import type { PluginLocaleMessages } from '../api/i18n'

export const coreI18n: PluginLocaleMessages = {
  'zh-CN': {
    plugin: {
      core: {
        config: {
          name: '核心',
          recordHistory: '记录历史记录',
          showAiWorks: '展示 AI 作品',
          theme: { title: '外观模式', light: '浅色', dark: '深色' },
          systemDefault: '跟随系统',
          simplifiedTitle: '简化标题（实验性功能）',
          githubToken: { title: 'GitHub Token', placeholder: '仅用于提高 API 访问限额' },
          prereleaseUpdates: '接收预发布版本更新（可能不稳定）',
          cloud: {
            enabled: '启用云服务',
            serverUrl: '云服务地址',
            serverUrlPlaceholder: '启用云服务后填写服务地址',
          },
          installOverride: '安装源覆盖配置',
        },
      },
    },
  },
}