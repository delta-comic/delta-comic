// cspell:ignore Minsize minsize maxsize

import { useGlobalVar } from '@delta-comic/utils'
import { until } from '@vueuse/core'
import { isError, isUndefined, delay } from 'es-toolkit'
import { isNumber, toString } from 'es-toolkit/compat'
import { motion } from 'motion-v'
import { NButton, NIcon, NIconWrapper, NProgress } from 'naive-ui'
import { computed, h, nextTick, reactive, ref, Transition, TransitionGroup, watch } from 'vue'
import type { Reactive, VNode } from 'vue'

import DcLoading from '@/components/DcLoading.vue'
import { CloseRound, DoneRound, FileDownloadRound, ReloadOutlined } from '@/components/icons'

export interface DownloadMessageProgress extends DownloadMessageLoading {
  /** 0~100 */ progress: number
}
export interface DownloadMessageLoading {
  description: string
  retryable: boolean
}
export interface DownloadMessageBind {
  createProgress<TResult>(
    title: string,
    fn: (ins: Reactive<DownloadMessageProgress>) => Promise<TResult>,
  ): Promise<TResult>
  createLoading<TResult>(
    title: string,
    fn: (ins: Reactive<DownloadMessageLoading>) => Promise<TResult>,
  ): Promise<TResult>
}

type DownloadMessageItem = {
  title: string
  description: string
  retry?: () => void
  progress?: number
  pc: { reject: (reason?: unknown) => void }
} & ({ state: 'success' | undefined } | { state: 'error'; error: Error })

const allDownloadMessagesIsMinsize = useGlobalVar(
  reactive(new Array<boolean | undefined>()),
  'utils/message/allDownloadMessagesIsMinsize',
)

