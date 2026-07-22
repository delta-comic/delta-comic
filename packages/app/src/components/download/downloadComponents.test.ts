import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { nextTick } from 'vue'

import type {
  Destination,
  DownloadTask,
  DownloaderSettings,
} from '@/features/downloads/downloaderClient'

const harness = await vi.hoisted(async () => {
  // @ts-expect-error The checked-in UMD runtime intentionally has no TypeScript declaration.
  await import('../../../public/runtime/host-libraries.umd.js')
  const vueRuntimePath = '../../../node_modules/vue/dist/vue.esm-bundler.js'
  const Vue = (await import(/* @vite-ignore */ vueRuntimePath)) as typeof import('vue')
  const { defineComponent, h } = Vue

  const Button = defineComponent({
    name: 'NButton',
    inheritAttrs: false,
    props: { attrType: String, disabled: Boolean, loading: Boolean },
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
            'onClick': (event: MouseEvent) => emit('click', event),
            'type': props.attrType ?? 'button',
          },
          slots.default?.(),
        ),
  })
  const Form = defineComponent({
    name: 'NForm',
    emits: ['submit'],
    setup:
      (_props, { emit, slots }) =>
      () =>
        h('form', { onSubmit: (event: SubmitEvent) => emit('submit', event) }, slots.default?.()),
  })
  const FormItem = defineComponent({
    name: 'NFormItem',
    props: { feedback: String, label: String, validationStatus: String },
    setup:
      (props, { slots }) =>
      () =>
        h('label', { 'data-label': props.label, 'data-status': props.validationStatus }, [
          slots.default?.(),
          props.feedback ? h('span', { class: 'feedback' }, props.feedback) : undefined,
        ]),
  })
  const Input = defineComponent({
    name: 'NInput',
    props: { placeholder: String, type: String, value: String },
    emits: ['update:value'],
    setup:
      (props, { emit }) =>
      () =>
        h(props.type === 'textarea' ? 'textarea' : 'input', {
          placeholder: props.placeholder,
          value: props.value,
          onInput: (event: Event) => emit('update:value', (event.target as HTMLInputElement).value),
        }),
  })
  const InputNumber = defineComponent({
    name: 'NInputNumber',
    inheritAttrs: false,
    props: { max: Number, min: Number, step: Number, value: Number },
    emits: ['update:value'],
    setup:
      (props, { attrs, emit }) =>
      () =>
        h('input', {
          ...attrs,
          'data-control': 'number',
          'max': props.max,
          'min': props.min,
          'step': props.step,
          'type': 'number',
          'value': props.value ?? '',
          'onInput': (event: Event) => {
            const value = (event.target as HTMLInputElement).value
            emit('update:value', value === '' ? undefined : Number(value))
          },
        }),
  })
  const Select = defineComponent({
    name: 'NSelect',
    inheritAttrs: false,
    props: { disabled: Boolean, options: Array, placeholder: String, value: String },
    emits: ['update:value'],
    setup:
      (props, { attrs, emit }) =>
      () =>
        h(
          'select',
          {
            ...attrs,
            'disabled': props.disabled,
            'data-placeholder': props.placeholder,
            'value': props.value,
            'onChange': (event: Event) =>
              emit('update:value', (event.target as HTMLSelectElement).value),
          },
          (props.options as Array<{ label: string; value: string }> | undefined)?.map(option =>
            h('option', { value: option.value }, option.label),
          ),
        ),
  })
  const Slider = defineComponent({
    name: 'NSlider',
    props: { max: Number, min: Number, step: Number, value: Number },
    emits: ['update:value'],
    setup:
      (props, { emit }) =>
      () =>
        h('input', {
          'data-control': 'slider',
          'max': props.max,
          'min': props.min,
          'step': props.step,
          'type': 'range',
          'value': props.value,
          'onInput': (event: Event) =>
            emit('update:value', Number((event.target as HTMLInputElement).value)),
        }),
  })
  const Switch = defineComponent({
    name: 'NSwitch',
    props: { value: Boolean },
    emits: ['update:value'],
    setup:
      (props, { emit }) =>
      () =>
        h('input', {
          checked: props.value,
          type: 'checkbox',
          onChange: (event: Event) =>
            emit('update:value', (event.target as HTMLInputElement).checked),
        }),
  })
  const Modal = defineComponent({
    name: 'NModal',
    props: { show: Boolean, title: String },
    emits: ['update:show'],
    setup:
      (props, { slots }) =>
      () =>
        props.show
          ? h('section', { 'class': 'modal', 'data-title': props.title }, slots.default?.())
          : null,
  })
  const Drawer = defineComponent({
    name: 'NDrawer',
    props: { show: Boolean },
    emits: ['update:show'],
    setup:
      (props, { slots }) =>
      () =>
        props.show ? h('aside', { class: 'drawer' }, slots.default?.()) : null,
  })
  const DrawerContent = defineComponent({
    name: 'NDrawerContent',
    setup:
      (_props, { slots }) =>
      () =>
        h('section', [h('main', slots.default?.()), h('footer', slots.footer?.())]),
  })
  const Empty = defineComponent({
    name: 'NEmpty',
    props: { description: String },
    setup:
      (props, { slots }) =>
      () =>
        h('section', { class: 'empty' }, [props.description, slots.extra?.()]),
  })
  const Passthrough = (name: string, tag = 'span') =>
    defineComponent({
      name,
      setup:
        (_props, { slots }) =>
        () =>
          h(tag, slots.default?.()),
    })

  window.$$lib$$ = {
    ...window.$$lib$$,
    Naive: {
      ...window.$$lib$$.Naive,
      NAlert: Passthrough('NAlert', 'aside'),
      NButton: Button,
      NCheckbox: Passthrough('NCheckbox'),
      NCheckboxGroup: Passthrough('NCheckboxGroup', 'div'),
      NDrawer: Drawer,
      NDrawerContent: DrawerContent,
      NEmpty: Empty,
      NForm: Form,
      NFormItem: FormItem,
      NInput: Input,
      NInputNumber: InputNumber,
      NModal: Modal,
      NProgress: Passthrough('NProgress', 'progress'),
      NRadio: Passthrough('NRadio'),
      NRadioGroup: Passthrough('NRadioGroup', 'div'),
      NSelect: Select,
      NSlider: Slider,
      NSpin: Passthrough('NSpin', 'div'),
      NSwitch: Switch,
      NTag: Passthrough('NTag'),
    },
    Vue,
  } as typeof window.$$lib$$

  const actionEvents = [
    'cancel',
    'deleteFiles',
    'details',
    'forget',
    'pause',
    'resume',
    'retry',
  ] as const
  const taskStub = (name: string, tag: string) =>
    defineComponent({
      name,
      inheritAttrs: false,
      props: { disabled: Boolean, task: Object },
      emits: [...actionEvents],
      setup:
        (props, { attrs }) =>
        () =>
          h(tag, { ...attrs, 'data-disabled': String(props.disabled) }),
    })

  return {
    TaskActions: taskStub('DownloadTaskActions', 'nav'),
    TaskCard: taskStub('DownloadTaskCard', 'article'),
    Vue,
    actionEvents,
    desktop: Vue.shallowRef(false),
    scrollTo: vi.fn(),
    virtualOptions: undefined as { itemHeight: () => number } | undefined,
  }
})

