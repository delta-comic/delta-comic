import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import { createTemplate } from './helper'
import DcMarkdown from './index.vue'

const { isTauri, shellOpen } = vi.hoisted(() => ({ isTauri: vi.fn(), shellOpen: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => ({ isTauri }))
vi.mock('@tauri-apps/plugin-shell', () => ({ open: shellOpen }))
vi.mock('./dark.css?inline', () => ({ default: '/* dark-theme */' }))
vi.mock('./light.css?inline', () => ({ default: '/* light-theme */' }))

afterEach(() => {
  vi.restoreAllMocks()
  isTauri.mockReset().mockReturnValue(false)
  shellOpen.mockReset()
})

describe('markdown HTML template', () => {
  it('embeds content, theme color, message identity, and browser navigation policy', () => {
    const template = createTemplate({
      color: '#336699',
      content: '<h1>Delta</h1>',
      delegateLinkOpen: false,
      isDark: false,
      messageKey: 'markdown-test',
    })

    expect(template).toContain('--p-color: #336699')
    expect(template).toContain('/* light-theme */')
    expect(template).toContain('<h1>Delta</h1>')
    expect(template).toContain('if(!false)')
    expect(template).toContain("window.open(href, '_blank', 'noopener,noreferrer')")
    expect(template).toContain("type:'markdown-test'")
  })

  it('uses the dark stylesheet and delegates navigation in an app runtime', () => {
    const template = createTemplate({
      color: '',
      content: '',
      delegateLinkOpen: true,
      isDark: true,
      messageKey: 'app-message',
    })

    expect(template).toContain('/* dark-theme */')
    expect(template).toContain('if(!true)')
    expect(template).toContain("window.parent.postMessage({ type:'app-message', href });")
  })
})

describe('DcMarkdown', () => {
  it('renders markdown with plugins and configured HTML options into srcdoc', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.25)
    const plugin = (md: any, suffix: string) => {
      md.core.ruler.push('suffix', (state: any) => {
        state.tokens.push(new state.Token('html_block', '', 0))
        state.tokens.at(-1).content = `<footer>${suffix}</footer>`
      })
    }
    const wrapper = mount(DcMarkdown, {
      props: {
        config: { breaks: true, html: true },
        isDarkMode: true,
        markdown: '# Heading\nline',
        plugins: [[plugin, 'plugin-output']] as any,
      },
    })
    const srcdoc = wrapper.get('iframe').attributes('srcdoc')

    expect(srcdoc).toContain('<h1>Heading</h1>')
    expect(srcdoc).toContain('line')
    expect(srcdoc).toContain('<footer>plugin-output</footer>')
    expect(srcdoc).toContain('/* dark-theme */')
    expect(srcdoc).toContain("type:'markdown-router-0.25'")
  })

  it('ignores unrelated messages and opens matching links in the browser', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const browserOpen = vi.spyOn(window, 'open').mockImplementation(() => null)
    mount(DcMarkdown, { props: { markdown: 'content' } })

    window.dispatchEvent(new MessageEvent('message', { data: null }))
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { href: 'https://ignored.example', type: 'another-component' },
      }),
    )
    window.dispatchEvent(
      new MessageEvent('message', { data: { href: 42, type: 'markdown-router-0.5' } }),
    )
    expect(browserOpen).not.toHaveBeenCalled()

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { href: 'https://delta-comic.example', type: 'markdown-router-0.5' },
      }),
    )
    expect(browserOpen).toHaveBeenCalledWith(
      'https://delta-comic.example',
      '_blank',
      'noopener,noreferrer',
    )
  })

  it('uses the Tauri shell and falls back to the browser if shell opening fails', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.75)
    const browserOpen = vi.spyOn(window, 'open').mockImplementation(() => null)
    isTauri.mockReturnValue(true)
    shellOpen.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('shell failed'))
    mount(DcMarkdown, { props: { markdown: 'content' } })

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { href: 'https://native.example', type: 'markdown-router-0.75' },
      }),
    )
    await vi.waitFor(() => expect(shellOpen).toHaveBeenCalledWith('https://native.example'))
    expect(browserOpen).not.toHaveBeenCalled()

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { href: 'https://fallback.example', type: 'markdown-router-0.75' },
      }),
    )
    await vi.waitFor(() =>
      expect(browserOpen).toHaveBeenCalledWith(
        'https://fallback.example',
        '_blank',
        'noopener,noreferrer',
      ),
    )
  })
})