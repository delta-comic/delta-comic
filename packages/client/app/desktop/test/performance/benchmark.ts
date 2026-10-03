import DownloadTaskInfo from '@delta-comic/core/components/download/DownloadTaskInfo.vue'
import LogText from '@delta-comic/core/components/logs/LogText.vue'
import { createApp, defineComponent, h, nextTick, shallowRef, vaporInteropPlugin } from 'vue'

interface Sample {
  mountMs: number
  updateMs: number
  scrollMs: number
  nodes: number
}

const Root = defineComponent({
  props: { kind: String, count: { type: Number, required: true } },
  setup(props, { expose }) {
    const revision = shallowRef(0)
    expose({ update: () => revision.value++ })
    return () =>
      h(
        'div',
        { style: { height: '600px', overflow: 'auto' } },
        Array.from({ length: props.count }, (_, index) =>
          props.kind === 'logs'
            ? h(LogText, {
                content: `${index}: log entry ${revision.value}\n${'entry '.repeat(5)}`,
              })
            : h(DownloadTaskInfo, {
                title: `Task ${index}: ${revision.value}`,
                path: `downloads/${index}.zip`,
              }),
        ),
      )
  },
})

async function sample(kind: 'downloads' | 'logs', count = 1000): Promise<Sample> {
  const target = document.querySelector('#benchmark')!
  const app = createApp(Root, { kind, count })
  app.use(vaporInteropPlugin)
  const start = performance.now()
  const instance = app.mount(target)
  await nextTick()
  const mountMs = performance.now() - start
  const updateStart = performance.now()
  // The fixture explicitly exposes the mutation it measures.
  Reflect.get(instance, 'update')()
  await nextTick()
  const updateMs = performance.now() - updateStart
  const scrollTarget = target.firstElementChild
  const scrollStart = performance.now()
  for (let index = 0; index < 60; index++) scrollTarget?.scrollTo(0, index * 100)
  const scrollMs = performance.now() - scrollStart
  const nodes = target.querySelectorAll('*').length
  app.unmount()
  return { mountMs, updateMs, scrollMs, nodes }
}

declare global {
  interface Window {
    clientBenchmark: { sample: typeof sample }
  }
}

window.clientBenchmark = { sample }