vi.mock('@vueuse/core', () => ({
  useMediaQuery: () => harness.desktop,
  useVirtualList: (source: { value: unknown[] }, options: { itemHeight: () => number }) => {
    harness.virtualOptions = options
    return {
      containerProps: { 'data-virtual-container': 'true' },
      list: harness.Vue.computed(() => source.value.map((data, index) => ({ data, index }))),
      scrollTo: harness.scrollTo,
      wrapperProps: { 'data-virtual-wrapper': 'true' },
    }
  },
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
  }),
}))

import AddDownloadDialog from './AddDownloadDialog.vue'
import ContentDownloadDialog from './ContentDownloadDialog.vue'
import DownloadList from './DownloadList.vue'
import DownloadSettingsDrawer from './DownloadSettingsDrawer.vue'

const field = (wrapper: VueWrapper, label: string) => wrapper.get(`[data-label="${label}"]`)

const settings = (overrides: Partial<DownloaderSettings> = {}): DownloaderSettings => ({
  allowMetered: true,
  connectionBudget: 16,
  maxActiveTasks: 4,
  perTaskConnections: 8,
  revision: 1,
  seedOnComplete: false,
  seedRatio: undefined,
  seedSeconds: undefined,
  ...overrides,
})

const capabilities = { connectionBudgetMax: 64, maxActiveTasks: 20 }

