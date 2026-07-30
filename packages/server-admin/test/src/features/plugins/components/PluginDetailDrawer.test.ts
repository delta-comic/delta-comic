import type {
  ServerPluginScript,
  ServerPluginScriptRun,
  ServerPluginSnapshotEntry,
} from '@delta-comic/server'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'

import PluginDetailDrawer from '../../../../../src/features/plugins/components/PluginDetailDrawer.vue'

const PassThrough = (name: string, namedSlots: string[] = []) =>
  defineComponent({
    name,
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      return () =>
        h('div', attrs, [...namedSlots.flatMap(slot => slots[slot]?.() ?? []), slots.default?.()])
    },
  })

const ButtonStub = defineComponent({
  name: 'Button',
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () => h('button', attrs, slots.default?.())
  },
})

const ModelStub = (name: string, tag = 'div') =>
  defineComponent({
    name,
    inheritAttrs: false,
    props: ['value'],
    emits: ['update:value'],
    setup(props, { attrs, slots }) {
      return () =>
        h(tag, { ...attrs, 'data-value': JSON.stringify(props.value) }, slots.default?.())
    },
  })

const stubs = {
  Alert: PassThrough('Alert'),
  Button: ButtonStub,
  Drawer: PassThrough('Drawer'),
  DrawerContent: PassThrough('DrawerContent', ['header', 'footer']),
  Empty: PassThrough('Empty'),
  Form: PassThrough('Form'),
  FormItem: PassThrough('FormItem'),
  Input: ModelStub('Input', 'textarea'),
  InputNumber: ModelStub('InputNumber'),
  List: PassThrough('List'),
  ListItem: PassThrough('ListItem'),
  Select: ModelStub('Select'),
  Space: PassThrough('Space'),
  Switch: ModelStub('Switch'),
  Tag: PassThrough('Tag'),
  Thing: PassThrough('Thing', ['description']),
}

const plugin = (id = 'reader'): ServerPluginSnapshotEntry => ({
  allowedActions: ['configure', 'disable', 'enable', 'health', 'uninstall'],
  config: { attempts: 2, mode: 'safe', name: 'Delta', scheduled: false },
  desiredState: 'enabled',
  installedVersion: '1.1.0',
  lastError: 'previous failure',
  lastHealth: { message: 'healthy now', observedAt: 1, status: 'healthy' },
  manifest: {
    apiVersion: 1,
    author: 'Delta',
    capabilities: ['reader', 'search'],
    configSchema: {
      properties: {
        attempts: { label: 'Attempts', maximum: 10, minimum: 1, type: 'number' },
        mode: {
          choices: [
            { label: 'Safe', value: 'safe' },
            { label: 'Fast', value: 'fast' },
          ],
          label: 'Mode',
          type: 'string',
        },
        name: { label: 'Name', maxLength: 20, type: 'string' },
        scheduled: { label: 'Scheduled', type: 'boolean' },
      },
    },
    dependencies: [{ id: 'database', versionRange: '^1' }, { id: 'auth' }],
    description: 'A configurable reader plugin',
    id,
    name: 'Reader',
    version: '1.2.0',
  },
  observedState: 'enabled',
  registered: true,
  updateAvailable: true,
})

const script: ServerPluginScript = {
  createdAt: 1,
  enabled: true,
  intervalHours: 4,
  nextRunAt: 4,
  pluginId: 'reader',
  source: 'return input',
  updatedAt: 2,
}

const runs: ServerPluginScriptRun[] = [
  {
    completedAt: 2,
    id: 'success',
    pluginId: 'reader',
    result: { ok: true },
    startedAt: Date.UTC(2026, 0, 1),
    status: 'succeeded',
    trigger: 'manual',
  },
  {
    completedAt: 3,
    errorMessage: 'sandbox failed',
    id: 'failure',
    pluginId: 'reader',
    startedAt: Date.UTC(2026, 0, 2),
    status: 'failed',
    trigger: 'scheduled',
  },
]

const mountDrawer = (overrides: Record<string, unknown> = {}) =>
  mount(PluginDetailDrawer, {
    global: { stubs },
    props: {
      plugin: plugin(),
      script,
      scriptPending: false,
      scriptRuns: runs,
      show: true,
      ...overrides,
    } as any,
  })

