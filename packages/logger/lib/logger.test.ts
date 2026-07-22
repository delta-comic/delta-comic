import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import {
  createLogger,
  exportLogs,
  formatLogEntry,
  installGlobalLogger,
  logger as sharedLogger,
  loggerClient,
  listLogFiles,
  readLogFile,
  Logger,
} from './logger'
import type { Invoke, LogEntry } from './types'

const loggers: Logger[] = []

afterEach(async () => {
  await Promise.all(loggers.splice(0).map(logger => logger.dispose()))
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const setup = (minLevel: 'trace' | 'info' = 'trace') => {
  const invoke = vi.fn<Invoke>(async () => undefined as never)
  const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
  const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined)
  const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  const logger = createLogger('app', {
    captureErrors: false,
    flushOnLifecycle: false,
    invoke,
    minLevel,
  })
  loggers.push(logger)
  return { debug, error, info, invoke, logger }
}

describe('Logger', () => {
  it('exports one shared client for UI and plugin consumers', () => {
    expect(loggerClient).toBe(sharedLogger.client)
  })

  it('provides top-level typed reader and export helpers', async () => {
    vi.spyOn(loggerClient, 'listLogFiles').mockResolvedValue([])
    vi.spyOn(loggerClient, 'readLogFile').mockResolvedValue({
      content: 'line',
      path: '/logs/app.log',
      size: 4,
      truncated: false,
    })
    vi.spyOn(loggerClient, 'exportLogs').mockResolvedValue('/tmp/logs.zip')

    await expect(listLogFiles()).resolves.toEqual([])
    await expect(readLogFile('/logs/app.log')).resolves.toMatchObject({ content: 'line' })
    await expect(exportLogs({ paths: ['/logs/app.log'] })).resolves.toBe('/tmp/logs.zip')
    expect(loggerClient.readLogFile).toHaveBeenCalledWith('/logs/app.log')
    expect(loggerClient.exportLogs).toHaveBeenCalledWith({ paths: ['/logs/app.log'] })
  })

  it('creates scoped loggers sharing one client', async () => {
    const { invoke, logger } = setup()
    const worker = logger.scoped('downloads').group('chapter')

    worker.info('started', { id: 7 })
    await worker.flush()

    expect(worker.scope).toBe('app:downloads:chapter')
    expect(worker.client).toBe(logger.client)
    expect(invoke).toHaveBeenCalledWith('plugin:logger|write_logs', {
      entries: [
        expect.objectContaining({
          content: 'started {"id":7}',
          level: 'info',
          scope: 'app:downloads:chapter',
        }),
      ],
    })
  })

  it('filters below the configured production-style minimum', async () => {
    const { debug, info, invoke, logger } = setup('info')

    logger.debug('hidden')
    logger.info('shown')
    await logger.flush()

    expect(debug).not.toHaveBeenCalled()
    expect(info).toHaveBeenCalledOnce()
    expect(invoke).toHaveBeenCalledOnce()
  })

  it('prints formatted output and persists structured content', async () => {
    const { error, invoke, logger } = setup()
    logger.error('failed', new Error('boom'))
    await logger.flush()

    expect(error).toHaveBeenCalledWith(expect.stringMatching(/^\[.+\] \(app\) error > failed /))
    expect(invoke).toHaveBeenCalledWith('plugin:logger|write_logs', {
      entries: [expect.objectContaining({ content: expect.stringContaining('"message":"boom"') })],
    })
  })

  it('proxies console once, keeps original output, and restores it', async () => {
    const { info, invoke, logger } = setup()
    const restore = logger.proxyConsole()

    console.info('from console', { page: 2 })
    await logger.flush()

    expect(info).toHaveBeenCalledExactlyOnceWith('from console', { page: 2 })
    expect(invoke).toHaveBeenCalledOnce()
    expect(invoke.mock.calls[0]?.[1]).toEqual({
      entries: [expect.objectContaining({ content: 'from console {"page":2}', level: 'info' })],
    })

    restore()
    console.info('restored')
    await logger.flush()
    expect(invoke).toHaveBeenCalledOnce()
  })

  it('installs the global proxy only once and supports clean reinstallation', async () => {
    const { info, invoke, logger } = setup()

    const firstUninstall = installGlobalLogger(logger)
    const secondUninstall = installGlobalLogger(logger)
    expect(secondUninstall).toBe(firstUninstall)

    console.info('captured once')
    await logger.flush()
    expect(info).toHaveBeenCalledExactlyOnceWith('captured once')
    expect(invoke).toHaveBeenCalledOnce()

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
    const invoke = vi.fn<Invoke>(async () => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const logger = new Logger('global', { invoke, minLevel: 'trace' })
    loggers.push(logger)
    const flush = vi.spyOn(logger, 'flush')

    const errorEvent = Object.assign(new Event('error'), {
      error: new Error('uncaught'),
      message: 'uncaught',
    })
    fakeWindow.dispatchEvent(errorEvent)
    await logger.flush()

    expect(invoke).toHaveBeenCalledWith('plugin:logger|write_logs', {
      entries: [
        expect.objectContaining({
          content: expect.stringContaining('uncaught'),
          level: 'error',
          scope: 'global',
        }),
      ],
    })

    fakeDocument.visibilityState = 'hidden'
    fakeDocument.dispatchEvent(new Event('visibilitychange'))
    expect(flush).toHaveBeenCalledTimes(2)
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