const destinations: Destination[] = [
  { id: 'default', isDefault: true, kind: 'managed', label: 'Downloads' },
  { id: 'archive', isDefault: false, kind: 'desktopDirectory', label: 'Archive' },
]

const task = (overrides: Partial<DownloadTask> = {}): DownloadTask => ({
  createdAt: 1,
  destinationId: 'default',
  downloadedBytes: 50,
  id: 'task-1',
  kind: 'http',
  priority: 5,
  queuePosition: 0,
  relativePath: 'comic/episode.cbz',
  retryCount: 0,
  revision: 1,
  source: { mirrors: [{ url: 'https://example.test/episode.cbz' }], type: 'http' },
  speedBytesPerSecond: 25,
  status: 'downloading',
  title: 'Episode',
  totalBytes: 100,
  updatedAt: 1,
  ...overrides,
})

describe('AddDownloadDialog', () => {
  let wrapper: VueWrapper | undefined

  afterEach(() => wrapper?.unmount())

  it('normalizes an HTTP URL, priority and checksum input', async () => {
    wrapper = mount(AddDownloadDialog, {
      props: { 'destinations': destinations, 'show': true, 'onUpdate:show': vi.fn() },
    })

    await field(wrapper, 'download.add.source')
      .get('textarea')
      .setValue('  https://example.test/a  ')
    await field(wrapper, 'download.add.priority').get('input').setValue('9')
    await field(wrapper, 'download.add.checksumAlgorithm').get('select').setValue('md5')
    await field(wrapper, 'download.add.checksum').get('input').setValue('  abc123  ')
    await field(wrapper, 'download.destinations.field').get('select').setValue('archive')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')).toEqual([
      [
        {
          input: {
            checksum: { algorithm: 'md5', value: 'abc123' },
            destinationId: 'archive',
            priority: 9,
            url: 'https://example.test/a',
          },
          type: 'http',
        },
      ],
    ])
  })

  it('recognizes a magnet source without requiring an explicit source type', async () => {
    wrapper = mount(AddDownloadDialog, {
      props: { 'destinations': destinations, 'show': true, 'onUpdate:show': vi.fn() },
    })
    const magnet = 'magnet:?xt=urn:btih:fixture'

    await field(wrapper, 'download.add.source').get('textarea').setValue(` ${magnet} `)
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')).toEqual([
      [
        {
          input: {
            destinationId: 'default',
            priority: 5,
            source: { input: { type: 'magnet', uri: magnet }, onlyFiles: [] },
          },
          type: 'torrent',
        },
      ],
    ])
  })

  it('reads a .torrent file as portable base64 bytes', async () => {
    class FileReaderStub {
      public error: Error | null = null
      public onerror: (() => void) | null = null
      public onload: (() => void) | null = null
      public result: string | null = null

      readAsDataURL() {
        this.result = 'data:application/x-bittorrent;base64,dG9ycmVudA=='
        queueMicrotask(() => this.onload?.())
      }
    }
    vi.stubGlobal('FileReader', FileReaderStub)
    wrapper = mount(AddDownloadDialog, {
      props: { 'destinations': destinations, 'show': true, 'onUpdate:show': vi.fn() },
    })
    const input = wrapper.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', {
      configurable: true,
      value: [new File(['torrent'], 'comic.torrent', { type: 'application/x-bittorrent' })],
    })

    await input.trigger('change')
    await flushPromises()
    await wrapper.get('form').trigger('submit')

    expect(wrapper.text()).toContain('download.add.torrentFileSelected:{"name":"comic.torrent"}')
    expect(wrapper.emitted('submit')).toEqual([
      [
        {
          input: {
            destinationId: 'default',
            priority: 5,
            source: { input: { base64: 'dG9ycmVudA==', type: 'bytes' }, onlyFiles: [] },
            title: 'comic.torrent',
          },
          type: 'torrent',
        },
      ],
    ])
  })

  it('blocks empty and invalid torrent file submissions with localized validation', async () => {
    wrapper = mount(AddDownloadDialog, {
      props: { 'destinations': destinations, 'show': true, 'onUpdate:show': vi.fn() },
    })

    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('download.errors.sourceRequired')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')).toBeUndefined()

    const input = wrapper.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', {
      configurable: true,
      value: [new File(['not a torrent'], 'comic.txt', { type: 'text/plain' })],
    })
    await input.trigger('change')

    expect(wrapper.text()).toContain('download.errors.invalidTorrentFile')
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('labels the destination select for assistive technology', () => {
    wrapper = mount(AddDownloadDialog, {
      props: { 'destinations': destinations, 'show': true, 'onUpdate:show': vi.fn() },
    })

    expect(
      field(wrapper, 'download.destinations.field').get('select').attributes('aria-label'),
    ).toBe('download.destinations.field')
  })
})

