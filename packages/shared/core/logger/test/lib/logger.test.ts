import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import { createLogger, formatLogEntry, installGlobalLogger, Logger } from '../../lib/logger'
import type { LogEntry, LoggerTransport } from '../../lib/types'

const loggers: Logger[] = []

afterEach(async () => {
  await Promise.all(loggers.splice(0).map(logger => logger.dispose()))
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const setup = (minLevel: 'trace' | 'info' = 'info') => {
  const transport: LoggerTransport = {
    write: vi.fn(),
    flush: vi.fn(async () => undefined),
    dispose: vi.fn(async () => undefined),
  }
  const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
  const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined)
  const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  const logger = createLogger('app', {
    captureErrors: false,
    flushOnLifecycle: false,
    transport,
    minLevel,
  })
  loggers.push(logger)
  return { debug, error, info, logger, transport }
}

describe('Logger', () => {
  it('enforces info as the minimum level', () => {
    const logger = createLogger('app', { captureErrors: false, flushOnLifecycle: false })
    const explicitlyVerboseLogger = createLogger('app', {
      captureErrors: false,
      flushOnLifecycle: false,
      minLevel: 'trace',
    })
    loggers.push(logger, explicitlyVerboseLogger)

    expect(logger.minLevel).toBe('info')
    expect(explicitlyVerboseLogger.minLevel).toBe('info')
  })

  it('creates scoped loggers sharing the platform transport', async () => {
    const { logger, transport } = setup()
    const worker = logger.scoped('downloads').group('chapter')

    worker.info('started', { id: 7 })
    await worker.flush()

    expect(worker.scope).toBe('app:downloads:chapter')
    expect(worker.transport).toBe(logger.transport)
    expect(transport.write).toHaveBeenCalledWith([
      expect.objectContaining({
        content: 'started {"id":7}',
        level: 'info',
        scope: 'app:downloads:chapter',
      }),
    ])
    expect(transport.flush).toHaveBeenCalledOnce()
  })

  it('filters below the unified minimum and persists accepted entries', () => {
    const { debug, info, logger, transport } = setup('info')

    logger.debug('hidden')
    logger.info('shown')

    expect(debug).not.toHaveBeenCalled()
    expect(info).toHaveBeenCalledOnce()
    expect(transport.write).toHaveBeenCalledOnce()
  })

  it('proxies console once, keeps original output, and restores it', () => {
    const { info, logger, transport } = setup()
    const restore = logger.proxyConsole()

    console.info('from console', { page: 2 })

    expect(info).toHaveBeenCalledExactlyOnceWith('from console', { page: 2 })
    expect(transport.write).toHaveBeenCalledWith([
      expect.objectContaining({ content: 'from console {"page":2}', level: 'info' }),
    ])

    restore()
    console.info('restored')
    expect(transport.write).toHaveBeenCalledOnce()
  })

  it('installs the global proxy once and supports clean reinstallation', () => {
    const { info, logger, transport } = setup()

    const firstUninstall = installGlobalLogger(logger)
    const secondUninstall = installGlobalLogger(logger)
    expect(secondUninstall).toBe(firstUninstall)

    console.info('captured once')
    expect(info).toHaveBeenCalledExactlyOnceWith('captured once')
    expect(transport.write).toHaveBeenCalledOnce()

    firstUninstall()
    const thirdUninstall = installGlobalLogger(logger)
    expect(thirdUninstall).not.toBe(firstUninstall)
    thirdUninstall()
  })

  it('captures global errors and flushes when the document becomes hidden', async () => {
    const fakeWindow = new EventTarget()
    const fakeDocument = new EventTarget() as EventTarget & { visibilityState: string }
    fakeDocument.visibilityState = 'visible'
    vi.stubGlobal('window', fakeWindow)
    vi.stubGlobal('document', fakeDocument)
    const transport: LoggerTransport = {
      write: vi.fn(),
      flush: vi.fn(async () => undefined),
      dispose: vi.fn(async () => undefined),
    }
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const logger = new Logger('global', { transport, minLevel: 'trace' })
    loggers.push(logger)
    const flush = vi.spyOn(logger, 'flush')

    const errorEvent = Object.assign(new Event('error'), {
      error: new Error('uncaught'),
      message: 'uncaught',
    })
    fakeWindow.dispatchEvent(errorEvent)
    expect(transport.write).toHaveBeenCalledWith([
      expect.objectContaining({
        content: expect.stringContaining('uncaught'),
        level: 'error',
        scope: 'global',
      }),
    ])

    fakeDocument.visibilityState = 'hidden'
    fakeDocument.dispatchEvent(new Event('visibilitychange'))
    expect(flush).toHaveBeenCalledTimes(1)
  })

  it('formats timestamps using the expected application layout', () => {
    const entry: LogEntry = {
      content: 'ready',
      level: 'info',
      scope: 'app',
      timestamp: '2026-07-22T01:02:03.000Z',
    }
    const formatted = formatLogEntry(entry)

    expect(formatted).toContain('(app) info > ready')
    expect(formatted).toMatch(/^\[2026\/07\/22 \d{2}:\d{2}:\d{2}\]/)
  })
})