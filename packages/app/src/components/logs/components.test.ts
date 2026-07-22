import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vite-plus/test'

await vi.hoisted(async () => {
  const vueRuntimePath = '../../../node_modules/vue/dist/vue.esm-bundler.js'
  const Vue = (await import(/* @vite-ignore */ vueRuntimePath)) as typeof import('vue')
  const { defineComponent, h } = Vue
  const Button = defineComponent({
    name: 'NButton',
    inheritAttrs: false,
    props: { disabled: Boolean, loading: Boolean },
    emits: ['click'],
    setup:
      (props, { attrs, emit, slots }) =>
      () =>
        h(
          'button',
          {
            ...attrs,
            'data-loading': String(props.loading),
            'disabled': props.disabled,
            'onClick': () => emit('click'),
          },
          slots.default?.(),
        ),
  })
  const Alert = defineComponent({
    name: 'NAlert',
    props: { title: String },
    setup:
      (props, { slots }) =>
      () =>
        h('div', [props.title, slots.default?.()]),
  })
  const Input = defineComponent({
    name: 'NInput',
    inheritAttrs: false,
    props: { value: String },
    emits: ['update:value'],
    setup:
      (props, { attrs, emit }) =>
      () =>
        h('input', {
          ...attrs,
          value: props.value,
          onInput: (event: Event) => emit('update:value', (event.target as HTMLInputElement).value),
        }),
  })
  const Select = defineComponent({
    name: 'NSelect',
    inheritAttrs: false,
    props: { options: Array, value: String },
    emits: ['update:value'],
    setup:
      (props, { attrs, emit }) =>
      () =>
        h(
          'select',
          {
            ...attrs,
            value: props.value,
            onChange: (event: Event) =>
              emit('update:value', (event.target as HTMLSelectElement).value),
          },
          (props.options as Array<{ label: string; value: string }>).map(option =>
            h('option', { value: option.value }, option.label),
          ),
        ),
  })
  const Empty = defineComponent({
    name: 'NEmpty',
    props: { description: String },
    setup: props => () => h('div', { class: 'empty' }, props.description),
  })
  const Spin = defineComponent({
    name: 'NSpin',
    props: { show: Boolean },
    setup:
      (props, { slots }) =>
      () =>
        h('div', { 'data-loading': String(props.show) }, slots.default?.()),
  })

  window.$$lib$$ = {
    ...window.$$lib$$,
    Naive: {
      NAlert: Alert,
      NButton: Button,
      NEmpty: Empty,
      NInput: Input,
      NSelect: Select,
      NSpin: Spin,
    },
    Vue,
  } as typeof window.$$lib$$
})

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ locale: { value: 'en-US' }, t: (key: string) => key }),
}))

import LogContentViewer from './LogContentViewer.vue'
import LogFileList from './LogFileList.vue'
import LogReaderPanel from './LogReaderPanel.vue'
import LogToolbar from './LogToolbar.vue'

describe('LogReaderPanel', () => {
  it('offers an explicit close action', async () => {
    const wrapper = mount(LogReaderPanel)
    await wrapper.get('header button').trigger('click')
    expect(wrapper.emitted('close')).toEqual([[]])
  })
})

describe('LogToolbar', () => {
  it('emits filter updates and action events', async () => {
    const wrapper = mount(LogToolbar, {
      props: { exporting: false, level: 'all', loading: false, scopeQuery: '' },
    })

    await wrapper.get('select').setValue('error')
    await wrapper.get('input').setValue('sync')
    const buttons = wrapper.findAll('button')
    await buttons[0].trigger('click')
    await buttons[1].trigger('click')

    expect(wrapper.emitted('update:level')).toEqual([['error']])
    expect(wrapper.emitted('update:scopeQuery')).toEqual([['sync']])
    expect(wrapper.emitted('refresh')).toEqual([[]])
    expect(wrapper.emitted('export')).toEqual([[]])
  })

  it('disables only export when there are no files', () => {
    const wrapper = mount(LogToolbar, {
      props: {
        exportDisabled: true,
        exporting: false,
        level: 'all',
        loading: false,
        scopeQuery: '',
      },
    })

    const buttons = wrapper.findAll('button')
    expect(buttons[0].attributes('disabled')).toBeUndefined()
    expect(buttons[1].attributes('disabled')).toBeDefined()
  })
})

describe('LogFileList', () => {
  it('renders metadata and emits the selected path', async () => {
    const wrapper = mount(LogFileList, {
      props: {
        files: [
          {
            archived: true,
            modifiedAt: Date.UTC(2026, 6, 22, 10),
            name: '2026-06.log.gz',
            path: '/logs/2026-06.log.gz',
            size: 1536,
          },
        ],
        loading: false,
        selectedPath: '/logs/2026-06.log.gz',
      },
    })

    expect(wrapper.text()).toContain('2026-06.log.gz')
    expect(wrapper.text()).toContain('1.5 KB')
    expect(wrapper.text()).toContain('settings.logs.files.archived')
    expect(wrapper.get('button').attributes('aria-current')).toBe('true')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('select')).toEqual([['/logs/2026-06.log.gz']])
  })

  it('renders an empty state', () => {
    const wrapper = mount(LogFileList, { props: { files: [], loading: false } })
    expect(wrapper.text()).toContain('settings.logs.files.empty')
  })
})

describe('LogContentViewer', () => {
  it('renders log content as selectable plain text and the truncation notice', () => {
    const content = '<script>alert("safe")</script>'
    const wrapper = mount(LogContentViewer, {
      props: { content, filtered: false, loading: false, selected: true, truncated: true },
    })

    expect(wrapper.get('pre').text()).toBe(content)
    expect(wrapper.find('script').exists()).toBe(false)
    expect(wrapper.text()).toContain('settings.logs.content.truncated')
  })

  it('distinguishes no matches from an unselected file', async () => {
    const wrapper = mount(LogContentViewer, {
      props: { content: '', filtered: true, loading: false, selected: true, truncated: false },
    })
    expect(wrapper.text()).toContain('settings.logs.content.noMatches')

    await wrapper.setProps({ filtered: false, selected: false })
    expect(wrapper.text()).toContain('settings.logs.content.selectFile')
  })
})