describe('ContentDownloadDialog', () => {
  let wrapper: VueWrapper | undefined

  afterEach(() => wrapper?.unmount())

  it('emits the selected destination with the content selection', async () => {
    wrapper = mount(ContentDownloadDialog, {
      props: {
        'capabilities': capabilities,
        'destinations': destinations,
        'page': {} as never,
        'show': true,
        'onUpdate:show': vi.fn(),
      },
    })

    await field(wrapper, 'download.destinations.field').get('select').setValue('archive')
    await wrapper.findAll('button').at(-1)!.trigger('click')

    expect(wrapper.emitted('submit')).toEqual([
      [{ destinationId: 'archive', selection: { type: 'currentEpisode' } }],
    ])
  })
})

describe('DownloadSettingsDrawer', () => {
  let wrapper: VueWrapper | undefined

  afterEach(() => wrapper?.unmount())

  it('exposes and maps both 1 and 20 active-task boundaries', async () => {
    wrapper = mount(DownloadSettingsDrawer, {
      props: {
        'capabilities': capabilities,
        'destinations': destinations,
        'settings': settings(),
        'show': true,
        'onUpdate:show': vi.fn(),
      },
    })
    const concurrent = field(wrapper, 'download.settings.concurrentTasks')
    expect(concurrent.get('input[type="range"]').attributes()).toMatchObject({
      max: '20',
      min: '1',
    })
    const input = concurrent.get('input[type="number"]')
    expect(input.attributes()).toMatchObject({ max: '20', min: '1' })

    await input.setValue('1')
    await wrapper.get('footer button').trigger('click')
    await input.setValue('20')
    await wrapper.get('footer button').trigger('click')

    expect(
      wrapper.emitted('save')?.map(([patch]) => (patch as DownloaderSettings).maxActiveTasks),
    ).toEqual([1, 20])
  })

  it('caps per-task connections at the total budget and maps metered/seeding settings', async () => {
    wrapper = mount(DownloadSettingsDrawer, {
      props: {
        'capabilities': capabilities,
        'destinations': destinations,
        'settings': settings({ seedOnComplete: true, seedRatio: 1.5, seedSeconds: 610 }),
        'show': true,
        'onUpdate:show': vi.fn(),
      },
    })
    const totalConnections = field(wrapper, 'download.settings.connections').get('input')
    const perTask = field(wrapper, 'download.settings.connectionsPerTask').get('input')
    expect(totalConnections.attributes()).toMatchObject({ max: '64', min: '1' })

    await totalConnections.setValue('12')
    await perTask.setValue('20')
    await field(wrapper, 'download.settings.seedRatio').get('input').setValue('2.5')
    const switches = wrapper.findAll('input[type="checkbox"]')
    await switches[0].setValue(false)
    await nextTick()
    expect(perTask.attributes('max')).toBe('12')
    await wrapper.get('footer button').trigger('click')

    expect(wrapper.emitted('save')?.at(-1)?.[0]).toEqual({
      allowMetered: false,
      connectionBudget: 12,
      maxActiveTasks: 4,
      perTaskConnections: 12,
      seedOnComplete: true,
      seedRatio: 2.5,
      seedSeconds: 600,
    })
  })

  it('clears ratio and duration when seeding is disabled', async () => {
    wrapper = mount(DownloadSettingsDrawer, {
      props: {
        'capabilities': capabilities,
        'destinations': destinations,
        'settings': settings({ seedOnComplete: true, seedRatio: 2, seedSeconds: 900 }),
        'show': true,
        'onUpdate:show': vi.fn(),
      },
    })
    const switches = wrapper.findAll('input[type="checkbox"]')
    await switches[1].setValue(false)
    await nextTick()

    expect(wrapper.find(`[data-label="download.settings.seedRatio"]`).exists()).toBe(false)
    expect(wrapper.find(`[data-label="download.settings.seedMinutes"]`).exists()).toBe(false)
    await wrapper.get('footer button').trigger('click')

    expect(wrapper.emitted('save')?.at(-1)?.[0]).toMatchObject({
      seedOnComplete: false,
      seedRatio: undefined,
      seedSeconds: undefined,
    })
  })

  it('shows every registered destination and identifies the default target', async () => {
    wrapper = mount(DownloadSettingsDrawer, {
      props: {
        'capabilities': capabilities,
        'destinations': destinations,
        'settings': settings(),
        'show': true,
        'onUpdate:show': vi.fn(),
      },
    })

    expect(
      wrapper.get('[aria-label="download.destinations.registered"]').findAll('li'),
    ).toHaveLength(2)
    expect(wrapper.text()).toContain('Downloads')
    expect(wrapper.text()).toContain('Archive')
    expect(wrapper.text()).toContain('download.destinations.default')
    expect(wrapper.text()).toContain('download.destinations.kinds.desktopDirectory')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('pickDestination')).toHaveLength(1)
  })

  it('uses the native Android connection ceiling instead of the desktop limit', async () => {
    wrapper = mount(DownloadSettingsDrawer, {
      props: {
        'capabilities': { connectionBudgetMax: 24, maxActiveTasks: 20 },
        'destinations': destinations,
        'settings': settings(),
        'show': true,
        'onUpdate:show': vi.fn(),
      },
    })

    expect(field(wrapper, 'download.settings.connections').get('input').attributes('max')).toBe(
      '24',
    )
  })
})