describe('PluginDetailDrawer', () => {
  it('renders details and emits each permitted lifecycle action', async () => {
    const current = plugin()
    const wrapper = mountDrawer({ plugin: current })
    expect(wrapper.text()).toContain('A configurable reader plugin')
    expect(wrapper.text()).toContain('database')
    expect(wrapper.text()).toContain('任意版本')
    expect(wrapper.text()).toContain('healthy now')
    expect(wrapper.text()).toContain('previous failure')

    for (const action of ['uninstall', 'health', 'disable', 'enable'] as const) {
      const labels = { disable: '停用', enable: '启用', health: '健康检查', uninstall: '卸载' }
      await wrapper
        .findAll('button')
        .find(button => button.text() === labels[action])!
        .trigger('click')
    }
    expect(wrapper.emitted('action')).toEqual([
      [current, 'uninstall'],
      [current, 'health'],
      [current, 'disable'],
      [current, 'enable'],
    ])
  })

  it('edits every config field type and emits an immutable configuration', async () => {
    const wrapper = mountDrawer()
    await wrapper.findAll('.plugin-detail__tabs button')[1].trigger('click')
    const select = wrapper.getComponent({ name: 'Select' })
    expect(select.props('value')).toBe('0')
    select.vm.$emit('update:value', '1')
    wrapper.getComponent({ name: 'Switch' }).vm.$emit('update:value', true)
    wrapper.getComponent({ name: 'InputNumber' }).vm.$emit('update:value', 7)
    wrapper.getComponent({ name: 'Input' }).vm.$emit('update:value', 'Updated')
    await nextTick()

    await wrapper
      .findAll('button')
      .find(button => button.text() === '保存配置')!
      .trigger('click')
    expect(wrapper.emitted('configure')).toEqual([
      ['reader', { attempts: 7, mode: 'fast', name: 'Updated', scheduled: true }],
    ])
  })

  it('saves script settings and parses valid manual input', async () => {
    const wrapper = mountDrawer()
    await wrapper.findAll('.plugin-detail__tabs button')[2].trigger('click')
    const textAreas = wrapper.findAllComponents({ name: 'Input' })
    const toggle = wrapper.getComponent({ name: 'Switch' })
    const interval = wrapper.getComponent({ name: 'InputNumber' })
    textAreas[0].vm.$emit('update:value', 'return { changed: true }')
    toggle.vm.$emit('update:value', false)
    interval.vm.$emit('update:value', 12)
    textAreas[1].vm.$emit('update:value', '{"comicId":7}')
    await nextTick()

    await wrapper
      .findAll('button')
      .find(button => button.text() === '保存代码')!
      .trigger('click')
    await wrapper
      .findAll('button')
      .find(button => button.text() === '立即运行')!
      .trigger('click')
    expect(wrapper.emitted('saveScript')).toEqual([
      ['reader', { enabled: false, intervalHours: 12, source: 'return { changed: true }' }],
    ])
    expect(wrapper.emitted('runScript')).toEqual([['reader', { comicId: 7 }]])
    expect(wrapper.text()).toContain('sandbox failed')
    expect(wrapper.text()).toContain('"ok": true')
  })

  it('falls back to raw input when manual JSON is invalid', async () => {
    const wrapper = mountDrawer()
    await wrapper.findAll('.plugin-detail__tabs button')[2].trigger('click')
    const textAreas = wrapper.findAllComponents({ name: 'Input' })
    textAreas[1].vm.$emit('update:value', 'not-json')
    await nextTick()
    await wrapper
      .findAll('button')
      .find(button => button.text() === '立即运行')!
      .trigger('click')
    expect(wrapper.emitted('runScript')).toEqual([['reader', 'not-json']])
  })

  it('resets drafts and active tab when the selected plugin changes', async () => {
    const wrapper = mountDrawer()
    await wrapper.findAll('.plugin-detail__tabs button')[2].trigger('click')
    expect(wrapper.findAll('.plugin-detail__tabs button')[2].classes()).toContain('active')

    await wrapper.setProps({
      plugin: {
        ...plugin('another'),
        config: { mode: 'fast' },
        lastError: undefined,
        lastHealth: undefined,
      },
      script: null,
      scriptRuns: [],
    })
    expect(wrapper.findAll('.plugin-detail__tabs button')[0].classes()).toContain('active')
    expect(wrapper.text()).toContain('尚未执行健康检查')
  })
})