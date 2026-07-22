import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vite-plus/test'

await vi.hoisted(async () => {
  const vueRuntimePath = '../../../node_modules/vue/dist/vue.esm-bundler.js'
  const Vue = (await import(/* @vite-ignore */ vueRuntimePath)) as typeof import('vue')
  const { defineComponent, h } = Vue
  const Alert = defineComponent({
    name: 'NAlert',
    setup:
      (_props, { slots }) =>
      () =>
        h('section', slots.default?.()),
  })
  const Button = defineComponent({
    name: 'NButton',
    emits: ['click'],
    setup:
      (_props, { emit, slots }) =>
      () =>
        h('button', { onClick: () => emit('click') }, slots.default?.()),
  })
  const Icon = defineComponent({
    name: 'NIcon',
    setup:
      (_props, { slots }) =>
      () =>
        h('span', slots.default?.()),
  })
  window.$$lib$$ = {
    ...window.$$lib$$,
    Naive: { NAlert: Alert, NButton: Button, NIcon: Icon },
    Vue,
  } as typeof window.$$lib$$
})

vi.mock('@/icons', async () => {
  const { defineComponent } = await import('vue')
  const EmptyIcon = defineComponent({ name: 'EmptyIcon', template: '<i />' })
  return { Icons: { antd: { CloudSyncOutlined: EmptyIcon }, material: { CheckRound: EmptyIcon } } }
})

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

import type { SourceRefreshWarning } from '@/features/downloads/sourceRefresh'

import DownloadSourceRefreshWarnings from './DownloadSourceRefreshWarnings.vue'

const warning = (
  status: SourceRefreshWarning['status'],
  overrides: Partial<SourceRefreshWarning> = {},
): SourceRefreshWarning => ({
  collectionTitle: 'Example collection',
  status,
  taskId: 'task-1',
  taskTitle: 'Episode 1',
  ...overrides,
})

describe('DownloadSourceRefreshWarnings', () => {
  it('lists plugin changes and requires an explicit confirmation', async () => {
    const changes = [
      { code: 'plugin-version-changed', current: '2.0.0', recorded: '1.0.0' },
      { code: 'provider-fingerprint-changed', current: 'sha256:new', recorded: 'sha256:old' },
    ] as const
    const wrapper = mount(DownloadSourceRefreshWarnings, {
      props: { warnings: [warning('confirmation-required', { changes: [...changes] })] },
    })

    expect(wrapper.text()).toContain('Example collection')
    expect(wrapper.text()).toContain('download.sourceRefresh.changes.plugin-version-changed')
    expect(wrapper.text()).toContain('download.sourceRefresh.changes.provider-fingerprint-changed')
    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('confirm')).toEqual([['task-1']])
    expect(wrapper.emitted('retry')).toBeUndefined()
  })

  it('offers retry for a transient reconstruction failure', async () => {
    const wrapper = mount(DownloadSourceRefreshWarnings, {
      props: { warnings: [warning('content-page-construction-failed')] },
    })

    expect(wrapper.text()).toContain(
      'download.sourceRefresh.statuses.content-page-construction-failed',
    )
    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('retry')).toEqual([['task-1']])
    expect(wrapper.emitted('confirm')).toBeUndefined()
  })

  it('does not expose a bypass for a rebuilt page identity mismatch', () => {
    const wrapper = mount(DownloadSourceRefreshWarnings, {
      props: { warnings: [warning('content-page-identity-mismatch')] },
    })

    expect(wrapper.text()).toContain(
      'download.sourceRefresh.statuses.content-page-identity-mismatch',
    )
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('uses wrapping responsive containers so long warning text cannot force overflow', () => {
    const wrapper = mount(DownloadSourceRefreshWarnings, {
      props: { warnings: [warning('confirmation-required')] },
    })

    expect(wrapper.get('.sm\\:flex-nowrap').classes()).toContain('flex-wrap')
    expect(wrapper.get('.sm\\:w-auto').classes()).toContain('w-full')
  })
})