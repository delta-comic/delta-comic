import DesktopComponent from './DownloadToolbar.desktop.vue'
import MobileComponent from './DownloadToolbar.mobile.vue'

export default __DC_APP_TARGET__ === 'desktop' ? DesktopComponent : MobileComponent