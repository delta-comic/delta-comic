import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { defineComponent, h, nextTick } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

const naive = vi.hoisted(() => {
  const instance: {
    closable?: boolean
    closeOnEsc?: boolean
    loading?: boolean
    maskClosable?: boolean
    negativeButtonProps?: { disabled?: boolean }
    onPositiveClick?: () => unknown
  } = {}
  const warning = vi.fn((options: { onPositiveClick?: () => unknown }) => {
    instance.onPositiveClick = options.onPositiveClick
    return instance
  })
  return { dialog: { warning }, instance, message: { error: vi.fn(), success: vi.fn() } }
})

vi.mock('naive-ui', async importOriginal => ({
  ...(await importOriginal<typeof import('naive-ui')>()),
  useDialog: () => naive.dialog,
  useMessage: () => naive.message,
}))

import AdminShell from '@/app/AdminShell.vue'
import ModulesPage from '@/features/modules/ModulesPage.vue'
import ObservabilityPage from '@/features/observability/ObservabilityPage.vue'
import OpenApiPage from '@/features/openapi/OpenApiPage.vue'
import OverviewPage from '@/features/overview/OverviewPage.vue'
import PluginsPage from '@/features/plugins/PluginsPage.vue'
import SettingsPage from '@/features/settings/SettingsPage.vue'
import { flowText } from '@/i18n/flows'
import { AdminApiClient } from '@/shared/api/AdminApiClient'
import type { AdminOverview } from '@/shared/api/types'
import { useConnectionStore } from '@/stores/connection'
import { useOverviewStore } from '@/stores/overview'
import { usePluginsStore } from '@/stores/plugins'

const ButtonStub = defineComponent({
  name: 'Button',
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () => h('button', attrs, [slots.icon?.(), slots.default?.()])
  },
})

const PassThrough = (name: string, tag = 'div') =>
  defineComponent({
    name,
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      return () =>
        h(tag, attrs, [slots.header?.(), slots.prefix?.(), slots.default?.(), slots.footer?.()])
    },
  })

const InputStub = defineComponent({
  name: 'Input',
  props: ['value'],
  emits: ['update:value'],
  setup(props, { emit }) {
    return () =>
      h('input', {
        value: props.value,
        onInput: (event: Event) => emit('update:value', (event.target as HTMLInputElement).value),
      })
  },
})

const naiveStubs = {
  Alert: PassThrough('Alert'),
  Button: ButtonStub,
  Card: PassThrough('Card', 'section'),
  Descriptions: PassThrough('Descriptions'),
  DescriptionsItem: PassThrough('DescriptionsItem'),
  Empty: PassThrough('Empty'),
  Form: PassThrough('Form', 'form'),
  FormItem: PassThrough('FormItem'),
  Input: InputStub,
  Result: PassThrough('Result'),
  Select: PassThrough('Select'),
  Skeleton: PassThrough('Skeleton'),
  Space: PassThrough('Space'),
  Modal: PassThrough('Modal'),
  Checkbox: PassThrough('Checkbox'),
  Switch: PassThrough('Switch'),
  InputNumber: PassThrough('InputNumber'),
}

const overview: AdminOverview = {
  deployment: { available: true, id: 'deployment-1', tag: 'v1', timestamp: '2026-01-01T00:00:00Z' },
  health: {
    checkedAt: 1,
    database: { status: 'healthy' },
    issues: ['secret missing'],
    ready: false,
    requiredSecrets: { ADMIN_TOKEN: true, OPTIONAL_TOKEN: false },
    status: 'degraded',
  },
  metrics: [
    {
      key: 'users',
      label: 'Users',
      source: { table: 'users' },
      status: 'ok',
      unit: 'count',
      value: 12_345,
    },
    {
      issue: 'stale',
      key: 'changes',
      label: 'Changes',
      source: { table: 'changes' },
      status: 'degraded',
      unit: 'count',
      value: 2,
    },
  ],
  observedAt: 1,
  recentActivity: { available: true, items: [] },
}

let pinia: ReturnType<typeof createPinia>
let router: Router

const memoryStorage = (): Storage => {
  const data = new Map<string, string>()
  return {
    clear: () => data.clear(),
    getItem: key => data.get(key) ?? null,
    key: index => [...data.keys()][index] ?? null,
    get length() {
      return data.size
    },
    removeItem: key => data.delete(key),
    setItem: (key, value) => data.set(key, String(value)),
  }
}

