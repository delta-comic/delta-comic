import { TauriLoggerClient } from '@delta-comic/client-app-core/logger/TauriLoggerClient'
import { installGlobalLogger, logger } from '@delta-comic/shared-core-logger'

logger.setTransport(new TauriLoggerClient({ forwardToNative: true }))
logger.minLevel = import.meta.env.DEV ? 'trace' : 'info'
installGlobalLogger()

export const appLogger = logger.scoped('app')

appLogger.info('frontend bootstrap started')