const renderDownloadContent = (
  content: unknown,
  minsize: { value: boolean },
  isAllDone: { value: boolean },
  messageList: DownloadMessageItem[],
  indexOnMinList: { value: number },
): VNode =>
  h(
    motion.div,
    {
      drag: 'y',
      dragConstraints: { top: 0, right: 0, bottom: 0, left: 0 },
      dragTransition: { bounceStiffness: 500, bounceDamping: 15 },
      variants: {
        minsize: {
          borderRadius: '100%',
          width: '30px',
          height: '30px',
          paddingInline: '2px',
          paddingBlock: '2px',
          position: 'fixed',
          left: `${indexOnMinList.value * 40 + 8}px`,
          top: 'calc(var(--safe-area-inset-top) + 4px)',
        },
        maxsize: {
          borderRadius: '8px',
          width: '90vw',
          paddingInline: '8px',
          paddingBlock: '12px',
          height: 'fit-content',
        },
      },
      onDragEnd: (_event: unknown, info: { offset: { y: number } }) => {
        if (info.offset.y < -30) minsize.value = true
      },
      animate: minsize.value ? 'minsize' : 'maxsize',
      class: 'overflow-hidden bg-(--n-color) shadow-(--n-box-shadow)',
    },
    {
      default: () =>
        h(
          Transition,
          {
            enterActiveClass:
              'transition-opacity duration-[var(--dc-duration-fast,200ms)] ease-[ease]',
            enterFromClass: 'opacity-0',
            leaveActiveClass:
              'transition-opacity duration-[var(--dc-duration-fast,200ms)] ease-[ease]',
            leaveToClass: 'opacity-0',
          },
          {
            default: () =>
              minsize.value
                ? h(
                    'div',
                    { class: 'relative size-full', onClick: () => (minsize.value = false) },
                    [
                      h(DcLoading, {
                        class: 'absolute top-0 left-0 size-full',
                        color: 'var(--p-color)',
                      }),
                      h(
                        NIcon,
                        {
                          class: 'absolute! top-1/2 left-1/2 -translate-1/2',
                          size: '18px',
                          color: 'var(--p-color)',
                        },
                        {
                          default: () =>
                            messageList.some(v => v.state == 'error')
                              ? h(NIcon, null, { default: () => h(CloseRound) })
                              : h(FileDownloadRound),
                        },
                      ),
                    ],
                  )
                : h('div', { class: 'relative w-full' }, [
                    h('div', { class: 'flex items-center gap-2 text-base font-semibold' }, [
                      h('span', undefined, String(content ?? '')),
                      isAllDone.value &&
                        h(
                          NIconWrapper,
                          { size: 18, color: 'var(--nui-success-color)', borderRadius: 114514 },
                          {
                            default: () => h(NIcon, { size: 12 }, { default: () => h(DoneRound) }),
                          },
                        ),
                    ]),
                    h('ul', { class: 'ml-1! h-fit w-full!' }, [
                      h(
                        TransitionGroup,
                        {
                          moveClass:
                            'transition-[transform,opacity] duration-[420ms] ease-[cubic-bezier(0.22,1.5,0.5,1)] [will-change:transform,opacity]',
                          enterActiveClass:
                            'transition-[transform,opacity] duration-[420ms] ease-[cubic-bezier(0.22,1.5,0.5,1)] [will-change:transform,opacity]',
                          enterFromClass: 'translate-y-[30px] opacity-0',
                          leaveActiveClass:
                            'absolute transition-[transform,opacity] duration-[420ms] ease-[cubic-bezier(0.22,1.5,0.5,1)] [will-change:transform,opacity]',
                          leaveToClass: 'translate-y-[30px] opacity-0',
                        },
                        {
                          default: () =>
                            messageList.map((v, itemIndex) =>
                              h('li', { class: 'dc-hairline-bottom w-full py-1', key: itemIndex }, [
                                h('span', { class: 'text-sm font-semibold' }, v.title),
                                h('div', { class: 'relative h-fit w-full' }, [
                                  h(NProgress, {
                                    percentage: isNumber(v.progress) ? v.progress : 100,
                                    indicatorPlacement: 'inside',
                                    processing: isUndefined(v.state),
                                    type: 'line',
                                    showIndicator: false,
                                    height: 7,
                                    status: v.state,
                                    class: [
                                      'transition-all **:in-[.n-progress-graph-line-fill]:hidden!',
                                      v.state == 'error' && v.retry ? 'w-[60%]!' : 'w-[95%]!',
                                    ],
                                  }),
                                  h(
                                    Transition,
                                    {
                                      enterActiveClass:
                                        'transition-transform duration-[var(--dc-duration-base,300ms)] ease-[ease]',
                                      enterFromClass: 'translate-x-full',
                                      leaveActiveClass:
                                        'transition-transform duration-[var(--dc-duration-base,300ms)] ease-[ease]',
                                      leaveToClass: 'translate-x-full',
                                    },
                                    {
                                      default: () =>
                                        h(
                                          'div',
                                          {
                                            class:
                                              'absolute! top-1/2 right-[4%] flex -translate-y-1/2 gap-3 ease-in-out!',
                                            style:
                                              v.state == 'error' && v.retry
                                                ? undefined
                                                : { display: 'none' },
                                          },
                                          [
                                            h(
                                              NButton,
                                              {
                                                tertiary: true,
                                                circle: true,
                                                class: 'size-10!',
                                                onClick: () => {
                                                  if (v.state != 'error') return
                                                  v.retry = undefined
                                                  v.pc.reject(v.error)
                                                },
                                              },
                                              {
                                                icon: () =>
                                                  h(NIcon, null, { default: () => h(CloseRound) }),
                                              },
                                            ),
                                            h(
                                              NButton,
                                              {
                                                tertiary: true,
                                                circle: true,
                                                class: 'size-10!',
                                                onClick: v.retry,
                                              },
                                              {
                                                icon: () =>
                                                  h(NIcon, null, {
                                                    default: () => h(ReloadOutlined),
                                                  }),
                                              },
                                            ),
                                          ],
                                        ),
                                    },
                                  ),
                                ]),
                                h(
                                  'div',
                                  { class: 'h-4! text-xs text-(--dc-color-text-secondary)' },
                                  (v.state == 'error' && `${v.error.name}: ${v.error.message}`) ||
                                    v.description ||
                                    '...',
                                ),
                              ]),
                            ),
                        },
                      ),
                    ]),
                    h('div', {
                      class:
                        'absolute -bottom-2 left-1/2 h-1 w-10 -translate-x-1/2 rounded-lg bg-(--nui-divider-color)',
                    }),
                  ]),
          },
        ),
    },
  )

