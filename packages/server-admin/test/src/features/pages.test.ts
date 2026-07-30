import type {
  ServerPluginScriptRun,
  ServerPluginSnapshot,
  ServerPluginSnapshotEntry,
} from '@delta-comic/server'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

const naive = vi.hoisted(() => ({
  dialog: { warning: vi.fn() },
  message: { error: vi.fn(), success: vi.fn() },
}))

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

const plugin = (id: string, installed: boolean): ServerPluginSnapshotEntry => ({
  allowedActions: installed ? ['enable', 'configure', 'uninstall'] : ['install'],
  config: {},
  desiredState: installed ? 'disabled' : 'uninstalled',
  installedVersion: installed ? '1.0.0' : undefined,
  manifest: {
    apiVersion: 1,
    author: 'Delta',
    capabilities: [],
    configSchema: { properties: {} },
    dependencies: [],
    description: `${id} plugin`,
    id,
    name: id,
    version: '1.0.0',
  },
  observedState: installed ? 'disabled' : 'available',
  registered: installed,
  updateAvailable: id === 'available-update',
})

const snapshot: ServerPluginSnapshot = {
  observedAt: 1,
  plan: { cycles: [], levels: [], missing: [] },
  plugins: [
    plugin('installed', true),
    plugin('available', false),
    plugin('available-update', false),
  ],
  recentAudit: [],
  recentJobs: [],
}

let router: Router
let pinia: ReturnType<typeof createPinia>

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
    connection.apiBaseUrl = 'https://server.example'
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
    connection.apiBaseUrl = 'https://server.example'
    connection.adminToken = 'token'
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
    connection.apiBaseUrl = 'https://server.example'
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

    connection.apiBaseUrl = 'https://server.example'
    await nextTick()
    expect(wrapper.html()).toContain('https://server.example/api/openapi')
    expect(wrapper.html()).toContain('https://server.example/api/openapi/json')
  })
})