describe('DownloadList', () => {
  let wrapper: VueWrapper | undefined

  beforeEach(() => {
    harness.desktop.value = false
    harness.scrollTo.mockReset()
    harness.virtualOptions = undefined
  })

  afterEach(() => wrapper?.unmount())

  const mountList = (tasks: DownloadTask[]) =>
    mount(DownloadList, {
      props: { disabled: true, tasks },
      global: {
        stubs: { DownloadTaskActions: harness.TaskActions, DownloadTaskCard: harness.TaskCard },
      },
    })

  it('renders the empty state without task rows', () => {
    wrapper = mountList([])

    expect(wrapper.find('.empty').exists()).toBe(true)
    expect(wrapper.text()).toContain('download.empty.description')
    expect(wrapper.findComponent({ name: 'DownloadTaskCard' }).exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'DownloadTaskActions' }).exists()).toBe(false)
  })

  it('keeps mobile cards and desktop rows stable while switching virtual item height', async () => {
    wrapper = mountList([task()])
    const card = wrapper.getComponent({ name: 'DownloadTaskCard' })
    const actions = wrapper.getComponent({ name: 'DownloadTaskActions' })

    expect(card.classes()).toContain('md:hidden')
    expect(card.props()).toMatchObject({ disabled: true, task: task() })
    expect(actions.props()).toMatchObject({ disabled: true, task: task() })
    expect(
      wrapper
        .findAll('div')
        .some(node => node.classes().includes('md:grid') && node.classes().includes('h-[72px]')),
    ).toBe(true)
    expect(harness.virtualOptions?.itemHeight()).toBe(168)

    harness.desktop.value = true
    await nextTick()

    expect(harness.virtualOptions?.itemHeight()).toBe(72)
    expect(harness.scrollTo).toHaveBeenCalledExactlyOnceWith(0)
  })

  it('forwards every operation from both mobile and desktop controls with the task payload', () => {
    const value = task()
    wrapper = mountList([value])
    const card = wrapper.getComponent({ name: 'DownloadTaskCard' })
    const actions = wrapper.getComponent({ name: 'DownloadTaskActions' })

    for (const event of harness.actionEvents) {
      card.vm.$emit(event)
      actions.vm.$emit(event)
      expect(wrapper.emitted(event)).toEqual([[value], [value]])
    }
  })
})