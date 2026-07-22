import { installGlobalLogger, logger } from '@delta-comic/logger'

import { initializeSplashEntry } from '../startup/entry'

const splashLogger = logger.scoped('app:splash')
installGlobalLogger(splashLogger)
splashLogger.info('splash entry initialized')

await initializeSplashEntry()