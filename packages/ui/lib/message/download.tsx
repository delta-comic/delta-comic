import { useGlobalVar } from '@delta-comic/utils'
import { until } from '@vueuse/core'
import { isUndefined, isError, delay } from 'es-toolkit'
import { isNumber, toString } from 'es-toolkit/compat'
import { motion } from 'motion-v'
import { NIcon, NIconWrapper, NProgress, NButton } from 'naive-ui'
import { Loading, Icon } from 'vant'
import {
  type Reactive,
  reactive,
  ref,
  watch,
  computed,
  Transition,
  withDirectives,
  vShow,
  TransitionGroup,
  nextTick
} from 'vue'

import { CloseRound, ReloadOutlined, DoneRound, FileDownloadRound } from '@/components/icons'

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
    fn: (ins: Reactive<DownloadMessageProgress>) => Promise<TResult>
  ): Promise<TResult>
  createLoading<TResult>(
    title: string,
    fn: (ins: Reactive<DownloadMessageLoading>) => Promise<TResult>
  ): Promise<TResult>
}
const allDownloadMessagesIsMinsize = useGlobalVar(
  reactive(new Array<boolean | undefined>()),
  'utils/message/allDownloadMessagesIsMinsize'
)
export const createDownloadMessage = async <T,>(
  title: string,
  bind: (method: DownloadMessageBind) => Promise<T>
): Promise<T> => {
  const index = allDownloadMessagesIsMinsize.length
  allDownloadMessagesIsMinsize[index] = false
  const isAllDone = ref(false)
  const messageList = reactive(
    new Array<
      {
        title: string
        description: string
        retry?: () => any
        progress?: number
        pc: PromiseWithResolvers<any>
      } & ({ state: 'success' | undefined } | { state: 'error'; error: Error })
    >()
  )
  const minsize = ref(false)
  const minsizeWatcher = watch(
    minsize,
    min => {
      if (min) allDownloadMessagesIsMinsize[index] = true
      else allDownloadMessagesIsMinsize[index] = false
    },
    { immediate: true }
  )
  const indexOnMinList = computed(() => {
    const afters = allDownloadMessagesIsMinsize.slice(0, index)
    return afters.filter(v => v).length
  })

  const message = window.$message.create(title, {
    render: $props => (
      <motion.div
        drag='y'
        dragConstraints={{ top: 0, right: 0, bottom: 0, left: 0 }}
        dragTransition={{ bounceStiffness: 500, bounceDamping: 15 }}
        variants={{
          minsize: {
            borderRadius: '100%',
            width: '30px',
            height: '30px',
            paddingInline: '2px',
            paddingBlock: '2px',
            position: 'fixed',
            left: `${indexOnMinList.value * 40 + 8}px`,
            top: 'calc(var(--safe-area-inset-top) + 4px)'
          },
          maxsize: {
            borderRadius: '8px',
            width: '90vw',
            paddingInline: '8px',
            paddingBlock: '12px',
            height: 'fit-content'
          }
        }}
        onDragEnd={(_, { offset }) => offset.y < -30 && (minsize.value = true)}
        animate={minsize.value ? 'minsize' : 'maxsize'}
        class='overflow-hidden bg-(--n-color)'
        style={{ boxShadow: 'var(--n-box-shadow)' }}
      >
        <Transition name='van-fade'>
          {minsize.value ? (
            <div class='relative size-full' onClick={() => (minsize.value = false)}>
              <Loading class='absolute top-0 left-0 size-full' color='var(--p-color)' />
              <NIcon
                class='absolute! top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'
                size='18px'
                color='var(--p-color)'
              >
                {messageList.some(v => v.state == 'error') ? (
                  <Icon name='cross' />
                ) : (
                  <FileDownloadRound />
                )}
              </NIcon>
            </div>
          ) : (
            <div class='relative w-full'>
              <div class='flex items-center gap-2 text-base font-semibold'>
                <span>{$props.content}</span>
                {isAllDone.value && (
                  <NIconWrapper size={18} color='var(--nui-success-color)' borderRadius={114514}>
                    <NIcon size={12}>
                      <DoneRound />
                    </NIcon>
                  </NIconWrapper>
                )}
              </div>
              {/* content */}
              {/* @ts-ignore class应当存在 */}
              <TransitionGroup name='list' tag='ul' class='ml-1! h-fit w-full!'>
                {messageList.map((v, index) => (
                  <div class='van-hairline--bottom w-full py-1' key={index}>
                    <span class='text-sm font-semibold'>{v.title}</span>
                    <div class='relative h-fit w-full'>
                      <NProgress
                        percentage={isNumber(v.progress) ? v.progress : 100}
                        indicatorPlacement='inside'
                        processing={isUndefined(v.state)}
                        type='line'
                        showIndicator={false}
                        show-indicator={false}
                        class={[
                          'transition-all **:in-[.n-progress-graph-line-fill]:hidden!',
                          v.state == 'error' && v.retry ? 'w-[60%]!' : 'w-[95%]!'
                        ]}
                        height={7}
                        status={v.state}
                      />
                      <Transition name='van-slide-right'>
                        {withDirectives(
                          <div class='absolute! top-1/2 right-[4%] flex -translate-y-1/2 gap-3 ease-in-out!'>
                            <NButton
                              tertiary
                              circle
                              onClick={() => {
                                if (v.state != 'error') return
                                v.retry = undefined
                                v.pc.reject(v.error)
                              }}
                              class='size-10!'
                            >
                              {{
                                icon: () => (
                                  <NIcon>
                                    <CloseRound />
                                  </NIcon>
                                )
                              }}
                            </NButton>
                            <NButton tertiary circle onClick={v.retry} class='size-10!'>
                              {{
                                icon: () => (
                                  <NIcon>
                                    <ReloadOutlined />
                                  </NIcon>
                                )
                              }}
                            </NButton>
                          </div>,
                          [[vShow, v.state == 'error' && v.retry]]
                        )}
                      </Transition>
                    </div>
                    <div class='h-4! text-xs text-(--van-text-color-2)'>
                      {(v.state == 'error' && `${v.error.name}: ${v.error.message}`) ||
                        v.description ||
                        '...'}
                    </div>
                  </div>
                ))}
              </TransitionGroup>
              <div class='absolute -bottom-2 left-1/2 h-1 w-10 -translate-x-1/2 rounded-lg bg-(--nui-divider-color)'></div>
            </div>
          )}
        </Transition>
      </motion.div>
    ),
    duration: 0
  })

  const createLine = <T extends object, TResult extends PromiseLike<any>>(
    title: string,
    config: T,
    fn: (config: Reactive<{ description: string; retryable: boolean } & T>) => TResult
  ) => {
    const pc = Promise.withResolvers<Awaited<TResult>>()
    const state = ref<(typeof messageList)[number]['state']>()
    const _config = reactive({ description: '', retryable: false, ...config })
    let error = new Error()
    const index = messageList.length
    const watcher = watch(
      [_config, state],
      ([, state]) => {
        messageList[index] = {
          title,
          state,
          error,
          pc,
          retry: _config.retryable ? call : undefined,
          ..._config
        }
      },
      { immediate: true }
    )
    const call = async () => {
      state.value = undefined
      _config.description = ''
      _config.retryable = false
      for (const key in config) {
        if (!Object.hasOwn(config, key)) continue
        const element = config[key]
        _config[key as keyof typeof _config] = element as any
      }
      try {
        const v = await fn(_config)
        state.value = 'success'
        await nextTick()
        watcher.stop()
        pc.resolve(v)
      } catch (err) {
        if (isError(err)) {
          error = err
        } else {
          error = new Error(toString(err))
        }
        state.value = 'error'
        await nextTick()
        if (!_config.retryable) {
          watcher.stop()
          pc.reject(err)
        }
      }
    }
    void call()
    return pc.promise
  }

  const createProgress: DownloadMessageBind['createProgress'] = (title, fn) => {
    return createLine(title, { progress: 0 }, fn)
  }
  const createLoading: DownloadMessageBind['createLoading'] = (title, fn) => {
    return createLine(title, {}, fn)
  }
  const bindInstance = bind({ createProgress, createLoading })
  const controller = Promise.withResolvers<T>()
  void bindInstance.then(async result => {
    minsize.value = false // 最小化就展开提醒
    isAllDone.value = true // 展示完成标
    const maybeError = messageList.find(v => v.state == 'error')
    if (maybeError) throw maybeError.error
    controller.resolve(result)

    void delay(3000).then(() => {
      minsize.value = true
    }) // 到时间自动关
    await nextTick()
    await until(minsize).toBeTruthy()

    minsizeWatcher.stop()
    message.destroy()
    allDownloadMessagesIsMinsize[index] = undefined
  })
  bindInstance.catch(async err => {
    controller.reject(err)
    minsize.value = false // 最小化就展开提醒

    void delay(3000).then(() => {
      minsize.value = true
    }) // 到时间自动关
    await nextTick()
    await until(minsize).toBeTruthy()

    minsizeWatcher.stop()
    message.destroy()
    allDownloadMessagesIsMinsize[index] = undefined
  })

  return controller.promise
}