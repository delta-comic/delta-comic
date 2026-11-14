import DesktopComponent from './DownloadList.desktop.vue'
import MobileComponent from './DownloadList.mobile.vue'

export default __DC_APP_TARGET__ === 'desktop' ? DesktopComponent : MobileComponent