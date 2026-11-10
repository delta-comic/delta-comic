import { ConfigPointer } from '../api/config'

import { pluginName } from './env'

export const cfg = new ConfigPointer(
  pluginName,
  {
    recordHistory: {
      type: 'switch',
      defaultValue: Boolean(true),
      info: 'plugin.core.config.recordHistory',
    },
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
    easilyTitle: {
      type: 'switch',
      defaultValue: Boolean(false),
      info: 'plugin.core.config.simplifiedTitle',
    },
    githubToken: {
      type: 'string',
      defaultValue: String(''),
      info: 'plugin.core.config.githubToken.title',
      placeholder: 'plugin.core.config.githubToken.placeholder',
    },
    receivePerReleaseUpdate: {
      type: 'switch',
      defaultValue: Boolean(false),
      info: 'plugin.core.config.prereleaseUpdates',
    },
    installOverride: {
      type: 'pairs',
      defaultValue: new Array(),
      info: 'plugin.core.config.installOverride',
      required: true,
    },
  },
  'plugin.core.config.name',
)