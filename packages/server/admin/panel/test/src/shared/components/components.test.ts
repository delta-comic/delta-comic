import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'

import AdminSidebar from '@/app/AdminSidebar.vue'
import AdminTopbar from '@/app/AdminTopbar.vue'
import OverviewMetricBand from '@/features/overview/components/OverviewMetricBand.vue'
import RecentActivityTable from '@/features/overview/components/RecentActivityTable.vue'
import RuntimeSummary from '@/features/overview/components/RuntimeSummary.vue'
import type { AdminCapabilities, AdminOverview } from '@/shared/api/types'

import AppIcon from '../../../../src/shared/components/AppIcon.vue'
import PageHeader from '../../../../src/shared/components/PageHeader.vue'
import StatusMark from '../../../../src/shared/components/StatusMark.vue'

const PassThrough = (name: string, tag = 'div') =>
  defineComponent({
    name,
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      return () => h(tag, attrs, [slots.default?.(), slots.footer?.()])
    },
  })

const overview = (status: AdminOverview['health']['status'] = 'ready'): AdminOverview => ({
  deployment: { available: true, id: 'deployment-1', tag: 'v1', timestamp: '2026-01-01T00:00:00Z' },
  health: {
    checkedAt: 1,
    database: { status: status === 'ready' ? 'healthy' : 'unhealthy' },
    issues: status === 'ready' ? [] : ['D1 unavailable'],
    ready: status === 'ready',
    requiredSecrets: { ADMIN_TOKEN: true, OPTIONAL_TOKEN: false },
    status,
  },
  metrics: Array.from({ length: 7 }, (_, index) => ({
    key: `metric-${index}`,
    label: `Metric ${index}`,
    source: { table: `table_${index}` },
    status: 'ok',
    unit: 'count',
    value: index * 1_000,
  })),
  observedAt: Date.parse('2026-01-02T00:00:00Z'),
  recentActivity: { available: true, items: [] },
})

const capabilities: AdminCapabilities = {
  features: {
    adminAuthentication: true,
    databaseMetrics: true,
    databaseReadiness: true,
    pluginAudit: true,
    versionMetadata: true,
  },
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
}

describe('shared primitives', () => {
  it('renders every supported icon path and applies size', async () => {
    const names = [
      'home',
      'plugins',
      'metrics',
      'cube',
      'api',
      'gear',
      'refresh',
      'copy',
      'menu',
      'close',
      'search',
      'chevron-right',
    ] as const
    const wrapper = mount(AppIcon, { props: { name: names[0], size: 28 } })
    const renderings = new Set<string>()

    for (const name of names) {
      await wrapper.setProps({ name })
      renderings.add(wrapper.get('svg').element.innerHTML)
      expect(wrapper.get('svg').attributes()).toMatchObject({ height: '28', width: '28' })
    }
    expect(renderings.size).toBe(names.length)
  })

  it('only renders optional page-header regions when supplied', async () => {
    const wrapper = mount(PageHeader, { props: { title: 'Overview' } })
    expect(wrapper.get('h1').text()).toBe('Overview')
    expect(wrapper.find('p').exists()).toBe(false)
    expect(wrapper.find('.page-header__actions').exists()).toBe(false)

    await wrapper.setProps({ description: 'Runtime status' })
    expect(wrapper.get('p').text()).toBe('Runtime status')

    const withAction = mount(PageHeader, {
      props: { title: 'Overview' },
      slots: { actions: () => h('button', 'Refresh') },
    })
    expect(withAction.get('.page-header__actions').text()).toBe('Refresh')
  })

  it.each(['muted', 'success', 'warning', 'danger'] as const)(
    'renders the %s status tone',
    tone => {
      const wrapper = mount(StatusMark, { props: { label: tone, tone } })
      expect(wrapper.classes()).toContain(`status-mark--${tone}`)
      expect(wrapper.text()).toBe(tone)
    },
  )
})

