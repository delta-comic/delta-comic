import { ConfigPointer } from '../api/config'

import { pluginName } from './env'

export const cfg = new ConfigPointer(
  pluginName,
  {
    recordHistory: { type: 'switch', defaultValue: true, info: 'plugin.core.config.recordHistory' },
    showAIProject: { type: 'switch', defaultValue: true, info: 'plugin.core.config.showAiWorks' },
    darkMode: {
      type: 'radio',
      defaultValue: 'system',
      info: 'plugin.core.config.theme.title',
      comp: 'select',
      selects: [
        { label: 'plugin.core.config.theme.light', value: 'light' },
        { label: 'plugin.core.config.theme.dark', value: 'dark' },
        { label: 'plugin.core.config.systemDefault', value: 'system' },
      ],
    },
    language: {
      type: 'radio',
      defaultValue: 'system',
      info: 'plugin.core.config.language.title',
      comp: 'select',
      selects: [
        { label: 'plugin.core.config.language.zhCN', value: 'zh-CN' },
        { label: 'plugin.core.config.language.zhTW', value: 'zh-TW' },
        { label: 'plugin.core.config.language.enUS', value: 'en-US' },
        { label: 'plugin.core.config.systemDefault', value: 'system' },
      ],
    },
    easilyTitle: {
      type: 'switch',
      defaultValue: false,
      info: 'plugin.core.config.simplifiedTitle',
    },
    githubToken: {
      type: 'string',
      defaultValue: '',
      info: 'plugin.core.config.githubToken.title',
      placeholder: 'plugin.core.config.githubToken.placeholder',
    },
    receivePerReleaseUpdate: {
      type: 'switch',
      defaultValue: false,
      info: 'plugin.core.config.prereleaseUpdates',
    },
    cloudEnabled: { type: 'switch', defaultValue: false, info: 'plugin.core.config.cloud.enabled' },
    cloudServerUrl: {
      type: 'string',
      defaultValue: '',
      info: 'plugin.core.config.cloud.serverUrl',
      placeholder: 'plugin.core.config.cloud.serverUrlPlaceholder',
    },
    installOverride: {
      type: 'pairs',
      defaultValue: [],
      info: 'plugin.core.config.installOverride',
      required: true,
    },
  },
  'plugin.core.config.name',
)