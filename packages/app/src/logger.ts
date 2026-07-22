import { installGlobalLogger, logger } from '@delta-comic/logger'

installGlobalLogger()

export const appLogger = logger.scoped('app')

appLogger.info('frontend bootstrap started')