export const createDownloadMessage = async <T>(
  title: string,
  bind: (method: DownloadMessageBind) => Promise<T>,
): Promise<T> => {
  const availableIndex = allDownloadMessagesIsMinsize.findIndex(isUndefined)
  const index = availableIndex === -1 ? allDownloadMessagesIsMinsize.length : availableIndex
  allDownloadMessagesIsMinsize[index] = false
  const isAllDone = ref(false)
  const messageList = reactive<DownloadMessageItem[]>([])
  const minsize = ref(false)
  const minsizeWatcher = watch(
    minsize,
    min => {
      allDownloadMessagesIsMinsize[index] = min
    },
    { immediate: true },
  )
  const indexOnMinList = computed(
    () => allDownloadMessagesIsMinsize.slice(0, index).filter(v => v).length,
  )
  const message = window.$message.create(title, {
    render: $props =>
      renderDownloadContent($props.content, minsize, isAllDone, messageList, indexOnMinList),
    duration: 0,
  })

  const createLine = <TConfig extends object, TResult extends PromiseLike<unknown>>(
    lineTitle: string,
    config: TConfig,
    fn: (config: Reactive<{ description: string; retryable: boolean } & TConfig>) => TResult,
  ) => {
    const pc = Promise.withResolvers<Awaited<TResult>>()
    const state = ref<(typeof messageList)[number]['state']>()
    const lineConfig = reactive({ description: '', retryable: false, ...config })
    let error = new Error()
    const lineIndex = messageList.length
    const watcher = watch(
      [lineConfig, state],
      ([, currentState]) => {
        const progress =
          'progress' in lineConfig && isNumber(lineConfig.progress)
            ? Math.min(100, Math.max(0, lineConfig.progress))
            : undefined
        messageList[lineIndex] = {
          title: lineTitle,
          state: currentState,
          error,
          pc,
          retry: lineConfig.retryable ? call : undefined,
          ...lineConfig,
          ...(isNumber(progress) ? { progress } : {}),
        }
      },
      { immediate: true },
    )
    const call = async () => {
      state.value = undefined
      lineConfig.description = ''
      lineConfig.retryable = false
      Object.assign(lineConfig, config)
      try {
        const result = await fn(lineConfig)
        state.value = 'success'
        await nextTick()
        watcher.stop()
        pc.resolve(result)
      } catch (caught) {
        error = isError(caught) ? caught : new Error(toString(caught))
        state.value = 'error'
        await nextTick()
        if (!lineConfig.retryable) {
          watcher.stop()
          pc.reject(caught)
        }
      }
    }
    void call()
    return pc.promise
  }
  const createProgress: DownloadMessageBind['createProgress'] = (lineTitle, fn) =>
    createLine(lineTitle, { progress: 0 }, fn)
  const createLoading: DownloadMessageBind['createLoading'] = (lineTitle, fn) =>
    createLine(lineTitle, {}, fn)
  const bindInstance = Promise.resolve().then(() => bind({ createProgress, createLoading }))
  const controller = Promise.withResolvers<T>()
  const destroyWhenMinimized = async () => {
    void delay(3000).then(() => {
      minsize.value = true
    })
    await nextTick()
    await until(minsize).toBeTruthy()
    minsizeWatcher.stop()
    message.destroy()
    allDownloadMessagesIsMinsize[index] = undefined
    while (
      allDownloadMessagesIsMinsize.length > 0 &&
      isUndefined(allDownloadMessagesIsMinsize.at(-1))
    ) {
      allDownloadMessagesIsMinsize.pop()
    }
  }
  void (async () => {
    try {
      const result = await bindInstance
      const maybeError = messageList.find(v => v.state == 'error')
      if (maybeError && maybeError.state == 'error') throw maybeError.error
      isAllDone.value = true
      controller.resolve(result)
    } catch (error) {
      controller.reject(error)
    } finally {
      minsize.value = false
      void destroyWhenMinimized()
    }
  })()
  return controller.promise
}