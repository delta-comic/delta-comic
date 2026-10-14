// cspell:ignore VDOM
import { afterEach, describe, expect, it } from 'vite-plus/test'
const { createApp, defineComponent, h, nextTick, shallowRef, vaporInteropPlugin } =
  window.$$lib$$.Vue

import DownloadTaskInfo from '@delta-comic/client-app-core/components/download/DownloadTaskInfo.vue'
import LogText from '@delta-comic/client-app-core/components/logs/LogText.vue'

const cleanups: Array<() => void> = []
afterEach(() => cleanups.splice(0).forEach(cleanup => cleanup()))

function mountFragment(kind: 'downloads' | 'logs') {
  const text = shallowRef('initial')
  const container = document.createElement('div')
  document.body.appendChild(container)
  const app = createApp(
    defineComponent(
      () => () =>
        kind === 'logs'
          ? h(LogText, { content: text.value })
          : h(DownloadTaskInfo, { title: text.value, path: 'downloads/file.zip' }),
    ),
  )
  app.use(vaporInteropPlugin)
  app.mount(container)
  cleanups.push(() => {
    app.unmount()
    container.remove()
  })
  return { container, text }
}

describe('Vapor fragments in the client host', () => {
  it('updates download metadata through the VDOM host', async () => {
    const { container, text } = mountFragment('downloads')
    expect(container.textContent).toContain('downloads/file.zip')
    text.value = 'updated task'
    await nextTick()
    expect(container.textContent).toContain('updated task')
  })

  it('renders log content as text and updates the existing fragment', async () => {
    const { container, text } = mountFragment('logs')
    const element = container.querySelector('pre')
    text.value = '<script>plain log text</script>'
    await nextTick()
    expect(container.querySelector('pre')).toBe(element)
    expect(element?.textContent).toBe(text.value)
    expect(container.querySelector('script')).toBeNull()
  })
})