import { ConfigPointer } from '../../configPointer'

export const coreConfig = new ConfigPointer(
  'core',
  {
    recordHistory: { type: 'switch', defaultValue: true, info: 'settings.core.recordHistory' },
    showAIProject: { type: 'switch', defaultValue: true, info: 'settings.core.showAiWorks' },
    darkMode: {
      type: 'radio',
      defaultValue: 'system',
      info: 'settings.core.theme.title',
      comp: 'select',
      selects: [
        { label: 'settings.core.theme.light', value: 'light' },
        { label: 'settings.core.theme.dark', value: 'dark' },
        { label: 'settings.core.systemDefault', value: 'system' },
      ],
    },
    language: {
      type: 'radio',
      defaultValue: 'system',
      info: 'settings.core.language.title',
      comp: 'select',
      selects: [
        { label: 'settings.core.language.zhCN', value: 'zh-CN' },
        { label: 'settings.core.language.zhTW', value: 'zh-TW' },
        { label: 'settings.core.language.enUS', value: 'en-US' },
        { label: 'settings.core.systemDefault', value: 'system' },
      ],
    },
    easilyTitle: { type: 'switch', defaultValue: false, info: 'settings.core.simplifiedTitle' },
    githubToken: {
      type: 'string',
      defaultValue: '',
      info: 'settings.core.githubToken.title',
      placeholder: 'settings.core.githubToken.placeholder',
    },
    receivePerReleaseUpdate: {
      type: 'switch',
      defaultValue: false,
      info: 'settings.core.prereleaseUpdates',
    },
    cloudEnabled: { type: 'switch', defaultValue: false, info: 'settings.core.cloud.enabled' },
    cloudServerUrl: {
      type: 'string',
      defaultValue: '',
      info: 'settings.core.cloud.serverUrl',
      placeholder: 'settings.core.cloud.serverUrlPlaceholder',
    },
    installOverride: {
      type: 'pairs',
      defaultValue: [],
      info: 'settings.core.installOverride',
      required: true,
    },
  },
  'settings.core.title',
)