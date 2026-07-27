import { mount } from '@vue/test-utils'
import { useThemeVars } from 'naive-ui'
import { describe, expect, it, vi } from 'vite-plus/test'
import { defineComponent, h } from 'vue'

import DcConfigProvider from '../DcConfigProvider.vue'

import { useDcConfig } from './context'

vi.mock('naive-ui', async importOriginal => ({
  ...(await importOriginal<typeof import('naive-ui')>()),
  useThemeVars: vi.fn(),
}))

const mockedUseThemeVars = vi.mocked(useThemeVars)

const ConfigConsumer = defineComponent({
  name: 'ConfigConsumer',
  setup() {
    const config = useDcConfig()
    return () =>
      h('output', {
        'data-accent': config.style.value['--dc-accent'],
        'data-locale': config.locale.value,
        'data-primary': config.style.value['--nui-primary-color'],
        'data-theme': config.theme.value,
      })
  },
})

describe('DcConfigProvider', () => {
  it('bridges Naive UI theme variables and exposes root configuration', () => {
    mockedUseThemeVars.mockReturnValue({
      value: { fontSize12: '12px', primaryColor: '#234567' },
    } as unknown as ReturnType<typeof useThemeVars>)

    const wrapper = mount(DcConfigProvider, {
      props: { locale: 'zh-CN', style: { '--dc-accent': '#fb7299' }, theme: 'dark' },
      slots: { default: () => h(ConfigConsumer) },
    })

    expect(wrapper.attributes()).toMatchObject({ 'data-dc-theme': 'dark', 'lang': 'zh-CN' })
    expect(wrapper.attributes('style')).toContain('--nui-primary-color: #234567')
    expect(wrapper.attributes('style')).toContain('--nui-font-size-12: 12px')
    expect(wrapper.get('output').attributes()).toMatchObject({
      'data-accent': '#fb7299',
      'data-locale': 'zh-CN',
      'data-primary': '#234567',
      'data-theme': 'dark',
    })
  })

  it('inherits parent values and lets nested providers override them', () => {
    mockedUseThemeVars.mockReturnValue({ value: {} } as unknown as ReturnType<typeof useThemeVars>)

    const wrapper = mount(DcConfigProvider, {
      props: { locale: 'en-US', style: { '--dc-accent': 'parent' }, theme: 'light' },
      slots: {
        default: () =>
          h(
            DcConfigProvider,
            { locale: 'zh-TW', style: { '--dc-accent': 'child' } },
            { default: () => h(ConfigConsumer) },
          ),
      },
    })

    expect(wrapper.get('output').attributes()).toMatchObject({
      'data-accent': 'child',
      'data-locale': 'zh-TW',
      'data-theme': 'light',
    })
  })
})