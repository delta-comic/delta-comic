import { installGlobalLogger, logger } from '@delta-comic/logger'

import { TauriLoggerClient } from '../logger/TauriLoggerClient'
import { initializeSplashEntry } from '../startup/entry'

const splashLogger = logger.scoped('app:splash')
logger.setTransport(new TauriLoggerClient())
installGlobalLogger(splashLogger)
splashLogger.info('splash entry initialized')

await initializeSplashEntry()