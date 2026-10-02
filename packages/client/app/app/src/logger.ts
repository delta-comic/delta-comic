import { installGlobalLogger, logger } from '@delta-comic/logger'

import { TauriLoggerClient } from './logger/TauriLoggerClient'

logger.setTransport(new TauriLoggerClient())
logger.minLevel = import.meta.env.DEV ? 'trace' : 'info'
installGlobalLogger()

export const appLogger = logger.scoped('app')

appLogger.info('frontend bootstrap started')