beforeEach(async () => {
  naive.dialog.warning.mockReset()
  naive.message.error.mockReset()
  naive.message.success.mockReset()
  Object.defineProperties(window, {
    localStorage: { configurable: true, value: memoryStorage() },
    sessionStorage: { configurable: true, value: memoryStorage() },
  })
  pinia = createPinia()
  setActivePinia(pinia)
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { component: { template: '<div />' }, path: '/' },
      { component: { template: '<div />' }, path: '/modules/:key?' },
      { component: { template: '<div />' }, path: '/plugins' },
      { component: { template: '<div />' }, path: '/settings' },
    ],
  })
  await router.push('/')
})

const mountPage = (component: Parameters<typeof mount>[0], extra: Record<string, unknown> = {}) =>
  mount(
    component as any,
    { global: { plugins: [pinia, router], stubs: naiveStubs }, ...extra } as any,
  )

describe('overview and observability pages', () => {
  it('routes disconnected overview users to settings', async () => {
    const wrapper = mountPage(OverviewPage)
    expect(wrapper.getComponent({ name: 'Result' }).attributes('title')).toBe('尚未连接 Server API')

    await wrapper
      .findAll('button')
      .find(button => button.text() === '打开设置')!
      .trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/settings')
  })

  it('loads and composes overview data when credentials are present', async () => {
    const connection = useConnectionStore()
    connection.apiBaseUrl = 'https://example.com'
    connection.adminToken = 'token'
    connection.capabilities = {
      features: {},
      modules: [],
      observedAt: 1,
      server: {
        adminPath: '/api/admin',
        bindings: {},
        configuration: {
          accessTokenTtlSeconds: 3600,
          refreshTokenTtlSeconds: 7200,
          syncMaxPullChanges: 200,
          syncMaxPushOps: 100,
        },
        requiredSecrets: {},
        service: 'delta-comic',
      },
    } as any
    const store = useOverviewStore()
    store.data = overview
    const load = vi.spyOn(store, 'load').mockResolvedValue(undefined)

    const wrapper = mountPage(OverviewPage)
    expect(load).toHaveBeenCalledOnce()
    expect(wrapper.findComponent({ name: 'OverviewMetricBand' }).props('overview')).toEqual(
      overview,
    )
    expect(wrapper.findComponent({ name: 'RecentActivityTable' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'RuntimeSummary' }).exists()).toBe(true)
  })

  it('loads observability only without existing data and renders degraded metrics', async () => {
    const connection = useConnectionStore()
    connection.apiBaseUrl = 'https://example.com'
    connection.adminToken = 'token'
    const diagnostic = { fibers: [], plugins: [], records: [], runtime: 'test' }
    vi.spyOn(connection, 'createClient').mockReturnValue(
      new AdminApiClient({
        baseUrl: 'https://example.com',
        fetcher: async () => Response.json({ data: diagnostic, ok: true }),
      }),
    )
    const store = useOverviewStore()
    const load = vi.spyOn(store, 'load').mockResolvedValue(undefined)

    const loading = mountPage(ObservabilityPage)
    expect(load).toHaveBeenCalledOnce()
    expect(loading.findComponent({ name: 'Skeleton' }).exists()).toBe(true)
    loading.unmount()

    store.data = overview
    store.error = 'partial data'
    const wrapper = mountPage(ObservabilityPage)
    expect(load).toHaveBeenCalledOnce()
    expect(wrapper.text()).toContain('12,345')
    expect(wrapper.text()).toContain('服务降级')
    expect(wrapper.text()).toContain('已配置')
    expect(wrapper.text()).toContain('缺失')
    expect(wrapper.text()).toContain('secret missing')
  })
})