describe('admin navigation components', () => {
  const items = [
    { icon: 'home' as const, label: 'Overview', order: 0, path: '/' },
    { icon: 'plugins' as const, label: 'Plugins', order: 1, path: '/plugins' },
  ]

  it('emits selected sidebar navigation and closes through its scrim', async () => {
    const wrapper = mount(AdminSidebar, { props: { items, open: true, selectedPath: '/plugins' } })
    expect(wrapper.get('aside').classes()).toContain('admin-sidebar--open')
    expect(wrapper.findAll('.admin-sidebar__item')).toHaveLength(2)
    expect(wrapper.findAll('.admin-sidebar__item')[1].classes()).toContain(
      'admin-sidebar__item--selected',
    )

    await wrapper.get('.admin-sidebar__brand').trigger('click')
    await wrapper.findAll('.admin-sidebar__item')[1].trigger('click')
    await wrapper.get('.admin-sidebar__scrim').trigger('click')
    expect(wrapper.emitted('navigate')).toEqual([['/'], ['/plugins']])
    expect(wrapper.emitted('close')).toEqual([[]])
  })

  it.each([
    ['connected', '已连接', 'success'],
    ['connecting', '连接中', 'warning'],
    ['error', '连接异常', 'danger'],
    ['disconnected', '未连接', 'muted'],
  ] as const)(
    'maps %s topbar state to a readable status',
    async (connectionStatus, label, tone) => {
      const wrapper = mount(AdminTopbar, { props: { apiBaseUrl: '', connectionStatus } })
      const mark = wrapper.getComponent(StatusMark)
      expect(mark.props()).toMatchObject({ label, tone })
      expect(wrapper.get('code').text()).toBe('尚未配置')

      await wrapper.get('.admin-topbar__menu').trigger('click')
      await wrapper.get('.admin-topbar__settings').trigger('click')
      expect(wrapper.emitted('menu')).toEqual([[]])
      expect(wrapper.emitted('openSettings')).toEqual([[]])
    },
  )
})

describe('overview presentation', () => {
  it.each([
    ['ready', '正常', 'success'],
    ['degraded', '需要关注', 'warning'],
    ['unhealthy', '不可用', 'danger'],
  ] as const)(
    'summarizes %s health and caps the metric band at five metrics',
    (status, label, tone) => {
      const wrapper = mount(OverviewMetricBand, { props: { overview: overview(status) } })
      expect(wrapper.findAll('.metric-band__item')).toHaveLength(6)
      expect(wrapper.get('.metric-band__health strong').text()).toBe(label)
      expect(wrapper.getComponent(StatusMark).props('tone')).toBe(tone)
      expect(wrapper.text()).toContain('4,000')
      expect(wrapper.text()).not.toContain('Metric 5')
    },
  )

  it('renders recent successes and failures while limiting rows to eight', async () => {
    const items = Array.from({ length: 9 }, (_, index) => ({
      action: 'install',
      createdAt: Date.UTC(2026, 0, index + 1),
      id: `activity-${index}`,
      outcome: index % 2 ? 'failed' : 'succeeded',
      pluginId: `plugin-${index}`,
    }))
    const wrapper = mount(RecentActivityTable, {
      global: { stubs: { RouterLink: PassThrough('RouterLink', 'a') } },
      props: { items },
    })

    expect(wrapper.findAll('tbody tr')).toHaveLength(8)
    expect(wrapper.findAllComponents(StatusMark).map(mark => mark.props('tone'))).toContain(
      'danger',
    )

    await wrapper.setProps({ items: [] })
    expect(wrapper.text()).toContain('暂无插件操作记录')
  })

  it('renders deployment, health issues, secret status, and capability limits', async () => {
    const wrapper = mount(RuntimeSummary, {
      props: { capabilities, overview: overview('degraded') },
    })
    expect(wrapper.text()).toContain('deployment-1')
    expect(wrapper.text()).toContain('D1 unavailable')
    expect(wrapper.text()).toContain('100')
    expect(wrapper.findAllComponents(StatusMark)).toHaveLength(3)

    await wrapper.setProps({
      capabilities: null,
      overview: { ...overview(), deployment: { available: false, id: '', tag: '', timestamp: '' } },
    })
    expect(wrapper.text()).toContain('版本元数据')
    expect(wrapper.text()).toContain('未绑定')
    expect(wrapper.text()).not.toContain('配置限制')
  })
})