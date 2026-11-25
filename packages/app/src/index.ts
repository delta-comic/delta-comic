import { appLogger } from '@/logger'

appLogger.debug('loading frontend modules')
try {
  await import('./app/bootstrap')
  appLogger.debug('frontend initialization completed')
} catch (error) {
  appLogger.error('frontend initialization failed', error)
  await appLogger.flush()
}