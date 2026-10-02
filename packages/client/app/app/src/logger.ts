import { installGlobalLogger, logger } from '@delta-comic/logger'

import { TauriLoggerClient } from './logger/TauriLoggerClient'

logger.setTransport(new TauriLoggerClient())
installGlobalLogger()

export const appLogger = logger.scoped('app')

appLogger.info('frontend bootstrap started')