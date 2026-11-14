import DesktopComponent from './DownloadSourceRefreshWarnings.desktop.vue'
import MobileComponent from './DownloadSourceRefreshWarnings.mobile.vue'

export default __DC_APP_TARGET__ === 'desktop' ? DesktopComponent : MobileComponent