describe('plugins page', () => {
  const TableStub = defineComponent({
    name: 'PluginTable',
    props: ['entries', 'pending', 'selectedId'],
    emits: ['action', 'select'],
    template:
      '<div class="table-stub">{{ entries.map((entry) => entry.manifest.id).join(",") }}</div>',
  })
  const ActivityStub = defineComponent({
    name: 'PluginActivityPanel',
    props: ['audit', 'jobs'],
    template: '<div class="activity-stub">activity</div>',
  })
  const PlanStub = defineComponent({
    name: 'InstallPlanDialog',
    props: ['allPlugins', 'plugin', 'show'],
    emits: ['confirm', 'update:show'],
    template: '<div class="plan-stub" />',
  })
  const DrawerStub = defineComponent({
    name: 'PluginDetailDrawer',
    props: ['pending', 'plugin', 'script', 'scriptPending', 'scriptRuns', 'show'],
    emits: ['action', 'configure', 'runScript', 'saveScript', 'update:show'],
    template: '<div class="drawer-stub" />',
  })

  const setup = async (query = '') => {
    await router.push(`/plugins${query}`)
    const connection = useConnectionStore()
    connection.apiBaseUrl = 'https://server.example'
    connection.adminToken = 'token'
    const store = usePluginsStore()
    store.snapshot = snapshot
    const load = vi.spyOn(store, 'load').mockResolvedValue(undefined)
    const loadScript = vi.spyOn(store, 'loadScript').mockResolvedValue(undefined)
    const runAction = vi
      .spyOn(store, 'runAction')
      .mockResolvedValue({
        action: 'enable',
        createdAt: 1,
        id: 'job-1',
        pluginId: 'installed',
        status: 'succeeded',
        updatedAt: 2,
      })
    const saveScript = vi.spyOn(store, 'saveScript').mockResolvedValue(true)
    const runScript = vi
      .spyOn(store, 'runScript')
      .mockResolvedValue({
        completedAt: 2,
        id: 'run-1',
        pluginId: 'installed',
        startedAt: 1,
        status: 'succeeded',
        trigger: 'manual',
      })
    const wrapper = mount(PluginsPage, {
      global: {
        plugins: [pinia, router],
        stubs: {
          ...naiveStubs,
          InstallPlanDialog: PlanStub,
          PluginActivityPanel: ActivityStub,
          PluginDetailDrawer: DrawerStub,
          PluginTable: TableStub,
        },
      },
    })
    return { load, loadScript, runAction, runScript, saveScript, store, wrapper }
  }

  it('filters installed and available plugins and opens plugin details', async () => {
    const { load, loadScript, store, wrapper } = await setup()
    expect(load).toHaveBeenCalledOnce()
    expect(wrapper.get('.table-stub').text()).toBe('installed')

    await wrapper.findAll('.plugins-page__tabs button')[0].trigger('click')
    expect(wrapper.get('.table-stub').text()).toContain('available,available-update')
    const table = wrapper.getComponent(TableStub)
    table.vm.$emit('select', 'available')
    await nextTick()
    expect(store.selectedId).toBe('available')
    expect(loadScript).toHaveBeenCalledWith('available')
    expect(wrapper.getComponent(DrawerStub).props('show')).toBe(true)
  })

  it('opens plans, confirms uninstall, and reports successful actions', async () => {
    const { runAction, wrapper } = await setup()
    const table = wrapper.getComponent(TableStub)
    table.vm.$emit('action', snapshot.plugins[1], 'install')
    await nextTick()
    expect(wrapper.getComponent(PlanStub).props('show')).toBe(true)
    expect(wrapper.getComponent(PlanStub).props('plugin')).toEqual(snapshot.plugins[1])

    table.vm.$emit('action', snapshot.plugins[0], 'uninstall')
    expect(naive.dialog.warning).toHaveBeenCalledOnce()
    const warning = naive.dialog.warning.mock.calls[0][0]
    await warning.onPositiveClick()
    expect(runAction).toHaveBeenCalledWith('installed', 'uninstall', undefined)
    expect(naive.message.success).toHaveBeenCalledWith('uninstall 操作已完成')
  })

  it('coordinates script saving and successful or failed execution feedback', async () => {
    const { runScript, saveScript, wrapper } = await setup()
    const drawer = wrapper.getComponent(DrawerStub)
    const scriptInput = { enabled: true, intervalHours: 2, source: 'return input' }
    drawer.vm.$emit('saveScript', 'installed', scriptInput)
    await flushPromises()
    expect(saveScript).toHaveBeenCalledWith('installed', scriptInput)
    expect(naive.message.success).toHaveBeenCalledWith('插件代码已保存')

    drawer.vm.$emit('runScript', 'installed', { id: 1 })
    await flushPromises()
    expect(naive.message.success).toHaveBeenCalledWith('插件代码运行完成')

    runScript.mockResolvedValueOnce({
      completedAt: 2,
      errorMessage: 'sandbox failed',
      id: 'run-2',
      pluginId: 'installed',
      startedAt: 1,
      status: 'failed',
      trigger: 'manual',
    } satisfies ServerPluginScriptRun)
    drawer.vm.$emit('runScript', 'installed', null)
    await flushPromises()
    expect(naive.message.error).toHaveBeenCalledWith('sandbox failed')
  })

  it('selects the activity view from the route query', async () => {
    const { wrapper } = await setup('?tab=activity')
    expect(wrapper.findComponent(ActivityStub).exists()).toBe(true)
    expect(wrapper.findComponent(TableStub).exists()).toBe(false)
  })
})

describe('admin shell', () => {
  it('connects on mount, tracks the deepest route, and coordinates mobile navigation', async () => {
    await router.push('/plugins')
    const connection = useConnectionStore()
    connection.apiBaseUrl = 'https://server.example'
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