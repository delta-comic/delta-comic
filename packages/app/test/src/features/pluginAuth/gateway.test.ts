import { pluginI18n, type User } from '@delta-comic/plugin'
import type { DialogOptions } from 'naive-ui'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { VNode } from 'vue'

const { createFormMock, pageWebviewAuth, sharedFunction } = vi.hoisted(() => ({
  createFormMock: vi.fn(),
  pageWebviewAuth: class {},
  sharedFunction: { call: vi.fn() },
}))

await vi.hoisted(async () => {
  // @ts-expect-error The checked-in UMD runtime intentionally has no TypeScript declaration.
  await import('../../../../public/runtime/host-libraries.umd.js')
})

vi.mock('@delta-comic/ui', () => ({ createForm: createFormMock }))
vi.mock('@delta-comic/utils', () => ({
  PageWebviewAuth: pageWebviewAuth,
  SharedFunction: sharedFunction,
}))

// 加载宿主 i18n 实例，触发 pluginI18n.install 安装适配器。
import '../../../../src/i18n'
import { createPluginAuthGateway } from '../../../../src/features/pluginAuth/gateway'

const fixtureMessages = {
  'zh-CN': {
    'gateway-fixture': {
      auth: {
        scan: '扫码登录',
        plain: '纯文本选择',
        password: '密码',
        passwordPlaceholder: '请输入密码',
        channel: '登录渠道',
      },
    },
  },
}

const dialogCreate = vi.fn()
const destroyed = vi.fn()

describe('createPluginAuthGateway', () => {
  beforeEach(() => {
    pluginI18n.register('gateway-fixture', fixtureMessages)
    vi.stubGlobal('$dialog', { create: dialogCreate })
    createFormMock.mockReset()
    dialogCreate.mockReset()
    destroyed.mockReset()
  })

  afterEach(() => {
    pluginI18n.remove('gateway-fixture')
    vi.unstubAllGlobals()
  })

  it('localizes selection names and confirm text in the auth method dialog', async () => {
    const scan = vi.fn()
    const auth: User.Auth = {
      default: async () => false,
      selections: [
        { id: 'scan', name: pluginI18n.messageKey('gateway-fixture.auth.scan'), call: scan },
        { id: 'plain', name: 'gateway-fixture.auth.plain', call: vi.fn() },
        { id: 'raw', name: '原样展示', call: vi.fn() },
      ],
    }
    dialogCreate.mockImplementation((options: DialogOptions) => {
      options.onPositiveClick?.(new MouseEvent('click'))
      return { destroy: destroyed }
    })

    const gateway = createPluginAuthGateway(() => '确定')
    await gateway.authenticate('gateway-fixture', auth, new AbortController().signal)

    const [options] = dialogCreate.mock.calls[0]
    expect(options.title).toBe('gateway-fixture')
    expect(options.positiveText).toBe('确定')
    const rendered = typeof options.content === 'function' ? options.content() : null
    const content = rendered as VNode
    expect(content.props).toMatchObject({
      options: [
        { label: '扫码登录', value: 'scan' },
        { label: '纯文本选择', value: 'plain' },
        { label: '原样展示', value: 'raw' },
      ],
    })
    expect(scan).toHaveBeenCalledTimes(1)
    expect(destroyed).toHaveBeenCalledTimes(1)
  })

  it('localizes auth form labels, placeholders and selects before rendering', async () => {
    createFormMock.mockReturnValue({ comp: null, data: Promise.resolve({}) })
    const byForm = vi.fn(async (method: User.Method) => {
      await method.form({
        password: {
          type: 'string',
          info: 'gateway-fixture.auth.password',
          placeholder: 'gateway-fixture.auth.passwordPlaceholder',
        },
        channel: {
          type: 'radio',
          comp: 'radio',
          info: pluginI18n.messageKey('gateway-fixture.auth.channel'),
          selects: [{ label: 'gateway-fixture.auth.scan', value: 'scan' }],
        },
      })
    })
    const auth: User.Auth = {
      default: async () => 'plain',
      selections: [{ id: 'plain', name: 'plain', call: byForm }],
    }
    dialogCreate.mockImplementation(() => ({ destroy: destroyed }))

    const gateway = createPluginAuthGateway(() => '确定')
    await gateway.authenticate('gateway-fixture', auth, new AbortController().signal)

    const [configs] = createFormMock.mock.calls[0]
    expect(configs.password.info).toBe('密码')
    expect(configs.password.placeholder).toBe('请输入密码')
    expect(configs.channel.info).toBe('登录渠道')
    expect(configs.channel.selects).toEqual([{ label: '扫码登录', value: 'scan' }])
    expect(byForm).toHaveBeenCalledTimes(1)
    expect(destroyed).toHaveBeenCalledTimes(1)
  })
})