describe('settings, modules, and OpenAPI pages', () => {
  it('saves credentials, verifies the connection, and reports success', async () => {
    const connection = useConnectionStore()
    connection.apiBaseUrl = 'https://old.example'
    connection.adminToken = 'old-token'
    const saveCredentials = vi.spyOn(connection, 'saveCredentials').mockImplementation(() => {})
    const connect = vi.spyOn(connection, 'connect').mockResolvedValue(true)
    const wrapper = mountPage(SettingsPage)
    const inputs = wrapper.findAll('input')

    await inputs[0].setValue('https://new.example')
    await inputs[1].setValue('new-token')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(saveCredentials).toHaveBeenCalledWith('https://new.example', 'new-token')
    expect(connect).toHaveBeenCalledOnce()
    expect(naive.message.success).toHaveBeenCalledWith('连接验证成功')
  })

  it('shows connection validation and malformed endpoint failures', async () => {
    const connection = useConnectionStore()
    connection.apiBaseUrl = 'https://example.com'
    connection.adminToken = 'token'
    vi.spyOn(connection, 'saveCredentials').mockImplementationOnce(() => {})
    vi.spyOn(connection, 'connect').mockImplementationOnce(async () => {
      connection.error = 'unauthorized'
      return false
    })
    const wrapper = mountPage(SettingsPage)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('unauthorized')

    vi.spyOn(connection, 'saveCredentials').mockImplementationOnce(() => {
      throw new Error('invalid endpoint')
    })
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('invalid endpoint')
  })

  it('selects a runtime module from the route and renders its contract', async () => {
    await router.push('/modules/auth')
    const connection = useConnectionStore()
    connection.capabilities = {
      modules: [
        {
          apiPrefix: '/api/auth',
          cloudflareBindings: ['DB'],
          description: 'Authentication',
          key: 'auth',
          name: 'Auth',
          runtime: { available: true, bindings: {}, environment: {} },
          workerEnvVars: ['TOKEN'],
        },
        {
          apiPrefix: '/api/sync',
          cloudflareBindings: [],
          description: 'Sync',
          key: 'sync',
          name: 'Sync',
          runtime: { available: false, bindings: {}, environment: {} },
          workerEnvVars: [],
        },
      ],
    } as any
    const wrapper = mountPage(ModulesPage)
    expect(wrapper.text()).toContain('Authentication')
    expect(wrapper.text()).toContain('/api/auth')
    expect(wrapper.text()).toContain('DB')
    expect(wrapper.text()).toContain('TOKEN')
    expect(
      wrapper.findAllComponents({ name: 'StatusMark' }).map(mark => mark.props('tone')),
    ).toEqual(['success', 'warning'])
  })

  it('disables OpenAPI links until an endpoint is configured', async () => {
    const connection = useConnectionStore()
    const wrapper = mountPage(OpenApiPage)
    const buttons = wrapper.findAllComponents({ name: 'Button' })
    expect(buttons.slice(-2).map(button => button.attributes('disabled'))).toEqual(['', ''])

    connection.apiBaseUrl = 'https://example.com'
    await nextTick()
    expect(wrapper.html()).toContain('https://example.com/api/openapi')
    expect(wrapper.html()).toContain('https://example.com/api/openapi/json')
  })
})

describe('admin shell', () => {
  it('connects on mount, tracks the deepest route, and coordinates mobile navigation', async () => {
    await router.push('/plugins')
    const connection = useConnectionStore()
    connection.apiBaseUrl = 'https://example.com'
    connection.adminToken = 'token'
    const connect = vi.spyOn(connection, 'connect').mockResolvedValue(true)
    const Sidebar = defineComponent({
      name: 'AdminSidebar',
      props: ['items', 'open', 'selectedPath'],
      emits: ['close', 'navigate'],
      template: '<aside />',
    })
    const Topbar = defineComponent({
      name: 'AdminTopbar',
      props: ['apiBaseUrl', 'connectionStatus'],
      emits: ['menu', 'openSettings'],
      template: '<header />',
    })
    const wrapper = mount(AdminShell, {
      global: { plugins: [pinia, router], stubs: { AdminSidebar: Sidebar, AdminTopbar: Topbar } },
    })

    expect(connect).toHaveBeenCalledOnce()
    expect(wrapper.getComponent(Sidebar).props('selectedPath')).toBe('/plugins')
    wrapper.getComponent(Topbar).vm.$emit('menu')
    await nextTick()
    expect(wrapper.getComponent(Sidebar).props('open')).toBe(true)

    wrapper.getComponent(Sidebar).vm.$emit('navigate', '/settings')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/settings')
    expect(wrapper.getComponent(Sidebar).props('open')).toBe(false)
  })
})

describe('JSON plugins page', () => {
  it('shows execution history and sends the selected flow input', async () => {
    const connection = useConnectionStore()
    connection.userToken = 'user'
    const store = usePluginsStore()
    store.plugins = [
      {
        manifest: {
          protocolVersion: 2,
          id: 'demo',
          name: 'Demo',
          version: '1.0.0',
          server: { entry: 'flows.json' },
          resources: [],
        },
        config: {},
        enabled: true,
        document: { version: 1, flows: [{ id: 'main', steps: [] }] },
      },
    ]
    vi.spyOn(store, 'load').mockResolvedValue(undefined)
    vi.spyOn(store, 'select').mockImplementation(async id => {
      store.selectedId = id
    })
    const run = vi.spyOn(store, 'run').mockResolvedValue(undefined)
    const wrapper = mountPage(PluginsPage)
    await wrapper
      .findAll('button')
      .find(button => button.text() === 'Demo')!
      .trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain(flowText.history)
    await wrapper
      .findAll('input')
      .find(input => input.attributes('aria-label') === flowText.input)
      ?.setValue('{"value":2}')
    await wrapper
      .findAll('button')
      .find(button => button.text() === flowText.run)!
      .trigger('click')
    await flushPromises()
    expect(run).toHaveBeenCalledWith('demo', 'main', { value: 2 })
    wrapper.unmount()
  })
})