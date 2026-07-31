import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vite-plus/test'
import { defineComponent, h } from 'vue'

await vi.hoisted(async () => {
  // @ts-expect-error The checked-in UMD runtime intentionally has no TypeScript declaration.
  await import('../../../../public/runtime/host-libraries.umd.js')
})

import AppNavigation from '../../../../src/components/navigation/AppNavigation.vue'

vi.mock('@/icons', () => {
  const icon = { render: () => null }
  return {
    Icons: {
      material: { PlusFilled: icon, ShoppingBagOutlined: icon },
      other: { HomeTab: icon, SubscribeTab: icon, UserTab: icon },
    },
  }
})

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

const RouterLinkStub = defineComponent({
  inheritAttrs: false,
  props: { to: { required: true, type: String } },
  setup:
    (props, { attrs, slots }) =>
    () =>
      h('a', { ...attrs, href: props.to }, slots.default?.()),
})

const mountNavigation = (active = 'home') =>
  mount(AppNavigation, {
    props: { active },
    global: {
      stubs: {
        NIcon: defineComponent({
          setup:
            (_props, { slots }) =>
            () =>
              h('span', slots.default?.()),
        }),
        RouterLink: RouterLinkStub,
      },
    },
  })

describe('AppNavigation', () => {
  it('renders every destination and exposes the active page', () => {
    const wrapper = mountNavigation('plugin')
    const links = wrapper.findAll('.app-navigation-item')

    expect(links).toHaveLength(4)
    expect(links.map(link => link.attributes('to'))).toEqual([
      '/main/home',
      '/main/subscribe',
      '/main/plugin',
      '/main/user',
    ])
    expect(links[2]?.attributes('aria-current')).toBe('page')
    expect(links[0]?.attributes('aria-current')).toBeUndefined()
  })

  it('emits create from the emphasized center action', async () => {
    const wrapper = mountNavigation()

    await wrapper.get('.app-navigation__create').trigger('click')

    expect(wrapper.emitted('create')).toEqual([[]])
  })
})