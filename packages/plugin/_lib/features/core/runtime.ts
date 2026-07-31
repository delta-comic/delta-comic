import { registerBooter, registerInstaller, registerLoader } from '../../driver/extensions'

import configSetter from './booters/0_configSetter'
import i18n from './booters/5_i18n'
import apiTest from './booters/10_apiTest'
import resourceTest from './booters/20_resourceTest'
import boot from './booters/30_boot'
import auth from './booters/40_auth'
import otherProgress from './booters/50_otherProcess'
import fallbackUrlInstaller from './installers/10_normalUrl'
import localInstaller from './installers/20_local'
import devInstaller from './installers/30_dev'
import githubInstaller from './installers/40_github'
import awesomeInstaller from './installers/9999_awesome'
import zipLoader from './loaders/1_zip'
import devLoader from './loaders/2_dev'

let registered = false

export const registerCoreRuntimeExtensions = () => {
  if (registered) return
  registered = true

  registerBooter(configSetter, { order: 0 })
  registerBooter(i18n, { order: 5 })
  registerBooter(apiTest, { order: 10 })
  registerBooter(resourceTest, { order: 20 })
  registerBooter(boot, { order: 30 })
  registerBooter(auth, { order: 40 })
  registerBooter(otherProgress, { order: 50 })

  registerLoader(zipLoader, { order: 1 })
  registerLoader(devLoader, { order: 2 })

  registerInstaller(fallbackUrlInstaller, { order: 10 })
  registerInstaller(localInstaller, { order: 20 })
  registerInstaller(devInstaller, { order: 30 })
  registerInstaller(githubInstaller, { order: 40 })
  registerInstaller(awesomeInstaller, { order: 9999 })
}