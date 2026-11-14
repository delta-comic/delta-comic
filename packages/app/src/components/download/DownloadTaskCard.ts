import DesktopComponent from './DownloadTaskCard.desktop.vue'
import MobileComponent from './DownloadTaskCard.mobile.vue'

export default __DC_APP_TARGET__ === 'desktop' ? DesktopComponent : MobileComponent