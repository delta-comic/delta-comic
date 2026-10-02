import { installGlobalLogger, logger } from '@delta-comic/logger'

import { TauriLoggerClient } from '../logger/TauriLoggerClient'
import { initializeSplashEntry } from '../startup/entry'

const splashLogger = logger.scoped('app:splash')
logger.setTransport(new TauriLoggerClient())
logger.minLevel = import.meta.env.DEV ? 'trace' : 'info'
installGlobalLogger(splashLogger)
splashLogger.info('splash entry initialized')

try {
  await initializeSplashEntry()
  splashLogger.debug('splash startup strategy initialized')
} catch (error) {
  splashLogger.error('splash startup failed', error)
  await splashLogger.flush()
}